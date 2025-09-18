import requests
from bs4 import BeautifulSoup

def get_chapel_events():
    """
    Scrapes chapel events from the Biola University website and returns them 
    as a list of dictionaries.
    """
    # URL of the chapel schedule to be scraped
    url = 'https://www.biola.edu/chapel'
    
    # This list will store the dictionaries of event data
    chapel_events = []

    try:
        # Send a GET request to the website
        response = requests.get(url)
        # Raise an exception if the request was unsuccessful (e.g., 404, 500)
        response.raise_for_status()

        # Parse the HTML content of the page using BeautifulSoup
        soup = BeautifulSoup(response.text, 'html.parser')

        # Find all unordered lists with the class 'chapel-list'
        event_lists = soup.find_all('ul', class_='chapel-list')

        # Loop through each event list found
        for event_list in event_lists:
            # Find all list items, which represent individual events
            events = event_list.find_all('li')

            # Loop through each event item
            for event in events:
                # --- Data Extraction ---
                
                # Extract the time, handling cases where the tag might be missing
                time_tag = event.find('div', class_='datetime')
                # Clean up the text by replacing line breaks with a space
                time = time_tag.get_text(separator=' ').strip().replace('\n', ' ') if time_tag else 'Time not available'

                # Extract the title
                title_tag = event.find('h3', class_='title')
                title = title_tag.get_text().strip() if title_tag else 'Title not available'

                # The description is in an 'h4' tag with class 'subtitle'; it may not always be present
                description_tag = event.find('h4', class_='subtitle')
                description = description_tag.get_text().strip() if description_tag else 'No description'

                # Append the extracted data as a dictionary to our list
                chapel_events.append({
                    'title': title,
                    'description': description,
                    'time': time
                })
                
        return chapel_events

    except requests.exceptions.RequestException as e:
        # Handle potential network errors or bad responses
        print(f"An error occurred while scraping chapel events: {e}")
        return [] # Return an empty list on error to prevent the app from crashing

# This block allows you to test the scraper directly by running "python scrape_chapel.py"
if __name__ == '__main__':
    events = get_chapel_events()
    import json
    # Pretty-print the JSON output for readability
    print(json.dumps(events, indent=4))
