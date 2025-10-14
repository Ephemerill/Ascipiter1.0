# server.py

from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
import datetime
import logging
import json
import os
from apscheduler.schedulers.background import BackgroundScheduler

# Import the functions from your scraper files
# Make sure these files exist in the same directory or adjust the import path
from scrape_menu import get_menu_data_for_template
from scrape_weather import get_weather
from scrape_chapel import get_chapel_events

# Configure basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)
# Configure CORS to allow requests from your Vite frontend (default port 5173)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:5173"}})


# --- FILE PATH CONFIGURATION ---
MENU_CACHE_FILE = 'menu_cache.json'
CHAPEL_CACHE_FILE = 'chapel_cache.json'
RATINGS_DB = 'ratings.db'


# --- CACHE & DB FUNCTIONS ---
def read_menu_cache():
    if os.path.exists(MENU_CACHE_FILE):
        try:
            with open(MENU_CACHE_FILE, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            logging.error(f"Error reading menu cache file {MENU_CACHE_FILE}: {e}")
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
        logging.error(f"Error writing to menu cache file {MENU_CACHE_FILE}: {e}")

def read_chapel_cache():
    if os.path.exists(CHAPEL_CACHE_FILE):
        try:
            with open(CHAPEL_CACHE_FILE, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            logging.error(f"Error reading chapel cache file {CHAPEL_CACHE_FILE}: {e}")
    return None

def write_chapel_cache(data):
    cache_content = {
        'timestamp': datetime.datetime.utcnow().isoformat(),
        'data': data
    }
    try:
        with open(CHAPEL_CACHE_FILE, 'w') as f:
            json.dump(cache_content, f)
        logging.info("Successfully wrote to chapel cache.")
    except IOError as e:
        logging.error(f"Error writing to chapel cache file {CHAPEL_CACHE_FILE}: {e}")

def get_ratings_db_connection():
    """Establishes a connection to the ratings database."""
    conn = sqlite3.connect(RATINGS_DB)
    conn.row_factory = sqlite3.Row # This allows accessing columns by name
    return conn


# --- BACKGROUND JOB FUNCTIONS ---
def update_menu_cache_job():
    with app.app_context():
        logging.info("SCHEDULER: Running scheduled menu scrape job...")
        try:
            menu_data = get_menu_data_for_template()
            write_menu_cache(menu_data)
            logging.info("SCHEDULER: Menu cache successfully updated.")
        except Exception as e:
            logging.error(f"SCHEDULER: Error during scheduled scrape: {e}")


# --- API ENDPOINTS ---

# --- MENU ENDPOINTS ---
@app.route('/api/menu', methods=['GET'])
def menu_endpoint():
    logging.info("Received request for /api/menu")
    cached_info = read_menu_cache()
    if cached_info and 'data' in cached_info:
        return jsonify(cached_info['data'])
    else:
        logging.warning("Cache is empty. Performing initial scrape for /api/menu.")
        update_menu_cache_job()
        cached_info = read_menu_cache()
        return jsonify(cached_info.get('data', {}))

@app.route('/api/menu/refresh', methods=['GET'])
def menu_refresh_endpoint():
    logging.info("Received request for /api/menu/refresh from client.")
    cached_info = read_menu_cache()
    old_data = cached_info.get('data', {}) if cached_info else {}
    new_data = get_menu_data_for_template()
    if json.dumps(new_data, sort_keys=True) != json.dumps(old_data, sort_keys=True):
        logging.info("New menu data found via client refresh. Updating cache and returning data.")
        write_menu_cache(new_data)
        return jsonify(new_data)
    else:
        logging.info("Client refresh scraped same data. Not updating UI.")
        write_menu_cache(old_data) 
        return ('', 204)

# --- RATING ENDPOINTS ---
@app.route('/api/rating/<mealId>', methods=['GET'])
def get_rating_data(mealId):
    """
    Fetches both the aggregated rating and a specific user's rating for a meal.
    """
    anonymousId = request.args.get('anonymousId')
    if not anonymousId:
        return jsonify({"error": "anonymousId is required"}), 400

    conn = get_ratings_db_connection()
    
    # Get aggregated rating
    agg_rating_record = conn.execute('SELECT * FROM ratings WHERE mealId = ?', (mealId,)).fetchone()
    
    # Get user's specific rating
    voter_record = conn.execute(
        'SELECT rating FROM voters WHERE mealId = ? AND anonymousId = ?',
        (mealId, anonymousId)
    ).fetchone()
    
    conn.close()

    # Prepare the response payload
    response_data = {
        "averageRating": 0,
        "ratingCount": 0,
        "userRating": 0
    }

    if agg_rating_record:
        response_data["averageRating"] = agg_rating_record['totalStars'] / agg_rating_record['ratingCount'] if agg_rating_record['ratingCount'] > 0 else 0
        response_data["ratingCount"] = agg_rating_record['ratingCount']

    if voter_record:
        response_data["userRating"] = voter_record['rating']

    return jsonify(response_data)

@app.route('/api/rate-meal', methods=['POST'])
def rate_meal():
    """Submits or updates a rating for a meal."""
    data = request.get_json()
    mealId = data.get('mealId')
    anonymousId = data.get('anonymousId')
    new_rating = data.get('rating')

    if not all([mealId, anonymousId, new_rating]):
        return jsonify({"error": "Missing data"}), 400

    conn = get_ratings_db_connection()
    cursor = conn.cursor()

    try:
        voter_record = cursor.execute(
            'SELECT rating FROM voters WHERE mealId = ? AND anonymousId = ?',
            (mealId, anonymousId)
        ).fetchone()

        if voter_record:
            # UPDATE VOTE LOGIC
            old_rating = voter_record['rating']
            cursor.execute('UPDATE voters SET rating = ? WHERE mealId = ? AND anonymousId = ?', (new_rating, mealId, anonymousId))
            cursor.execute('UPDATE ratings SET totalStars = totalStars - ? + ? WHERE mealId = ?', (old_rating, new_rating, mealId))
            logging.info(f"User {anonymousId} updated rating for {mealId} from {old_rating} to {new_rating}")
        else:
            # NEW VOTE LOGIC
            cursor.execute('INSERT INTO voters (mealId, anonymousId, rating) VALUES (?, ?, ?)',(mealId, anonymousId, new_rating))
            cursor.execute('''
                INSERT INTO ratings (mealId, totalStars, ratingCount) VALUES (?, ?, 1)
                ON CONFLICT(mealId) DO UPDATE SET
                totalStars = totalStars + excluded.totalStars,
                ratingCount = ratingCount + 1
            ''', (mealId, new_rating))
            logging.info(f"User {anonymousId} submitted new rating for {mealId}: {new_rating}")
        
        conn.commit()
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({"error": f"Database error: {e}"}), 500
    finally:
        conn.close()
    
    return jsonify({"success": True}), 201

# --- (Add your other endpoints like weather, chapel, analytics here) ---
@app.route('/api/chapel', methods=['GET'])
def chapel_endpoint():
    cached_info = read_chapel_cache()
    # Your logic for chapel data...
    if not cached_info:
        # Placeholder to prevent errors if cache is empty
        return jsonify([])
    return jsonify(cached_info.get('data', []))


# --- MAIN EXECUTION ---
if __name__ == '__main__':
    # --- SCHEDULER SETUP ---
    scheduler = BackgroundScheduler(daemon=True)
    scheduler.add_job(update_menu_cache_job, 'interval', minutes=60)
    scheduler.start()
    
    # Run an initial scrape on startup so the app is never empty
    with app.app_context():
        logging.info("Performing initial menu scrape on startup...")
        update_menu_cache_job()

    logging.info("Starting Flask server and background scheduler.")
    app.run(debug=True, port=5001)