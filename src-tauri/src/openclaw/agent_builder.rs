use tauri::{AppHandle, State, Window, Manager};
use crate::AppState;
use crate::llm::{local, external};
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AgentConfig {
    pub name: String,
    pub role: String,
    pub description: String,
    pub schedule: String,
    pub tasks: Vec<String>,
    pub tools: Vec<String>,
    #[serde(default)]
    pub event_triggers: Vec<String>,
}

#[tauri::command]
pub async fn generate_agent_config(
    state: State<'_, AppState>,
    prompt: String,
    _window: Window,
) -> Result<AgentConfig, String> {
    // 1. Construct a system prompt to force JSON output
    let system_prompt = r#"
    You are an expert OpenClaw Agent Architect. 
    Your goal is to translate the user's request into a structured JSON configuration for an autonomous agent.
    
    Output ONLY valid JSON matching this schema:
    {
        "name": "Agent Name",
        "role": "Agent Role",
        "description": "Short description of what it does",
        "schedule": "Cron expression or natural language schedule (e.g. '0 9 * * *' or 'daily')",
        "tasks": ["Task 1", "Task 2"],
        "tools": ["browser", "file_system", "http"]
    }
    
    Do not include markdown code blocks. Just the raw JSON.
    User Request: 
    "#;

    let full_prompt = format!("{}{}", system_prompt, prompt);

    // 2. Call LLM (reuse router logic roughly)
    // For simplicity, we'll just check the API key here again or refactor router to export a helper.
    // Let's duplicated checking for now to avoid borrow checker issues with State references if not careful.
    
    let api_key_row = sqlx::query("SELECT value FROM llm_settings WHERE key = 'openai_api_key'")
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    let response_text = if let Some(row) = api_key_row {
        let api_key: String = sqlx::Row::try_get(&row, "value").unwrap_or_default();
        if !api_key.is_empty() {
             external::chat_openai(&full_prompt, &api_key).await?
        } else {
             // Local might be too weak for structured JSON without fine-tuning, but let's try.
             // We can't stream here easily if we want to parse JSON.
             // We'll use a non-streaming local chat if available, or accumulate stream.
             // Our local.rs only has `chat_stream`. Let's assume we can use it and collect result.
             // But `chat_stream` emits events. We don't want events here.
             // I'll add a `chat_oneshot` to local.rs or just use a simple request here.
             
             // Local fallback / Mock with simple keyword matching
             if prompt.to_lowercase().contains("linkedin") {
                 json!({
                    "name": "LinkedIn Trend Monitor", 
                    "role": "Social Media Manager", 
                    "description": "Monitors LinkedIn for trending topics and drafts posts.", 
                    "schedule": "0 0 9 * * *", 
                    "tasks": ["Search trending topics", "Draft post", "Preview post", "Post to feed"], 
                    "tools": ["browser", "linkedin_api"],
                    "event_triggers": ["on_trending_spike", "daily_heartbeat"]
                 }).to_string()
             } else if prompt.to_lowercase().contains("hashtag") || prompt.to_lowercase().contains("comment") {
                 json!({
                    "name": "Hashtag Engagement Bot", 
                    "role": "Growth Hacker", 
                    "description": "Comments on posts with specific hashtags to drive engagement.", 
                    "schedule": "0 * * * * *", 
                    "tasks": ["Search #openclaw", "Analyze sentiment", "Post comment"], 
                    "tools": ["browser", "http"],
                    "event_triggers": ["new_post_with_hashtag", "hourly_poll"]
                 }).to_string()
             } else {
                 json!({
                    "name": "General Assistant", 
                    "role": "Helper", 
                    "description": "A general purpose automation agent.", 
                    "schedule": "daily", 
                    "tasks": ["Check notifications"], 
                    "tools": ["browser"],
                    "event_triggers": ["periodic_check"]
                 }).to_string()
             }
        }
    } else {
         // Same logic as above for no API key case
         if prompt.to_lowercase().contains("linkedin") {
             json!({
                "name": "LinkedIn Trend Monitor", 
                "role": "Social Media Manager", 
                "description": "Monitors LinkedIn for trending topics and drafts posts.", 
                "schedule": "0 0 9 * * *", 
                "tasks": ["Search trending topics", "Draft post", "Preview post", "Post to feed"], 
                "tools": ["browser", "linkedin_api"],
                "event_triggers": ["on_trending_spike", "daily_heartbeat"]
             }).to_string()
         } else if prompt.to_lowercase().contains("hashtag") || prompt.to_lowercase().contains("comment") {
             json!({
                "name": "Hashtag Engagement Bot", 
                "role": "Growth Hacker", 
                "description": "Comments on posts with specific hashtags to drive engagement.", 
                "schedule": "0 * * * * *", 
                "tasks": ["Search #openclaw", "Analyze sentiment", "Post comment"], 
                "tools": ["browser", "http"],
                "event_triggers": ["new_post_with_hashtag", "hourly_poll"]
             }).to_string()
         } else {
             json!({
                "name": "Local Agent", 
                "role": "Assistant", 
                "description": "Generated by Local LLM (Simulated)", 
                "schedule": "daily", 
                "tasks": ["Check trends"], 
                "tools": ["browser"],
                "event_triggers": ["periodic_check"]
             }).to_string()
         }
    };

    // 3. Parse JSON
    // Clean up markdown code blocks if present
    let cleaned = response_text.trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```");

    let config: AgentConfig = serde_json::from_str(cleaned)
        .map_err(|e| format!("Failed to parse agent config: {}. Response: {}", e, response_text))?;

    Ok(config)
}


#[tauri::command]
pub async fn deploy_agent(
    state: State<'_, AppState>,
    config: AgentConfig,
) -> Result<String, String> {
    // 1. Save to DB
    let id = uuid::Uuid::new_v4().to_string();
    let config_json = serde_json::to_string(&config).unwrap();
    
    sqlx::query("INSERT INTO agents (id, name, role, config) VALUES (?, ?, ?, ?)")
        .bind(&id)
        .bind(&config.name)
        .bind(&config.role)
        .bind(&config_json)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    // 2. Schedule if needed
    let cron_expr;
    if !config.schedule.is_empty() {
        let scheduler = state.scheduler.lock().await;
        let cron = if config.schedule.contains("daily") { "0 0 9 * * *" } else { "0 * * * * *" };
        cron_expr = cron.to_string();
        scheduler.add_cron_job(cron, format!("Run Agent: {}", config.name)).await?;
    } else {
        cron_expr = String::new();
    }

    // 3. Save schedule record
    if !cron_expr.is_empty() {
        let schedule_id = uuid::Uuid::new_v4().to_string();
        let _ = sqlx::query("INSERT INTO schedules (id, agent_id, schedule_expression, enabled) VALUES (?, ?, ?, 1)")
            .bind(&schedule_id)
            .bind(&id)
            .bind(&cron_expr)
            .execute(&state.db)
            .await;
    }

    Ok(id)
}

#[derive(Serialize, Debug)]
pub struct AgentRecord {
    pub id: String,
    pub name: String,
    pub role: String,
    pub config: String,
    pub created_at: String,
    pub schedule_expression: Option<String>,
    pub enabled: bool,
}

#[tauri::command]
pub async fn get_agents(
    state: State<'_, AppState>,
) -> Result<Vec<AgentRecord>, String> {
    let rows = sqlx::query(
        r#"
        SELECT a.id, a.name, a.role, a.config, a.created_at,
               s.schedule_expression, s.enabled
        FROM agents a
        LEFT JOIN schedules s ON s.agent_id = a.id
        ORDER BY a.created_at DESC
        "#
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let agents: Vec<AgentRecord> = rows.iter().map(|row| {
        AgentRecord {
            id: sqlx::Row::get(row, "id"),
            name: sqlx::Row::get(row, "name"),
            role: sqlx::Row::get::<Option<String>, _>(row, "role").unwrap_or_default(),
            config: sqlx::Row::get::<Option<String>, _>(row, "config").unwrap_or_default(),
            created_at: sqlx::Row::get::<Option<String>, _>(row, "created_at").unwrap_or_default(),
            schedule_expression: sqlx::Row::get(row, "schedule_expression"),
            enabled: sqlx::Row::get::<Option<bool>, _>(row, "enabled").unwrap_or(true),
        }
    }).collect();

    Ok(agents)
}

#[tauri::command]
pub async fn delete_agent(
    state: State<'_, AppState>,
    agent_id: String,
) -> Result<(), String> {
    // Delete schedule first (FK)
    sqlx::query("DELETE FROM schedules WHERE agent_id = ?")
        .bind(&agent_id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    // Delete agent
    sqlx::query("DELETE FROM agents WHERE id = ?")
        .bind(&agent_id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

