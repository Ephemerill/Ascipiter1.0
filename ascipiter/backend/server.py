# server.py

from flask import Flask, jsonify
from flask_cors import CORS
import sqlite3
import datetime
import logging

# Import the functions from your scraper files
from scrape_menu import get_menu_data_for_template
from scrape_weather import get_weather
from scrape_chapel import get_chapel_events

# Configure basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)
# Enable CORS to allow your React app (on a different port) to make requests
CORS(app)

@app.route('/api/menu', methods=['GET'])
def menu_endpoint():
    """Endpoint to get the daily menu data."""
    logging.info("Received request for /api/menu")
    menu_data = get_menu_data_for_template()
    logging.info("Successfully scraped menu data, sending response.")
    return jsonify(menu_data)

@app.route('/api/weather', methods=['GET'])
def weather_endpoint():
    """Endpoint for weather data (for future use)."""
    logging.info("Received request for /api/weather")
    weather_data = get_weather()
    return jsonify(weather_data)

@app.route('/api/chapel', methods=['GET'])
def chapel_endpoint():
    """Endpoint for chapel data."""
    logging.info("Received request for /api/chapel")
    chapel_data = get_chapel_events()
    return jsonify(chapel_data)

# --- NEW ROUTES FOR PAGE LOAD ANALYTICS ---

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