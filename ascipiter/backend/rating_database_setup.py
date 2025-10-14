import sqlite3

# This will create a new 'ratings.db' file
conn = sqlite3.connect('ratings.db')
cursor = conn.cursor()

print("Initializing ratings database...")

# Create the 'ratings' table for aggregated scores (no changes here)
cursor.execute('''
CREATE TABLE IF NOT EXISTS ratings (
    mealId TEXT PRIMARY KEY,
    totalStars INTEGER NOT NULL DEFAULT 0,
    ratingCount INTEGER NOT NULL DEFAULT 0
)
''')

# UPDATED: Create the 'voters' table to store each user's specific rating
cursor.execute('''
CREATE TABLE IF NOT EXISTS voters (
    mealId TEXT NOT NULL,
    anonymousId TEXT NOT NULL,
    rating INTEGER NOT NULL, -- This new column stores the user's vote
    PRIMARY KEY (mealId, anonymousId)
)
''')

conn.commit()
conn.close()

print("Ratings database initialized successfully.")