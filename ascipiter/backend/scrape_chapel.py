# backend/scrape_chapel.py

import requests
from bs4 import BeautifulSoup
from datetime import datetime # Import the datetime module

def get_chapel_events():
    """
    Scrapes chapel events from the Biola University website and returns them 
    as a list of dictionaries.
    """
    url = 'https://www.biola.edu/chapel'
    chapel_events = []
    
    # Get the current year to append to the date string
    current_year = datetime.now().year

    try:
        # --- FIX: Added a 15-second timeout to prevent the app from hanging ---
        response = requests.get(url, timeout=15)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')
        event_lists = soup.find_all('ul', class_='chapel-list')

        for event_list in event_lists:
            events = event_list.find_all('li')
            for event in events:
                time_tag = event.find('div', class_='datetime')
                raw_time_text = time_tag.get_text(separator=' ').strip().replace('\n', ' ') if time_tag else 'Time not available'
                
                # Clean up multiple spaces and add the year to create a full date string
                if raw_time_text != 'Time not available':
                    cleaned_time_text = ' '.join(raw_time_text.split()) # Normalizes whitespace
                    parts = cleaned_time_text.split()
                    
                    # Reconstruct the string with the current year and "at" for reliable parsing
                    if len(parts) > 2:
                        time = f"{parts[0]} {parts[1]} {parts[2]}, {current_year} at {' '.join(parts[3:])}"
                    else:
                        time = 'Time not available'
                else:
                    time = 'Time not available'

                title_tag = event.find('h3', class_='title')
                title = title_tag.get_text().strip() if title_tag else 'Title not available'

                description_tag = event.find('h4', class_='subtitle')
                description = description_tag.get_text().strip() if description_tag else 'No description'

                chapel_events.append({
                    'title': title,
                    'description': description,
                    'time': time
                })
                
        return chapel_events

    except requests.exceptions.RequestException as e:
        print(f"An error occurred while scraping chapel events: {e}")
        return []

if __name__ == '__main__':
    events = get_chapel_events()
    import json
    print(json.dumps(events, indent=4))