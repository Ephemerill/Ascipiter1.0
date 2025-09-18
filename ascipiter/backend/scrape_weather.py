# scrape_weather.py
import requests
from bs4 import BeautifulSoup
import logging

# Configure basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_weather():
    """
    Scrapes the Biola weather page by finding the "Temperature" label in the table
    and extracting the value from the adjacent cell.
    """
    url = 'https://www.biola.edu/academics/physics/weather/'
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
    }
    
    data = {
        'temperature': [],
    }

    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status() 
        soup = BeautifulSoup(response.text, 'html.parser') # Use 'html.parser'

        # --- THIS IS THE NEW LOGIC ---
        # 1. Find the <strong> tag that contains the exact text "Temperature"
        temperature_label = soup.find('strong', string='Temperature')
        
        if temperature_label:
            # 2. Find the parent table cell (<td>) of the label
            # 3. Find the very next table cell (<td>) which contains the value
            temperature_cell = temperature_label.find_parent('td').find_next_sibling('td')
            
            if temperature_cell:
                # 4. Get the text from that cell and clean it up
                temperature = temperature_cell.get_text(strip=True)
                data['temperature'].append({'temperature': temperature})
                logging.info(f"Successfully scraped weather: {temperature}")
                return data

        # If we reach here, the label or value wasn't found
        logging.warning("Could not find the 'Temperature' label or its value cell on the page.")
        return {'temperature': []}

    except requests.exceptions.RequestException as e:
        logging.error(f"Failed to retrieve weather data from {url}: {e}")
        return {'temperature': []}

# This block only runs when you execute "python scrape_weather.py" directly
if __name__ == '__main__':
    weather_data = get_weather()
    print(weather_data)