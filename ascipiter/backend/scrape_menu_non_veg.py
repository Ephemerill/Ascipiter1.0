import requests
from bs4 import BeautifulSoup, NavigableString
import json
import re
import logging
from difflib import SequenceMatcher

# --- Configuration ---
# Configure basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# The URL of the page where the print menu link is located
BIOLA_CAFE_PAGE_URL = "https://cafebiola.cafebonappetit.com/cafe/cafe-biola/"

# The pattern to find the specific print menu URL on the BIOLA_CAFE_PAGE_URL
PRINT_MENU_URL_PATTERN = r"https://legacy\.cafebonappetit\.com/print-menu/cafe/17/menu/\d+/days/today/pgbrks/0/"

# Stations to target for scraping (case-insensitive matching)
TARGET_STATIONS = [
    "Kettle", "Chefs Table", "CHEF'S TABLE",
    "6th st grill", "6TH ST. GRILL",
    "home cookin", "HOME COOKIN'",
    "Pizzeria"
]

# Specific text to filter out from meal names
UNWANTED_MEAL_TEXT = "vegan and made without gluten pizza available upon request"

# --- Helper Functions ---

def find_print_menu_url(page_url: str, pattern: str) -> str | None:
    """
    Fetches a web page and searches for a URL matching the given pattern.
    """
    logging.info(f"Attempting to find print menu URL on: {page_url}")
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
        }
        response = requests.get(page_url, headers=headers, timeout=15)
        response.raise_for_status()
        html_content = response.text

        match = re.search(pattern, html_content)

        if match:
            extracted_url = match.group(0)
            logging.info(f"Successfully found print menu URL: {extracted_url}")
            return extracted_url
        else:
            logging.error(f"Could not find the URL pattern '{pattern}' on page: {page_url}")
            return None

    except Exception as e:
        logging.error(f"An unexpected error occurred while finding the URL: {e}")
        return None

# Words that identify a dish as containing meat (checked in name and description).
MEAT_WORDS = {
    'chicken', 'beef', 'pork', 'bacon', 'ham', 'turkey', 'sausage', 'steak',
    'carnitas', 'carne', 'asada', 'barbacoa', 'birria', 'pastrami', 'salami',
    'pepperoni', 'prosciutto', 'chorizo', 'brisket', 'meatball', 'meatloaf',
    'meat', 'cheesesteak', 'pollo', 'lamb', 'duck', 'veal', 'gyro', 'pastor',
    'fish', 'salmon', 'tuna', 'shrimp', 'cod', 'tilapia', 'mahi', 'crab',
    'clam', 'calamari', 'anchovy', 'sardine', 'lobster', 'oyster', 'scallop',
}

# Words that explicitly mark a dish as the vegetarian substitute for a meat dish.
STRONG_VEG_MARKERS = {
    'tofu', 'jackfruit', 'beyond', 'impossible', 'meatless', 'vegan',
    'vegetarian', 'veggie', 'tempeh', 'seitan', 'soyrizo', 'plant',
}

# Additional swappable "proteins" that get stripped before comparing names,
# so "mushroom fajita pasta" lines up with "chicken fajita pasta".
SWAPPABLE_PROTEIN_WORDS = MEAT_WORDS | STRONG_VEG_MARKERS | {
    'mushroom', 'portobello', 'cauliflower', 'chickpea', 'garbanzo',
    'lentil', 'falafel', 'paneer', 'plant', 'based', 'vegetable',
    'vegetables', 'garden',
}

COMPARE_STOP_WORDS = {'with', 'and', 'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'or', 'for'}

# Faux-meat phrases are removed before scanning for meat words so that
# "plant-based sausage" or "veggie patty" don't read as meat.
FAUX_MEAT_PHRASES = re.compile(
    r'\b(?:plant[- ]based|veggie|vegan|vegetarian|meatless|beyond|impossible)\s+\w+', re.IGNORECASE)


def _normalize(text):
    return re.sub(r'[^\w\s]', ' ', text.lower().replace('-', ' '))


def _contains_meat(item):
    """True if the item's name or description mentions real meat."""
    text = f"{item.get('meal') or ''} {item.get('description') or ''}"
    text = FAUX_MEAT_PHRASES.sub(' ', text)
    tokens = set(_normalize(text).split())
    return bool(tokens & MEAT_WORDS)


def _has_strong_marker(name):
    """True if the meal name itself is labeled as a vegetarian substitute."""
    return bool(set(_normalize(name).split()) & STRONG_VEG_MARKERS)


def _stripped_name(name):
    """Meal name with proteins/markers and filler words removed, for comparison."""
    tokens = [w for w in _normalize(name).split()
              if w not in COMPARE_STOP_WORDS and w not in SWAPPABLE_PROTEIN_WORDS]
    return ' '.join(tokens)


def _is_variant_of(veg_name, other_name):
    """
    True if two meals are the same dish once the swapped protein is removed,
    e.g. 'kalua jackfruit' vs 'kalua pork', 'coconut green curry with tofu'
    vs 'coconut yellow curry with chicken'. A single shared generic word
    ('pizza', 'soup') is NOT enough.
    """
    a = _stripped_name(veg_name)
    b = _stripped_name(other_name)
    if a == b:
        return True  # pure protein swap (also covers both stripping to '')
    if not a or not b:
        return False
    if set(a.split()) == set(b.split()):
        return True
    return SequenceMatcher(None, a, b).ratio() >= 0.72


def filter_vegetarian_items(station_items):
    """
    Filters out vegetarian items that are substitutes for meat dishes at the
    same station. Distinct vegetarian dishes (a soup, a specialty pizza) are
    kept; only protein-swapped twins and explicitly labeled substitutes go.
    """
    meaty_items = [item for item in station_items if _contains_meat(item)]
    # Counterpart pool for duplicate checks: anything not itself labeled a substitute
    counterpart_items = [item for item in station_items if not _has_strong_marker(item['meal'])]

    final_items = []
    for item in station_items:
        name = item['meal']

        # Never drop something that clearly contains meat, even if mis-flagged.
        # The site's vegetarian icons are unreliable (often missing), so
        # meat-free is determined from the words, not the is_veg flag.
        if _contains_meat(item):
            final_items.append(item)
            continue

        if _has_strong_marker(name):
            # Explicit substitute ("kalua jackfruit", "vegetarian cheese pizza"):
            # drop when the station serves meat, or when the non-substitute
            # version of the same dish is also on the menu.
            has_duplicate = any(other is not item and _is_variant_of(name, other['meal'])
                                for other in counterpart_items)
            if meaty_items or has_duplicate:
                continue
        else:
            # Unlabeled meat-free item: only drop if it is a protein-swapped
            # twin of an actual meat dish ("mushroom fajita pasta" vs
            # "chicken fajita pasta").
            if any(_is_variant_of(name, meaty['meal']) for meaty in meaty_items):
                continue

        final_items.append(item)

    # Safety net: never empty out a station entirely
    return final_items if final_items else station_items

# --- Helpers for the current (2026) print-menu layout ---
def _matches_target_station(station_name: str, normalized_target_stations: set) -> bool:
    """Check a station name against the normalized targets (exact or prefix match)."""
    normalized = re.sub(r'[^a-z0-9]', '', station_name.lower())
    return any(normalized == target or normalized.startswith(target)
               for target in normalized_target_stations)


def _clean_station_name(station_name: str) -> str:
    """Strip a trailing meal period the new layout appends (e.g. "CHEF'S TABLE BREAKFAST")."""
    return re.sub(r'\s+(BREAKFAST|LUNCH|DINNER|BRUNCH)\s*$', '', station_name,
                  flags=re.IGNORECASE).strip()


def _parse_item_paragraph(p_tag) -> dict | None:
    """
    Parse one menu item <p>. In the new layout the meal name is the leading text,
    followed by an optional <span class="sides"> description and icon <img> tags
    whose alt/title mark vegetarian/vegan items.
    """
    # Meal name = text nodes before the first child tag
    name_parts = []
    for child in p_tag.children:
        if isinstance(child, NavigableString):
            name_parts.append(str(child))
        else:
            break
    meal_name = re.sub(r'\s+', ' ', ''.join(name_parts)).strip()

    if not meal_name:
        # Older layout kept the name in a <strong> tag
        strong_tag = p_tag.find('strong')
        if strong_tag:
            meal_name = re.split(r'\s*\|', strong_tag.get_text(strip=True), 1)[0].strip()
    if not meal_name:
        return None

    description = None
    sides_span = p_tag.find('span', class_='sides')
    if sides_span:
        desc_text = re.sub(r'\s+', ' ', sides_span.get_text(' ', strip=True))
        desc_text = re.sub(r'^(with|side:)\s+', '', desc_text, flags=re.IGNORECASE)
        description = desc_text if desc_text else None

    is_veg = False
    for img in p_tag.find_all('img'):
        label = (img.get('title', '') + ' ' + img.get('alt', '')).lower()
        if 'vegetarian' in label or 'vegan' in label:
            is_veg = True
            break

    return {"meal": meal_name, "description": description, "is_veg": is_veg}


def _parse_meal_type_sections(day_sections, normalized_target_stations) -> dict:
    """
    Parse the new print-menu layout: one div.meal-types per meal period, each
    holding div.row entries. A row's div.eni-menu-station names the station;
    follow-up rows for the same station leave it empty, so carry it forward.
    """
    structured_menu = {}
    for section in day_sections:
        day_spacer = section.find('div', class_='day')
        meal_period = day_spacer.get_text(strip=True).upper() if day_spacer else "Unknown Meal Period"
        current_station = None

        for row in section.find_all('div', class_='row'):
            station_div = row.find('div', class_='eni-menu-station')
            if station_div:
                station_text = station_div.get_text(' ', strip=True)
                if station_text:
                    current_station = _clean_station_name(station_text)

            if not current_station or not _matches_target_station(current_station, normalized_target_stations):
                continue

            description_div = row.find('div', class_='description')
            if not description_div:
                continue

            for item in description_div.find_all('div', class_='item'):
                p_tag = item.find('p') or item
                parsed = _parse_item_paragraph(p_tag)
                if parsed:
                    structured_menu.setdefault(meal_period, {}) \
                                   .setdefault(current_station, []) \
                                   .append(parsed)
    return structured_menu


# --- Function to Scrape the Menu ---
def _scrape_structured_menu(url: str, target_stations: list) -> dict:
    normalized_target_stations = set(
        re.sub(r'[^a-z0-9]', '', station.lower()) for station in target_stations
    )

    structured_menu = {}
    current_meal_period = "Unknown Meal Period"

    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
    except Exception as e:
        logging.error(f"Failed to retrieve menu URL {url}: {e}")
        return {}

    soup = BeautifulSoup(response.content, 'html.parser')
    menu_content_area = soup.find('div', id='menu-items') or soup.find('div', class_='main daily') or soup.find('body')

    if not menu_content_area:
        return {}

    # --- New layout (2026): meal periods live in div.meal-types sections ---
    day_sections = menu_content_area.find_all('div', class_='meal-types')
    if day_sections:
        logging.info(f"Detected new print-menu layout ({len(day_sections)} meal period sections).")
        return _parse_meal_type_sections(day_sections, normalized_target_stations)

    # --- Legacy layout fallback ---
    potential_elements = menu_content_area.select('.daypart, .row.even, .row.odd')
    if not potential_elements:
        potential_elements = menu_content_area.find_all(['div', 'h2'], recursive=False)

    for element in potential_elements:
        # --- Check for Meal Period Header ---
        is_daypart = 'daypart' in element.get('class', [])
        day_spacer = element.find('div', class_='spacer day') if is_daypart else None
        is_meal_header_tag = element.name == 'h2' and element.get_text(strip=True).upper() in ['BREAKFAST', 'LUNCH', 'DINNER', 'BRUNCH']

        if day_spacer:
            current_meal_period = day_spacer.get_text(strip=True).upper()
            continue
        elif is_meal_header_tag:
            current_meal_period = element.get_text(strip=True).upper()
            continue

        # --- Check for Menu Item Row ---
        is_row = 'row' in element.get('class', [])
        station_span = element.find('span', class_='stationname') if is_row else element.find('div', class_='stationname')

        if station_span:
            station_name = station_span.get_text(strip=True)
            normalized_station = re.sub(r'[^a-z0-9]', '', station_name.lower())

            if normalized_station in normalized_target_stations:
                if current_meal_period not in structured_menu:
                    structured_menu[current_meal_period] = {}
                if station_name not in structured_menu[current_meal_period]:
                    structured_menu[current_meal_period][station_name] = []

                description_div = element.find('div', class_='description')
                if not description_div:
                    continue

                items = description_div.find_all(['div', 'p'], class_='item')
                if not items:
                    items = description_div.find_all('p', recursive=False)

                for item in items:
                    p_tag = item if item.name == 'p' else item.find('p')
                    if not p_tag:
                        if item.get_text(strip=True):
                            p_tag = item
                        else:
                            continue

                    meal_name = "Unknown Item"
                    strong_tag = p_tag.find('strong')
                    text_content = p_tag.get_text(separator=' ', strip=True)

                    if strong_tag:
                        meal_name = strong_tag.get_text(strip=True)
                        meal_name = re.split(r'\s*\|', meal_name, 1)[0].strip()
                    elif text_content:
                        meal_name = re.split(r'\s*(?:<span class="cafeCorIcons">|<div class="price">|\|)', text_content, 1)[0].strip()
                        meal_name = re.split(r'\s*\|', meal_name, 1)[0].strip()

                    # --- Detect Vegetarian/Vegan Status ---
                    is_veg = False
                    icons_span = p_tag.find('span', class_='cafeCorIcons')
                    if icons_span:
                        # Check for vegetarian or vegan images/classes
                        # Based on Caf-samp.html: <img class="tipbox vegan" ...> or <img class="tipbox vegetarian" ...>
                        if icons_span.find('img', class_='vegan') or icons_span.find('img', class_='vegetarian'):
                            is_veg = True
                        # Also check title attribute just in case class is missing but title is there
                        for img in icons_span.find_all('img'):
                            title = img.get('title', '').lower()
                            alt = img.get('alt', '').lower()
                            if 'vegetarian' in title or 'vegan' in title or 'vegetarian' in alt or 'vegan' in alt:
                                is_veg = True

                    # --- Extract Description ---
                    description = None
                    sides_span = p_tag.find('span', class_='sides collapsed') or p_tag.find('span', class_='sides')
                    if sides_span:
                        desc_text = sides_span.get_text(strip=True)
                        desc_text = re.sub(r'^(with|side:)\s+', '', desc_text, flags=re.IGNORECASE)
                        description = desc_text if desc_text else None
                    elif meal_name != "Unknown Item" and meal_name != "":
                        potential_desc = text_content.replace(meal_name, '', 1).strip()
                        potential_desc = re.split(r'\s*(?:<span class="cafeCorIcons">|<div class="price">)', potential_desc, 1)[0].strip()
                        potential_desc = re.sub(r'^\s*[\|-]\s*', '', potential_desc).strip()
                        potential_desc = re.sub(r'^(with|side:)\s+', '', potential_desc, flags=re.IGNORECASE)
                        if potential_desc and len(potential_desc) > 2 and potential_desc.lower() != meal_name.lower():
                            description = potential_desc

                    if meal_name != "Unknown Item" and meal_name != "":
                        structured_menu[current_meal_period][station_name].append({
                            "meal": meal_name,
                            "description": description,
                            "is_veg": is_veg
                        })

    return structured_menu


# --- Main Function to Get and Format Data ---
def get_non_veg_menu_data() -> dict:
    """
    Finds the print menu URL, scrapes it, and transforms the data, 
    filtering out vegetarian versions of meals.
    """
    template_data = {'breakfast': [], 'lunch': [], 'dinner': []}

    print_menu_url = find_print_menu_url(BIOLA_CAFE_PAGE_URL, PRINT_MENU_URL_PATTERN)

    if not print_menu_url:
        logging.error("Could not find the print menu URL.")
        return template_data

    scraped = _scrape_structured_menu(print_menu_url, TARGET_STATIONS)

    if not scraped:
        return template_data

    for meal_period, stations in scraped.items():
        period_key = meal_period.lower()
        if period_key not in template_data:
            if period_key == "brunch":
                period_key = 'lunch'
            else:
                continue

        for station_name, meal_items in stations.items():
            # 1. Filter out unwanted text (generic cleanup)
            valid_items = []
            for item in meal_items:
                meal_name = item.get('meal')
                if meal_name and meal_name != "Unknown Item" and meal_name.lower().strip() != UNWANTED_MEAL_TEXT:
                    # Filter out specific gluten-free/request-based items
                    lower_name = meal_name.lower()
                    if "made without gluten" in lower_name and "available upon request" in lower_name:
                        continue
                    valid_items.append(item)
            
            # 2. Apply Vegetarian Filter Logic
            filtered_items = filter_vegetarian_items(valid_items)
            
            # 3. Format for template (remove is_veg flag if not needed, or keep it)
            final_options = []
            for item in filtered_items:
                final_options.append({
                    'meal': item['meal'],
                    'description': item['description']
                })

            if final_options:
                template_data[period_key].append({
                    'name': station_name,
                    'options': final_options
                })

    logging.info("Non-Veg Menu data transformation complete.")
    return template_data

if __name__ == "__main__":
    final_menu_data = get_non_veg_menu_data()
    print(json.dumps(final_menu_data, indent=2))
