# server.py

from flask import Flask, jsonify
from flask_cors import CORS
import sqlite3
import datetime
import logging
import json
import os

# Import the functions from your scraper files
from scrape_menu import get_menu_data_for_template
from scrape_weather import get_weather
from scrape_chapel import get_chapel_events

# Configure basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)
# Enable CORS to allow your React app (on a different port) to make requests
CORS(app)

# --- CACHING CONFIGURATION ---
MENU_CACHE_FILE = 'menu_cache.json'
MENU_CACHE_DURATION_SECONDS = 3600  # 1 hour

CHAPEL_CACHE_FILE = 'chapel_cache.json'
CHAPEL_CACHE_DURATION_SECONDS = 86400  # 24 hours


def read_menu_cache():
    """Reads the menu cache file if it exists."""
    if os.path.exists(MENU_CACHE_FILE):
        try:
            with open(MENU_CACHE_FILE, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            logging.error(f"Error reading cache file {MENU_CACHE_FILE}: {e}")
            return None
    return None

def write_menu_cache(data):
    """Writes data to the menu cache file with a new UTC timestamp."""
    cache_content = {
        'timestamp': datetime.datetime.utcnow().isoformat(),
        'data': data
    }
    try:
        with open(MENU_CACHE_FILE, 'w') as f:
            json.dump(cache_content, f)
        logging.info("Successfully wrote to menu cache.")
    except IOError as e:
        logging.error(f"Error writing to cache file {MENU_CACHE_FILE}: {e}")

def read_chapel_cache():
    """Reads the chapel cache file if it exists."""
    if os.path.exists(CHAPEL_CACHE_FILE):
        try:
            with open(CHAPEL_CACHE_FILE, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            logging.error(f"Error reading cache file {CHAPEL_CACHE_FILE}: {e}")
            return None
    return None

def write_chapel_cache(data):
    """Writes data to the chapel cache file with a new UTC timestamp."""
    cache_content = {
        'timestamp': datetime.datetime.utcnow().isoformat(),
        'data': data
    }
    try:
        with open(CHAPEL_CACHE_FILE, 'w') as f:
            json.dump(cache_content, f)
        logging.info("Successfully wrote to chapel cache.")
    except IOError as e:
        logging.error(f"Error writing to cache file {CHAPEL_CACHE_FILE}: {e}")


# --- MENU ENDPOINTS ---

@app.route('/api/menu', methods=['GET'])
def menu_endpoint():
    """
    Endpoint to get the daily menu data.
    Returns cached menu data immediately. If the cache is empty,
    it performs an initial scrape to populate it.
    """
    logging.info("Received request for /api/menu")
    cached_info = read_menu_cache()

    if cached_info and 'data' in cached_info:
        logging.info("Serving menu data from cache.")
        return jsonify(cached_info['data'])
    else:
        logging.warning("Cache is empty or invalid. Performing initial scrape for /api/menu.")
        menu_data = get_menu_data_for_template()
        write_menu_cache(menu_data)
        return jsonify(menu_data)

@app.route('/api/menu/refresh', methods=['GET'])
def menu_refresh_endpoint():
    """
    Background endpoint to update the menu cache if it's stale.
    - Checks the timestamp of the cache.
    - If fresh (<1 hour), does nothing (returns 204).
    - If stale, scrapes new data.
    - Compares new data to old data.
    - If different, updates cache and returns new data (200).
    - If same, updates timestamp and returns nothing (204).
    """
    logging.info("Received request for /api/menu/refresh")
    cached_info = read_menu_cache()
    
    # Check if cache is fresh
    if cached_info and 'timestamp' in cached_info:
        try:
            cache_time = datetime.datetime.fromisoformat(cached_info['timestamp'])
            if datetime.datetime.utcnow() - cache_time < datetime.timedelta(seconds=MENU_CACHE_DURATION_SECONDS):
                logging.info("Cache is fresh. No refresh needed.")
                return ('', 204) # 204 No Content
        except (ValueError, KeyError):
            logging.warning("Could not parse timestamp from cache. Forcing refresh.")
    
    # Cache is stale, missing, or has an invalid timestamp, so scrape new data
    logging.info("Cache is stale. Scraping for new data...")
    new_data = get_menu_data_for_template()
    old_data = cached_info.get('data', {}) if cached_info else {}

    # Compare by converting to sorted JSON strings for a reliable deep comparison
    if json.dumps(new_data, sort_keys=True) != json.dumps(old_data, sort_keys=True):
        logging.info("New menu data found. Updating cache and returning data.")
        write_menu_cache(new_data)
        return jsonify(new_data)
    else:
        logging.info("Scraped data is the same as cache. Updating timestamp only.")
        write_menu_cache(old_data) # Write back to update timestamp
        return ('', 204) # 204 No Content


@app.route('/api/weather', methods=['GET'])
def weather_endpoint():
    """Endpoint for weather data (for future use)."""
    logging.info("Received request for /api/weather")
    weather_data = get_weather()
    return jsonify(weather_data)

# --- UPDATED CHAPEL ENDPOINT ---
@app.route('/api/chapel', methods=['GET'])
def chapel_endpoint():
    """Endpoint for chapel data with daily caching."""
    logging.info("Received request for /api/chapel")
    cached_info = read_chapel_cache()

    # Check if cache exists and is fresh
    if cached_info and 'timestamp' in cached_info:
        try:
            cache_time = datetime.datetime.fromisoformat(cached_info['timestamp'])
            if datetime.datetime.utcnow() - cache_time < datetime.timedelta(seconds=CHAPEL_CACHE_DURATION_SECONDS):
                logging.info("Serving chapel data from fresh cache.")
                return jsonify(cached_info['data'])
        except (ValueError, KeyError):
            logging.warning("Could not parse timestamp from chapel cache. Forcing refresh.")

    # Cache is stale, missing, or invalid, so scrape new data
    logging.info("Chapel cache is stale or missing. Scraping for new data...")
    chapel_data = get_chapel_events()
    write_chapel_cache(chapel_data)
    logging.info("Successfully scraped and cached new chapel data.")
    return jsonify(chapel_data)


# --- PAGE LOAD ANALYTICS ENDPOINTS ---

@app.route('/api/record-load', methods=['POST'])
def record_load():
    """
    Increments the page load count for the current day.
    This uses an 'UPSERT' operation to either insert a new row for the day
    or update the existing one.
    """
    try:
        today = datetime.date.today().isoformat()
        conn = sqlite3.connect('analytics.db')
        cursor = conn.cursor()

        cursor.execute('''
            INSERT INTO page_loads (date, count) VALUES (?, 1)
            ON CONFLICT(date) DO UPDATE SET count = count + 1
        ''', (today,))
        
        conn.commit()
        conn.close()
        logging.info(f"Recorded a new page load for date: {today}")
        return jsonify({'success': True}), 200
    except Exception as e:
        logging.error(f"Error in /api/record-load: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/get-loads', methods=['GET'])
def get_loads():
    """
    Retrieves the page load counts for the last 7 days.
    """
    try:
        conn = sqlite3.connect('analytics.db')
        conn.row_factory = sqlite3.Row 
        cursor = conn.cursor()
        logging.info("Received request for /api/get-loads")

        # Get the dates for the last 7 days (today and the 6 previous days)
        dates_to_fetch = [(datetime.date.today() - datetime.timedelta(days=i)).isoformat() for i in range(7)]
        
        # Query for any data matching those dates
        cursor.execute(f'SELECT * FROM page_loads WHERE date IN ({",".join(["?"]*7)})', dates_to_fetch)
        rows = cursor.fetchall()
        conn.close()

        # Create a dictionary of existing data for quick lookups
        existing_data = {row['date']: row['count'] for row in rows}

        # Build the final response list, filling in 0 for any days that had no loads
        response_data = []
        for date_str in dates_to_fetch:
            response_data.append({
                'date': date_str,
                'count': existing_data.get(date_str, 0)
            })
        
        logging.info("Successfully fetched load data.")
        return jsonify(response_data), 200
    except Exception as e:
        logging.error(f"Error in /api/get-loads: {e}")
        return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    # Run the server on port 5001 to avoid conflicts with React's default port
    app.run(debug=True, port=5001)