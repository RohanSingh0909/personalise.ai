-- Agents table
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT,
    system_prompt TEXT,
    config TEXT, -- JSON stored as text
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Schedules table
CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    agent_id TEXT,
    schedule_expression TEXT NOT NULL,
    last_run DATETIME,
    next_run DATETIME,
    enabled BOOLEAN DEFAULT 1,
    FOREIGN KEY(agent_id) REFERENCES agents(id)
);

-- Logs table
CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    level TEXT,
    module TEXT,
    message TEXT,
    metadata TEXT -- JSON stored as text
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    payload TEXT, -- JSON stored as text
    processed BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- LLM Settings table
CREATE TABLE IF NOT EXISTS llm_settings (
    key TEXT PRIMARY KEY,
    value TEXT -- JSON stored as text
);

-- Approval History table
CREATE TABLE IF NOT EXISTS approval_history (
    id TEXT PRIMARY KEY,
    agent_id TEXT,
    action TEXT NOT NULL,
    status TEXT NOT NULL, -- PENDING, APPROVED, REJECTED
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(agent_id) REFERENCES agents(id)
);
