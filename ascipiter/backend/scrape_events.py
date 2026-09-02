# backend/scrape_events.py
#
# Scrapes the full Biola events calendar (https://www.biola.edu/events/search),
# tagging Chapel and Athletics events via the calendar's category filters.
# Falls back to scraping https://www.biola.edu/chapel (chapels only) if the
# events search cannot be scraped.

import logging
import re
import socket
import struct
import random
import time as time_module
from datetime import datetime
from urllib.parse import urljoin, parse_qs, urlparse, unquote_plus

import certifi
import requests
import urllib3
from bs4 import BeautifulSoup

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

BASE_URL = "https://www.biola.edu"
HOSTNAME = "www.biola.edu"
SEARCH_PATH = "/events/search"
CHAPEL_PATH = "/chapel"

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
}

# Max pages to walk for the uncategorized event list (25 events/page).
ALL_EVENTS_MAX_PAGES = 4
# Max pages for each category query (chapel needs every page for the credit count).
CATEGORY_MAX_PAGES = 8
# Politeness delay between page fetches
REQUEST_DELAY_SECONDS = 0.3

MONTHS = {m: i for i, m in enumerate(
    ["January", "February", "March", "April", "May", "June", "July",
     "August", "September", "October", "November", "December"], start=1)}


# --- Network layer -----------------------------------------------------------
#
# biola.edu uses split-horizon DNS: on the campus network the public IP is
# firewalled and only the internal IP works, but macOS's resolver can hand back
# the public one. When a normal request fails we resolve the hostname directly
# against the system's configured DNS servers and pin the connection to that IP
# (with proper SNI/verification), which works both on and off campus.

_pinned_ip = None


def _get_system_nameservers():
    servers = []
    try:
        with open('/etc/resolv.conf') as f:
            for line in f:
                parts = line.split()
                if len(parts) >= 2 and parts[0] == 'nameserver':
                    servers.append(parts[1])
    except OSError:
        pass
    return servers


def _dns_query_a(hostname: str, server: str, timeout: float = 4.0) -> list:
    """Minimal stdlib DNS A-record query against a specific server."""
    tid = random.randint(0, 0xFFFF)
    header = struct.pack('>HHHHHH', tid, 0x0100, 1, 0, 0, 0)
    qname = b''.join(bytes([len(p)]) + p.encode() for p in hostname.split('.')) + b'\x00'
    query = header + qname + struct.pack('>HH', 1, 1)  # A record, IN class

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(timeout)
    try:
        sock.sendto(query, (server, 53))
        data, _ = sock.recvfrom(2048)
    finally:
        sock.close()

    ancount = struct.unpack('>H', data[6:8])[0]
    idx = 12
    while data[idx] != 0:  # skip question name
        idx += data[idx] + 1
    idx += 5  # null byte + qtype + qclass

    ips = []
    for _ in range(ancount):
        if data[idx] & 0xC0:  # compressed name pointer
            idx += 2
        else:
            while data[idx] != 0:
                idx += data[idx] + 1
            idx += 1
        rtype, _rclass, _ttl, rdlen = struct.unpack('>HHIH', data[idx:idx + 10])
        idx += 10
        if rtype == 1 and rdlen == 4:
            ips.append('.'.join(str(b) for b in data[idx:idx + 4]))
        idx += rdlen
    return ips


def _fetch_via_ip(ip: str, path_qs: str) -> str:
    """HTTPS GET to a pinned IP with correct SNI and certificate verification."""
    pool = urllib3.HTTPSConnectionPool(
        ip, 443,
        server_hostname=HOSTNAME,
        assert_hostname=HOSTNAME,
        cert_reqs='CERT_REQUIRED',
        ca_certs=certifi.where(),
        timeout=urllib3.Timeout(connect=10, read=30),
    )
    try:
        resp = pool.request('GET', path_qs, headers={**HEADERS, 'Host': HOSTNAME},
                            retries=urllib3.Retry(total=1, redirect=3))
        if resp.status != 200:
            raise IOError(f"HTTP {resp.status} from {ip}{path_qs}")
        return resp.data.decode('utf-8', 'replace')
    finally:
        pool.close()


def fetch_page(path_qs: str) -> str:
    """Fetch a biola.edu page, working around campus split-horizon DNS issues."""
    global _pinned_ip

    if _pinned_ip:
        try:
            return _fetch_via_ip(_pinned_ip, path_qs)
        except Exception as e:
            logging.warning(f"Pinned IP {_pinned_ip} failed ({e}); retrying normal resolution.")
            _pinned_ip = None

    try:
        response = requests.get(BASE_URL + path_qs, headers=HEADERS, timeout=(10, 30))
        response.raise_for_status()
        return response.text
    except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as first_error:
        logging.warning(f"Direct request to {path_qs} failed ({first_error}); "
                        "trying DNS servers directly for an alternate IP.")

    tried = set()
    for server in _get_system_nameservers():
        try:
            ips = _dns_query_a(HOSTNAME, server)
        except OSError as e:
            logging.debug(f"DNS query to {server} failed: {e}")
            continue
        for ip in ips:
            if ip in tried:
                continue
            tried.add(ip)
            try:
                text = _fetch_via_ip(ip, path_qs)
                logging.info(f"Reached {HOSTNAME} via pinned IP {ip}.")
                _pinned_ip = ip
                return text
            except Exception as e:
                logging.debug(f"Pinned fetch via {ip} failed: {e}")

    raise IOError(f"Could not reach {HOSTNAME}{path_qs} by any route.")


# --- Parsing helpers ---------------------------------------------------------

def _parse_event_date(date_text: str):
    """Parse 'Tuesday, September 1, 2026' -> (2026, 9, 1). Ranges return None."""
    if not date_text:
        return None
    match = re.search(r'([A-Z][a-z]+)\s+(\d{1,2}),\s*(\d{4})', date_text)
    if not match:
        return None
    # Ranges like "August 24 - December 18, 2026" have a dash before the matched month
    if '-' in date_text.split(match.group(1))[0] or ' - ' in date_text:
        return None
    month = MONTHS.get(match.group(1))
    if not month:
        return None
    return int(match.group(3)), month, int(match.group(2))


def _parse_start_time(time_text: str):
    """Parse '9:30 - 10:20 a.m. PDT' / '6 - 8:30 p.m. PDT' / '7:30 p.m.' -> (hour, minute)."""
    if not time_text:
        return None
    first_segment = time_text.split('-')[0]
    match = re.search(r'(\d{1,2})(?::(\d{2}))?', first_segment)
    if not match:
        return None
    hour = int(match.group(1))
    minute = int(match.group(2) or 0)
    # The start time's own meridiem wins; otherwise borrow it from the end time
    meridiem = (re.search(r'\b(a|p)\.?m\.?', first_segment, re.I)
                or re.search(r'\b(a|p)\.?m\.?', time_text, re.I))
    if meridiem:
        if meridiem.group(1).lower() == 'p' and hour != 12:
            hour += 12
        elif meridiem.group(1).lower() == 'a' and hour == 12:
            hour = 0
    if hour > 23 or minute > 59:
        return None
    return hour, minute


def _event_key(url: str) -> str:
    """Stable identity for one event occurrence (path + occurrence_id)."""
    parsed = urlparse(url)
    occurrence = parse_qs(parsed.query).get('occurrence_id', [''])[0]
    return f"{parsed.path}|{occurrence}"


def _parse_search_page(html: str) -> tuple:
    """Parse one /events/search page. Returns (events, has_next_page)."""
    soup = BeautifulSoup(html, 'html.parser')
    events = []

    for item in soup.find_all('div', class_='event-list-item'):
        body = item.find('div', class_='body') or item
        title_tag = body.find('h3', class_='title')
        link = title_tag.find('a') if title_tag else None
        if not link or not link.get('href'):
            continue
        title = link.get_text(strip=True)
        url = urljoin(BASE_URL, link['href'])

        subtitle_tag = body.find('h4', class_='subtitle')
        description = subtitle_tag.get_text(strip=True) if subtitle_tag else None

        date_text = None
        time_text = None
        for li in body.find_all('li'):
            if li.find('span', class_='fa-calendar'):
                date_text = li.get_text(' ', strip=True)
            elif li.find('span', class_='fa-clock-o'):
                time_text = li.get_text(' ', strip=True)

        start_iso = None
        date_parts = _parse_event_date(date_text or '')
        if date_parts:
            hour, minute = _parse_start_time(time_text or '') or (0, 0)
            start_iso = datetime(date_parts[0], date_parts[1], date_parts[2], hour, minute).isoformat()

        events.append({
            'title': title,
            'description': description or None,
            'url': url,
            'date': date_text,
            'time': time_text,
            'start': start_iso,
        })

    has_next = bool(soup.select_one('ul.pager li.next a'))
    return events, has_next


def _scrape_search(category: str = None, max_pages: int = ALL_EVENTS_MAX_PAGES) -> list:
    """Walk paginated /events/search results, optionally filtered to one category."""
    events = []
    for page in range(1, max_pages + 1):
        path = f"{SEARCH_PATH}?page={page}"
        if category:
            path += f"&category%5B%5D={category.replace(' ', '+')}"
        html = fetch_page(path)
        page_events, has_next = _parse_search_page(html)
        events.extend(page_events)
        logging.info(f"Scraped events page {page} (category={category or 'all'}): "
                     f"{len(page_events)} events.")
        if not has_next:
            break
        time_module.sleep(REQUEST_DELAY_SECONDS)
    return events


# --- Chapel page fallback ----------------------------------------------------

def _parse_ics_start(ics_href: str):
    """Parse start_date from an ics-file link: 'August 31, 2026 at 09:30AM'."""
    query = parse_qs(urlparse(ics_href).query)
    raw = unquote_plus(query.get('start_date', [''])[0])
    match = re.search(r'([A-Z][a-z]+)\s+(\d{1,2}),\s*(\d{4})\s+at\s+(\d{1,2}):(\d{2})(AM|PM)', raw)
    if not match:
        return None
    month = MONTHS.get(match.group(1))
    if not month:
        return None
    hour = int(match.group(4))
    if match.group(6) == 'PM' and hour != 12:
        hour += 12
    elif match.group(6) == 'AM' and hour == 12:
        hour = 0
    return datetime(int(match.group(3)), month, int(match.group(2)), hour, int(match.group(5)))


def _scrape_chapel_page() -> list:
    """Fallback: scrape chapels only from https://www.biola.edu/chapel."""
    html = fetch_page(CHAPEL_PATH)
    soup = BeautifulSoup(html, 'html.parser')
    events = []

    for event_list in soup.find_all('ul', class_='chapel-list'):
        for li in event_list.find_all('li'):
            title_tag = li.find('h3', class_='title')
            if not title_tag:
                continue
            link = title_tag.find('a')
            title = title_tag.get_text(strip=True)
            url = urljoin(BASE_URL, link['href']) if link and link.get('href') else None

            subtitle_tag = li.find('h4', class_='subtitle')
            description = subtitle_tag.get_text(strip=True) if subtitle_tag else None

            start = None
            datetime_div = li.find('div', class_='datetime')
            ics_link = datetime_div.find('a') if datetime_div else None
            if ics_link and ics_link.get('href'):
                start = _parse_ics_start(ics_link['href'])

            date_text = None
            time_text = None
            if start:
                date_text = start.strftime('%A, %B %-d, %Y') if hasattr(start, 'strftime') else None
                time_text = start.strftime('%-I:%M %p')

            events.append({
                'title': title,
                'description': description or None,
                'url': url,
                'date': date_text,
                'time': time_text,
                'start': start.isoformat() if start else None,
                'is_chapel': True,
                'is_athletics': False,
            })

    logging.info(f"Chapel fallback page scrape found {len(events)} chapel events.")
    return events


# --- Main entry point --------------------------------------------------------

def get_events_data() -> dict:
    """
    Returns {'events': [...], 'source': 'events_search' | 'chapel_page'}.
    Each event: title, description, url, date, time, start (ISO string or None),
    is_chapel, is_athletics.
    """
    try:
        all_events = _scrape_search()
        chapel_events = _scrape_search(category='Chapel', max_pages=CATEGORY_MAX_PAGES)
        athletics_events = _scrape_search(category='Athletics', max_pages=CATEGORY_MAX_PAGES)

        if not all_events and not chapel_events:
            raise IOError("Events search returned no events at all; page structure may have changed.")

        chapel_keys = {_event_key(e['url']) for e in chapel_events}
        athletics_keys = {_event_key(e['url']) for e in athletics_events}

        # Merge the general list with the full chapel list (which extends past the
        # general window and is needed to count every remaining chapel credit).
        merged = {}
        for event in all_events + chapel_events:
            key = _event_key(event['url'])
            if key not in merged:
                event['is_chapel'] = key in chapel_keys
                event['is_athletics'] = key in athletics_keys
                merged[key] = event

        events = sorted(merged.values(), key=lambda e: (e['start'] is None, e['start'] or ''))
        logging.info(f"Events scrape complete: {len(events)} unique events "
                     f"({len(chapel_keys)} chapels, {len(athletics_keys)} athletics).")
        return {'events': events, 'source': 'events_search'}

    except Exception as e:
        logging.error(f"Events search scrape failed ({e}). Falling back to chapel page.")

    try:
        chapel_only = _scrape_chapel_page()
        chapel_only.sort(key=lambda e: (e['start'] is None, e['start'] or ''))
        return {'events': chapel_only, 'source': 'chapel_page'}
    except Exception as e:
        logging.error(f"Chapel fallback scrape also failed: {e}")
        return {'events': [], 'source': 'none'}


if __name__ == '__main__':
    import json
    data = get_events_data()
    print(json.dumps(data, indent=2))
    print(f"\nTotal: {len(data['events'])} events from source '{data['source']}'")
