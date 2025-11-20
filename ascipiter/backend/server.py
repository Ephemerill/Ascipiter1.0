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
from scrape_menu import get_menu_data_for_template
from scrape_weather import get_weather
from scrape_chapel import get_chapel_events
from scrape_weekly import find_weekly_menu_url, scrape_weekly_menu

# Configure basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)

# --- IMPORTANT: UPDATE THIS LINE ---
# Add your deployed frontend URL to this list.
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:5173", "https://biolawizard.com", "https://dev.biolawizard.com"]}})


# --- FILE PATH CONFIGURATION ---
MENU_CACHE_FILE = 'menu_cache.json'
CHAPEL_CACHE_FILE = 'chapel_cache.json'
WEEKLY_MENU_CACHE_FILE = 'weekly_menu_cache.json'
ANNOUNCEMENT_FILE = 'announcement.json' # --- NEW ---
RATINGS_DB = 'ratings.db'

# --- SECURITY CONFIGURATION ---
ADMIN_SECRET = 'EGG' # --- NEW: CHANGE THIS TO MATCH N8N ---


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

def read_weekly_menu_cache():
    if os.path.exists(WEEKLY_MENU_CACHE_FILE):
        try:
            with open(WEEKLY_MENU_CACHE_FILE, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            logging.error(f"Error reading weekly menu cache file {WEEKLY_MENU_CACHE_FILE}: {e}")
    return None

def write_weekly_menu_cache(data):
    cache_content = {
        'timestamp': datetime.datetime.utcnow().isoformat(),
        'data': data
    }
    try:
        with open(WEEKLY_MENU_CACHE_FILE, 'w') as f:
            json.dump(cache_content, f)
        logging.info("Successfully wrote to weekly menu cache.")
    except IOError as e:
        logging.error(f"Error writing to weekly menu cache file {WEEKLY_MENU_CACHE_FILE}: {e}")

# --- NEW: Announcement Cache Functions ---
def read_announcement_cache():
    if os.path.exists(ANNOUNCEMENT_FILE):
        try:
            with open(ANNOUNCEMENT_FILE, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            logging.error(f"Error reading announcement file: {e}")
    # Return default structure if file doesn't exist or errors
    return {"message": "", "id": None}

def write_announcement_cache(data):
    try:
        with open(ANNOUNCEMENT_FILE, 'w') as f:
            json.dump(data, f)
        logging.info("Successfully wrote to announcement cache.")
    except IOError as e:
        logging.error(f"Error writing to announcement file: {e}")


def get_ratings_db_connection():
    """Establishes a connection to the ratings database."""
    conn = sqlite3.connect(RATINGS_DB)
    conn.row_factory = sqlite3.Row
    return conn


# --- BACKGROUND JOB FUNCTIONS ---
def update_menu_cache_job():
    with app.app_context():
        logging.info("SCHEDULER: Running scheduled daily menu scrape job...")
        try:
            menu_data = get_menu_data_for_template()
            write_menu_cache(menu_data)
            logging.info("SCHEDULER: Daily menu cache successfully updated.")
        except Exception as e:
            logging.error(f"SCHEDULER: Error during scheduled daily scrape: {e}")

def update_weekly_menu_cache_job():
    with app.app_context():
        logging.info("SCHEDULER: Running scheduled WEEKLY menu scrape job...")
        try:
            cafe_page_url = "https://cafebiola.cafebonappetit.com/cafe/cafe-biola/"
            weekly_url = find_weekly_menu_url(cafe_page_url)
            if weekly_url:
                menu_data = scrape_weekly_menu(weekly_url)
                if menu_data:
                    write_weekly_menu_cache(menu_data)
                    logging.info("SCHEDULER: Weekly menu cache successfully updated.")
                else:
                    logging.error("SCHEDULER: Failed to scrape weekly menu data from the found URL.")
            else:
                logging.error("SCHEDULER: Failed to find the weekly menu URL.")
        except Exception as e:
            logging.error(f"SCHEDULER: Error during scheduled weekly scrape: {e}")


# --- API ENDPOINTS ---

# --- ANNOUNCEMENT ENDPOINTS (NEW) ---
@app.route('/api/announcement', methods=['GET'])
def get_announcement():
    # React App calls this to see if there is a new message
    return jsonify(read_announcement_cache())

@app.route('/api/update-announcement', methods=['POST'])
def update_announcement():
    # n8n calls this to push a new message
    data = request.get_json()
    
    # Security Check
    if data.get('secret') != ADMIN_SECRET:
        logging.warning("Unauthorized attempt to update announcement")
        return jsonify({"error": "Forbidden"}), 403
        
    new_data = {
        "message": data.get('message'),
        "id": data.get('id')
    }
    
    write_announcement_cache(new_data)
    logging.info(f"Announcement updated via API: {new_data['id']}")
    return jsonify({"success": True})


# --- MENU ENDPOINTS ---
@app.route('/api/menu', methods=['GET'])
def menu_endpoint():
    logging.info("Received request for /api/menu (today)")
    cached_info = read_menu_cache()
    if cached_info and 'data' in cached_info:
        return jsonify(cached_info['data'])
    else:
        logging.warning("Daily cache is empty. Performing initial scrape for /api/menu.")
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

@app.route('/api/weekly-menu', methods=['GET'])
def weekly_menu_endpoint():
    logging.info("Received request for /api/weekly-menu")
    cached_info = read_weekly_menu_cache()
    if cached_info and 'data' in cached_info:
        return jsonify(cached_info['data'])
    else:
        logging.warning("Weekly cache is empty. Performing initial scrape for /api/weekly-menu.")
        update_weekly_menu_cache_job()
        cached_info = read_weekly_menu_cache()
        return jsonify(cached_info.get('data', {}))

# --- RATING ENDPOINTS ---
@app.route('/api/rating/<mealId>', methods=['GET'])
def get_rating_data(mealId):
    anonymousId = request.args.get('anonymousId')
    if not anonymousId:
        return jsonify({"error": "anonymousId is required"}), 400

    conn = get_ratings_db_connection()
    agg_rating_record = conn.execute('SELECT * FROM ratings WHERE mealId = ?', (mealId,)).fetchone()
    voter_record = conn.execute('SELECT rating FROM voters WHERE mealId = ? AND anonymousId = ?', (mealId, anonymousId)).fetchone()
    conn.close()

    response_data = {"averageRating": 0, "ratingCount": 0, "userRating": 0}

    if agg_rating_record:
        response_data["averageRating"] = agg_rating_record['totalStars'] / agg_rating_record['ratingCount'] if agg_rating_record['ratingCount'] > 0 else 0
        response_data["ratingCount"] = agg_rating_record['ratingCount']

    if voter_record:
        response_data["userRating"] = voter_record['rating']

    return jsonify(response_data)

@app.route('/api/rate-meal', methods=['POST'])
def rate_meal():
    data = request.get_json()
    mealId, anonymousId, new_rating = data.get('mealId'), data.get('anonymousId'), data.get('rating')

    if not mealId or not anonymousId or new_rating is None:
        return jsonify({"error": "Missing data"}), 400

    conn = get_ratings_db_connection()
    cursor = conn.cursor()

    try:
        voter_record = cursor.execute('SELECT rating FROM voters WHERE mealId = ? AND anonymousId = ?', (mealId, anonymousId)).fetchone()

        if new_rating == 0:
            if voter_record:
                old_rating = voter_record['rating']
                cursor.execute('DELETE FROM voters WHERE mealId = ? AND anonymousId = ?', (mealId, anonymousId))
                cursor.execute('UPDATE ratings SET totalStars = totalStars - ?, ratingCount = ratingCount - 1 WHERE mealId = ?', (old_rating, mealId))
        elif voter_record:
            old_rating = voter_record['rating']
            cursor.execute('UPDATE voters SET rating = ? WHERE mealId = ? AND anonymousId = ?', (new_rating, mealId, anonymousId))
            cursor.execute('UPDATE ratings SET totalStars = totalStars - ? + ? WHERE mealId = ?', (old_rating, new_rating, mealId))
        else:
            cursor.execute('INSERT INTO voters (mealId, anonymousId, rating) VALUES (?, ?, ?)',(mealId, anonymousId, new_rating))
            cursor.execute('''
                INSERT INTO ratings (mealId, totalStars, ratingCount) VALUES (?, ?, 1)
                ON CONFLICT(mealId) DO UPDATE SET
                totalStars = totalStars + excluded.totalStars,
                ratingCount = ratingCount + 1
            ''', (mealId, new_rating))
        conn.commit()
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({"error": f"Database error: {e}"}), 500
    finally:
        conn.close()
    
    return jsonify({"success": True}), 201

@app.route('/api/chapel', methods=['GET'])
def chapel_endpoint():
    cached_info = read_chapel_cache()
    if not cached_info:
        return jsonify([])
    return jsonify(cached_info.get('data', []))

# --- ANALYTICS ENDPOINTS ---
ANALYTICS_DB = 'analytics.db'

def get_analytics_db_connection():
    conn = sqlite3.connect(ANALYTICS_DB)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/api/record-load', methods=['POST'])
def record_load():
    today = datetime.date.today().isoformat()
    conn = get_analytics_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO page_loads (date, count) VALUES (?, 1)
            ON CONFLICT(date) DO UPDATE SET count = count + 1
        ''', (today,))
        conn.commit()
    except sqlite3.Error as e:
        logging.error(f"Database error recording load: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()
    return jsonify({"success": True}), 201

@app.route('/api/get-loads', methods=['GET'])
def get_loads():
    conn = get_analytics_db_connection()
    try:
        loads = conn.execute('SELECT * FROM page_loads ORDER BY date DESC').fetchall()
        return jsonify([dict(row) for row in loads])
    except sqlite3.Error as e:
        logging.error(f"Database error getting loads: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


# --- MAIN EXECUTION ---
if __name__ == '__main__':
    scheduler = BackgroundScheduler(daemon=True)
    scheduler.add_job(update_menu_cache_job, 'interval', minutes=60)
    scheduler.add_job(update_weekly_menu_cache_job, 'interval', hours=4)
    scheduler.start()
    
    with app.app_context():
        logging.info("Performing initial daily menu scrape on startup...")
        update_menu_cache_job()
        logging.info("Performing initial weekly menu scrape on startup...")
        update_weekly_menu_cache_job()

    logging.info("Starting Flask server and background scheduler.")
    app.run(debug=False, host='0.0.0.0', port=5001)