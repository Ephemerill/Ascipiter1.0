# server.py

from flask import Flask, jsonify
from flask_cors import CORS

# Import the functions from your scraper files
from scrape_menu import get_menu_data_for_template
from scrape_weather import get_weather
from scrape_chapel import get_chapel_events
import logging

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
    """Endpoint for chapel data (for future use)."""
    logging.info("Received request for /api/chapel")
    chapel_data = get_chapel_events()
    return jsonify(chapel_data)

if __name__ == '__main__':
    # Run the server on port 5001 to avoid conflicts with React's default port 3000
    app.run(debug=True, port=5001)