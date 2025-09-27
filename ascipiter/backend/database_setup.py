import sqlite3

# Connect to the database (this will create the file if it doesn't exist)
conn = sqlite3.connect('analytics.db')
cursor = conn.cursor()

# Create a table with 'date' as the unique primary key
cursor.execute('''
    CREATE TABLE IF NOT EXISTS page_loads (
        date TEXT PRIMARY KEY,
        count INTEGER NOT NULL
    )
''')

conn.commit()
conn.close()

print("Database 'analytics.db' and table 'page_loads' created successfully.")