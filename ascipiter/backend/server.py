# server.py

from flask import Flask, jsonify
from flask_cors import CORS
import sqlite3
import datetime
import logging
import json
import os
from apscheduler.schedulers.background import BackgroundScheduler

# Import the functions from your scraper files
from scrape_menu import get_menu_data_for_template
from scrape_weather import get_weather
from scrape_chapel import get_chapel_events

# Configure basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)
CORS(app)

# --- CACHING CONFIGURATION ---
MENU_CACHE_FILE = 'menu_cache.json'
CHAPEL_CACHE_FILE = 'chapel_cache.json'

# --- CACHE FUNCTIONS (Unchanged) ---
def read_menu_cache():
    if os.path.exists(MENU_CACHE_FILE):
        try:
            with open(MENU_CACHE_FILE, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            logging.error(f"Error reading cache file {MENU_CACHE_FILE}: {e}")
    return None

def write_menu_cache(data):
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
    if os.path.exists(CHAPEL_CACHE_FILE):
        # ... (your existing code for reading chapel cache)
        pass # Placeholder

def write_chapel_cache(data):
    # ... (your existing code for writing chapel cache)
    pass # Placeholder


# --- BACKGROUND JOB FUNCTION ---
def update_menu_cache_job():
    with app.app_context():
        logging.info("SCHEDULER: Running scheduled menu scrape job...")
        try:
            menu_data = get_menu_data_for_template()
            write_menu_cache(menu_data)
            logging.info("SCHEDULER: Menu cache successfully updated.")
        except Exception as e:
            logging.error(f"SCHEDULER: Error during scheduled scrape: {e}")

# --- MENU ENDPOINTS ---

@app.route('/api/menu', methods=['GET'])
def menu_endpoint():
    """
    Serves the latest menu data directly from the cache.
    """
    logging.info("Received request for /api/menu")
    cached_info = read_menu_cache()
    if cached_info and 'data' in cached_info:
        return jsonify(cached_info['data'])
    else:
        logging.warning("Cache is empty. Performing initial scrape for /api/menu.")
        update_menu_cache_job() # Run the job to populate cache
        cached_info = read_menu_cache()
        return jsonify(cached_info.get('data', {}))

### NEW: RE-ADD THE REFRESH ENDPOINT ###
@app.route('/api/menu/refresh', methods=['GET'])
def menu_refresh_endpoint():
    """
    An endpoint for the frontend to trigger a background scrape.
    It scrapes new data, updates the cache, and returns the new data if it changed.
    """
    logging.info("Received request for /api/menu/refresh from client.")
    
    # Get old data for comparison
    cached_info = read_menu_cache()
    old_data = cached_info.get('data', {}) if cached_info else {}

    # Scrape new data
    new_data = get_menu_data_for_template()

    # Compare by converting to sorted JSON strings for a reliable deep comparison
    if json.dumps(new_data, sort_keys=True) != json.dumps(old_data, sort_keys=True):
        logging.info("New menu data found via client refresh. Updating cache and returning data.")
        write_menu_cache(new_data)
        return jsonify(new_data) # Return 200 OK with new data
    else:
        logging.info("Client refresh scraped same data. Not updating UI.")
        # We still write to update the timestamp, preventing the scheduler from running needlessly
        write_menu_cache(old_data) 
        return ('', 204) # 204 No Content, indicating no change

# ... (Keep all your other endpoints like /api/weather, /api/chapel, etc. here) ...
# (Add your chapel, weather, and analytics endpoints back here)


if __name__ == '__main__':
    # --- SCHEDULER SETUP ---
    scheduler = BackgroundScheduler(daemon=True)
    # Changed to 60 minutes (1 hour) as requested
    scheduler.add_job(update_menu_cache_job, 'interval', minutes=60)
    scheduler.start()
    
    # Run an initial scrape on startup so the app is never empty
    with app.app_context():
        update_menu_cache_job()

    logging.info("Starting Flask server and background scheduler.")
    app.run(debug=True, port=5001)