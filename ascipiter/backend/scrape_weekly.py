import requests
from bs4 import BeautifulSoup
import json

def find_weekly_menu_url(page_url):
    """
    Scrapes the main cafe page to find the dynamic weekly menu URL.
    
    Args:
        page_url (str): The URL of the main cafe page to search.
        
    Returns:
        str or None: The found weekly menu URL, or None if it could not be found.
    """
    print(f"Searching for weekly menu link on: {page_url}...")
    try:
        # Set a user-agent to mimic a browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
        }
        response = requests.get(page_url, headers=headers, timeout=10)
        response.raise_for_status() # Raise an error for bad status codes
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Find the <a> tag that contains the text "View/Print Weekly Menu"
        menu_link = soup.find('a', string='View/Print Weekly Menu')
        
        if menu_link and 'href' in menu_link.attrs:
            url = menu_link['href']
            print(f"Successfully found weekly menu URL: {url}")
            return url
        else:
            print("Error: Could not find the 'View/Print Weekly Menu' link on the page.")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"Error: Could not fetch the main cafe page.")
        print(f"Details: {e}")
        return None

def scrape_weekly_menu(url):
    """
    Scrapes the weekly menu from the given URL and returns a sorted dictionary of meals.
    """
    print(f"\nFetching menu from: {url}...")
    try:
        # Set a user-agent to mimic a browser, which can help prevent getting blocked
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        # This will raise an error if the request was unsuccessful (e.g., 404 Not Found)
        response.raise_for_status()
        print("Successfully fetched the webpage.")
    except requests.exceptions.RequestException as e:
        print(f"Error: Could not fetch the URL. Please check the address and your connection.")
        print(f"Details: {e}")
        return None

    soup = BeautifulSoup(response.content, 'html.parser')

    # --- Data structure and mapping setup ---
    days_order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    meal_periods_order = ["Breakfast", "Lunch", "Dinner"]
    meal_period_map = {'B': 'Breakfast', 'L': 'Lunch', 'D': 'Dinner'}

    # Normalize station names for easier matching
    important_stations = {
        "home cookin'": "Home Cookin'",
        "chef's table": "Chef's Table",
        "6th st. grill": "6th St. Grill",
        "pizzeria": "Pizzeria",
        "kettle": "Kettle"
    }
    # Create a set of lowercase, punctuation-free names for quick lookups
    important_stations_lookup = {name.lower().replace('.', '').replace("'", "") for name in important_stations.keys()}

    weekly_menu = {day: {period: {} for period in meal_periods_order} for day in days_order}

    # --- Parsing Logic ---
    # Get the actual day headers from the HTML (e.g., Mon, Tue...)
    header_days = [day.text.strip() for day in soup.select('div.weekdays.header > div.day') if day.text.strip()]
    if not header_days:
        print("Error: Could not find day headers in the HTML. The page structure may have changed.")
        return None

    # Find all the rows which represent the meal stations
    for row in soup.find_all('div', class_='row'):
        station_name_element = row.find('span', class_='stationname')
        if not station_name_element:
            continue

        station_name_raw = station_name_element.text.strip()
        station_name_normalized = station_name_raw.lower().replace('.', '').replace("'", "")

        if station_name_normalized in important_stations_lookup:
            # The properly formatted name for the output
            station_key = important_stations.get(station_name_raw.lower(), station_name_raw)

            daily_menus = row.find_all('div', class_='cell_menu_item')
            for i, daily_menu in enumerate(daily_menus):
                if i < len(header_days):
                    day_of_week = header_days[i]

                    for menu_item in daily_menu.find_all('div', class_='menu-item'):
                        meal_name_element = menu_item.find('span', class_='weelydesc')
                        daypart_abbr_element = menu_item.find('span', class_='daypart-abbr')

                        if meal_name_element and daypart_abbr_element:
                            meal_name = meal_name_element.text.strip()
                            daypart_text = daypart_abbr_element.text.strip().replace('[', '').replace(']', '')
                            meal_letters = [letter.strip() for letter in daypart_text.split(',')]

                            for letter in meal_letters:
                                meal_period = meal_period_map.get(letter)
                                if meal_period:
                                    if station_key not in weekly_menu[day_of_week][meal_period]:
                                        weekly_menu[day_of_week][meal_period][station_key] = []
                                    weekly_menu[day_of_week][meal_period][station_key].append(meal_name)

    # Clean up empty days or meal periods from the final dictionary
    final_menu = {}
    for day, periods in weekly_menu.items():
        day_data = {}
        for period, stations in periods.items():
            if stations:  # Only add meal periods that have stations with food
                day_data[period] = stations
        if day_data:  # Only add days that have meals
            final_menu[day] = day_data

    return final_menu

if __name__ == '__main__':
    # 1. Define the main page where the dynamic link is located
    cafe_page_url = "https://cafebiola.cafebonappetit.com/cafe/cafe-biola/"
    
    # 2. Dynamically find the correct weekly menu URL from that page
    weekly_url = find_weekly_menu_url(cafe_page_url)

    # 3. If a URL was found, proceed with scraping
    if weekly_url:
        menu = scrape_weekly_menu(weekly_url)
        
        if menu:
            print("\n--- Weekly Menu ---")
            # Print the final dictionary as a nicely formatted JSON string
            print(json.dumps(menu, indent=4))
            print("\nScript finished successfully.")
        else:
            print("\nCould not generate the menu from the found URL. Please check the errors above.")
    else:
        print("\nFailed to find the weekly menu URL. Aborting script.")