import requests
from bs4 import BeautifulSoup
import json
import re
import logging

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

# --- Function to Find the Print Menu URL ---
def find_print_menu_url(page_url: str, pattern: str) -> str | None:
    """
    Fetches a web page and searches for a URL matching the given pattern.

    Args:
        page_url (str): The URL of the page to scrape for the link.
        pattern (str): The regex pattern to search for the target URL.

    Returns:
        str | None: The found URL if successful, otherwise None.
    """
    logging.info(f"Attempting to find print menu URL on: {page_url}")
    try:
        # Send an HTTP GET request to the target URL
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
        }
        response = requests.get(page_url, headers=headers, timeout=15) # Increased timeout slightly
        response.raise_for_status() # Check for HTTP errors
        html_content = response.text

        # Find the URL using the regular expression
        match = re.search(pattern, html_content)

        if match:
            extracted_url = match.group(0)
            logging.info(f"Successfully found print menu URL: {extracted_url}")
            return extracted_url
        else:
            logging.error(f"Could not find the URL pattern '{pattern}' on page: {page_url}")
            return None

    except requests.exceptions.Timeout:
        logging.error(f"Timeout occurred while fetching URL: {page_url}")
        return None
    except requests.exceptions.RequestException as e:
        logging.error(f"Error fetching URL {page_url}: {e}")
        return None
    except Exception as e:
        logging.error(f"An unexpected error occurred while finding the URL: {e}")
        return None

# --- Function to Scrape the Menu (Unchanged Logic) ---
def _scrape_structured_menu(url: str, target_stations: list) -> dict:
    """
    Internal function to scrape menu data and organize by meal period/station.
    (Scraping logic remains unchanged as requested)

    Args:
        url (str): The URL of the print menu page.
        target_stations (list): A list of station names (case-insensitive) to scrape.

    Returns:
        dict: A dictionary representing the structured menu data, or an empty dict on error.
              Example: {'BREAKFAST': {'Station1': [{'meal': 'MealA', 'description': 'DescA'}, ...], ...}, ...}
    """
    normalized_target_stations = set(
        re.sub(r'[^a-z0-9]', '', station.lower()) for station in target_stations
    )

    structured_menu = {}
    current_meal_period = "Unknown Meal Period" # Default in case the first element isn't a daypart

    try:
        # Use a reasonable timeout for the menu page request
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        logging.info(f"Successfully fetched menu page: {url}")
    except requests.exceptions.Timeout:
        logging.error(f"Timeout occurred while fetching menu URL: {url}")
        return {} # Return empty dict on timeout
    except requests.exceptions.RequestException as e:
        logging.error(f"Failed to retrieve menu URL {url}: {e}")
        return {} # Return empty dict on other request errors

    soup = BeautifulSoup(response.content, 'html.parser')

    # Try finding the main content area with common IDs/classes
    menu_content_area = soup.find('div', id='menu-items') or soup.find('div', class_='main daily')

    if not menu_content_area:
        logging.warning("Could not find the main menu content area (id='menu-items' or class_='main daily').")
        # Fallback: try finding a common parent if the structure is different
        # This might need adjustment based on actual page structure variations
        menu_content_area = soup.find('body') # As a last resort, search the whole body
        if not menu_content_area:
             logging.error("Completely unable to find any menu content area. Aborting scrape.")
             return {}

    # Select potential elements containing meal periods or menu items
    # Look for daypart divs or row divs which are common structures
    potential_elements = menu_content_area.select('.daypart, .row.even, .row.odd')
    if not potential_elements:
         # Fallback if the select pattern doesn't work (e.g., structure changed)
         # Look for direct children divs within the content area
         potential_elements = menu_content_area.find_all(['div', 'h2'], recursive=False) # Include H2 for potential meal period headers
         logging.info(f"Using fallback to find elements, found: {len(potential_elements)} potential elements.")


    for element in potential_elements:
        # --- Check for Meal Period Header ---
        # Original check for 'daypart' class
        is_daypart = 'daypart' in element.get('class', [])
        day_spacer = element.find('div', class_='spacer day') if is_daypart else None

        # Alternative check (e.g., looking for H2 tags like "BREAKFAST", "LUNCH")
        is_meal_header_tag = element.name == 'h2' and element.get_text(strip=True).upper() in ['BREAKFAST', 'LUNCH', 'DINNER', 'BRUNCH']

        if day_spacer: # Found via original 'daypart' structure
            current_meal_period = day_spacer.get_text(strip=True).upper() # Normalize to uppercase
            logging.debug(f"Found Meal Period (via daypart): {current_meal_period}")
            continue # Move to the next element
        elif is_meal_header_tag: # Found via H2 tag
            current_meal_period = element.get_text(strip=True).upper() # Normalize to uppercase
            logging.debug(f"Found Meal Period (via H2): {current_meal_period}")
            continue # Move to the next element

        # --- Check for Menu Item Row ---
        # Check if it's a row using class (original method)
        is_row = 'row' in element.get('class', [])
        # Fallback check: look for station name within the element if not explicitly a 'row'
        station_span = element.find('span', class_='stationname') if is_row else element.find('div', class_='stationname') # Allow div too

        if station_span: # Found a potential station
            station_name = station_span.get_text(strip=True)
            normalized_station = re.sub(r'[^a-z0-9]', '', station_name.lower())

            # Check if this station is one we want to scrape
            if normalized_station in normalized_target_stations:
                logging.debug(f"Processing target station: {station_name} under {current_meal_period}")

                # Initialize structure if not present
                if current_meal_period not in structured_menu:
                    structured_menu[current_meal_period] = {}
                if station_name not in structured_menu[current_meal_period]:
                    structured_menu[current_meal_period][station_name] = []

                # Find the description part of the row/element
                description_div = element.find('div', class_='description')
                if not description_div:
                     logging.warning(f"No 'description' div found for station: {station_name}")
                     continue # Skip if no description area

                # Find individual meal items within the description area
                items = description_div.find_all(['div', 'p'], class_='item') # Look for div or p with class 'item'
                if not items:
                    # Fallback: Sometimes items are just <p> tags directly inside description
                    items = description_div.find_all('p', recursive=False)
                    if not items:
                       logging.warning(f"No items found (class='item' or direct p) in description for station: {station_name}")
                       continue # Skip station if no items found

                for item in items:
                    # Find the primary text element, usually a <p> tag
                    p_tag = item if item.name == 'p' else item.find('p')
                    if not p_tag:
                        # Sometimes the item itself might contain the text directly
                        if item.get_text(strip=True):
                           p_tag = item # Treat the item div/p as the p_tag
                        else:
                           logging.debug(f"Skipping item without p_tag or direct text content in station {station_name}")
                           continue

                    meal_name = "Unknown Item"
                    strong_tag = p_tag.find('strong') # Meal name often in <strong>
                    text_content = p_tag.get_text(separator=' ', strip=True) # Full text for fallback/description extraction

                    # --- Extract Meal Name ---
                    if strong_tag:
                         # Get text from strong tag, remove potential pricing/icons after a pipe |
                         meal_name = strong_tag.get_text(strip=True)
                         meal_name = re.split(r'\s*\|', meal_name, 1)[0].strip()
                    elif text_content:
                         # Fallback: use the start of the text content before known delimiters
                         # Delimiters: COR icons span, price div, pipe symbol |
                         meal_name = re.split(r'\s*(?:<span class="cafeCorIcons">|<div class="price">|\|)', text_content, 1)[0].strip()
                         # Clean up any remaining pipe split remnants (just in case)
                         meal_name = re.split(r'\s*\|', meal_name, 1)[0].strip()

                    # --- Extract Description (if available) ---
                    description = None
                    # Look for specific 'sides' span
                    sides_span = p_tag.find('span', class_='sides collapsed') or p_tag.find('span', class_='sides')
                    if sides_span:
                        desc_text = sides_span.get_text(strip=True)
                        # Remove common prefixes like 'with:', 'side:'
                        desc_text = re.sub(r'^(with|side:)\s+', '', desc_text, flags=re.IGNORECASE)
                        description = desc_text if desc_text else None # Assign only if not empty
                    elif meal_name != "Unknown Item" and meal_name != "":
                         # Fallback: Take text after the meal name, before icons/price
                         # Replace only the *first* occurrence of meal_name to avoid issues if meal name appears in description
                         potential_desc = text_content.replace(meal_name, '', 1).strip()
                         # Remove content starting from known delimiters
                         potential_desc = re.split(r'\s*(?:<span class="cafeCorIcons">|<div class="price">)', potential_desc, 1)[0].strip()
                         # Remove leading separators like '|' or '-'
                         potential_desc = re.sub(r'^\s*[\|-]\s*', '', potential_desc).strip()
                         # Remove common prefixes
                         potential_desc = re.sub(r'^(with|side:)\s+', '', potential_desc, flags=re.IGNORECASE)
                         # Basic validation: ensure it's not empty, not just noise (e.g., > 2 chars), and different from the meal name itself
                         if potential_desc and len(potential_desc) > 2 and potential_desc.lower() != meal_name.lower():
                             description = potential_desc

                    # Add the found meal/description to the structure
                    if meal_name != "Unknown Item" and meal_name != "":
                         structured_menu[current_meal_period][station_name].append({
                             "meal": meal_name,
                             "description": description # Will be None if no description found
                         })
                    else:
                         logging.debug(f"Skipped item with unknown name in station {station_name}")

    if not structured_menu:
        logging.warning("Scraping finished, but no items found for target stations.")
    else:
        logging.info(f"Scraping finished. Found data for meal periods: {list(structured_menu.keys())}")

    return structured_menu


# --- Main Function to Get and Format Data ---
def get_menu_data_for_template() -> dict:
    """
    Finds the print menu URL, scrapes it, and transforms the data.
    Keeps both 'meal' and optional 'description' for every option.

    Returns:
        dict: Formatted menu data suitable for templates.
    """
    template_data = {'breakfast': [], 'lunch': [], 'dinner': []} # Ensure keys match expected template keys

    # 1. Find the dynamic print menu URL
    print_menu_url = find_print_menu_url(BIOLA_CAFE_PAGE_URL, PRINT_MENU_URL_PATTERN)

    if not print_menu_url:
        logging.error("Could not find the print menu URL. Cannot proceed with scraping.")
        return template_data # Return empty structure

    # 2. Scrape the menu using the found URL
    # Pass the dynamically found URL and target stations to the scraping function
    scraped = _scrape_structured_menu(print_menu_url, TARGET_STATIONS)

    if not scraped:
        logging.warning("No data scraped from the menu page, returning empty structure.")
        return template_data

    # 3. Transform the scraped data for the template
    for meal_period, stations in scraped.items():
        # Map scraped period (e.g., "BREAKFAST") to template key (e.g., "breakfast")
        period_key = meal_period.lower()
        if period_key not in template_data:
            # Handle cases like "BRUNCH" if needed, or log as unknown
            if period_key == "brunch":
                 # Decide where Brunch items should go, e.g., add to both Breakfast and Lunch?
                 # Or maybe create a separate 'brunch' key if template supports it.
                 # For now, let's log and potentially skip or add to lunch.
                 logging.info(f"Found 'BRUNCH' period. Assigning items to 'lunch'.")
                 period_key = 'lunch' # Example: Assign brunch items to lunch
            else:
                 logging.warning(f"Skipping unknown meal period from scrape: {meal_period}")
                 continue

        for station_name, meal_items in stations.items():
            # Filter out unwanted text and ensure meal name is valid
            filtered_options = []
            for item in meal_items:
                 meal_name = item.get('meal')
                 if meal_name and meal_name != "Unknown Item" and meal_name.lower().strip() != UNWANTED_MEAL_TEXT:
                     filtered_options.append({
                         'meal': meal_name,
                         'description': item.get('description') # Keep description (will be None if not present)
                     })

            # Add station and its filtered options if any options remain
            if filtered_options:
                template_data[period_key].append({
                    'name': station_name,
                    'options': filtered_options
                })

    logging.info("Menu data transformation complete.")
    return template_data

# --- Execution Block ---
if __name__ == "__main__":
    # Call the main function and print the resulting JSON
    final_menu_data = get_menu_data_for_template()
    print(json.dumps(final_menu_data, indent=2))