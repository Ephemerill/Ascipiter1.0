import requests
from bs4 import BeautifulSoup
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

def is_similar(a, b, threshold=0.6):
    """Check if two strings are similar."""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio() > threshold

def share_significant_word(a, b):
    """Check if two strings share a significant word (ignoring common stop words)."""
    stop_words = {'with', 'and', 'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'available', 'upon', 'request'}
    
    # Clean and tokenize
    def tokenize(text):
        text = re.sub(r'[^\w\s]', '', text.lower())
        return set([w for w in text.split() if w not in stop_words and len(w) > 2])

    tokens_a = tokenize(a)
    tokens_b = tokenize(b)
    
    # Check intersection
    intersection = tokens_a.intersection(tokens_b)
    return len(intersection) > 0

def filter_vegetarian_items(station_items):
    """
    Filters out vegetarian items if they are likely versions of non-vegetarian items in the same list.
    """
    non_veg_items = [item for item in station_items if not item.get('is_veg')]
    veg_items = [item for item in station_items if item.get('is_veg')]

    # If no non-veg items exist, keep everything (e.g. a salad station)
    if not non_veg_items:
        return station_items

    final_items = non_veg_items[:]
    
    for v_item in veg_items:
        is_version = False
        v_name = v_item['meal']
        
        # Check against all non-veg items
        for nv_item in non_veg_items:
            nv_name = nv_item['meal']
            
            # Criteria 1: Strong keywords indicating a substitute
            if "beyond" in v_name.lower() or "plant-based" in v_name.lower() or "tofu" in v_name.lower():
                # If there's a meat option, assume this is the veg alternative
                is_version = True
                break
            
            # Criteria 2: Shared significant words (e.g. "Mole", "Pizza", "Burger")
            if share_significant_word(v_name, nv_name):
                is_version = True
                break
                
        if not is_version:
            final_items.append(v_item)
            
    return final_items

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
