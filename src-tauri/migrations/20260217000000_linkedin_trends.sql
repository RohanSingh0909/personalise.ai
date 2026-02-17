-- LinkedIn Trends table
CREATE TABLE IF NOT EXISTS linkedin_trends (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT,
    author TEXT,
    hashtags TEXT,
    source TEXT,
    item_type TEXT,
    scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
