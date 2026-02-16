use tauri::State;
use crate::AppState;
use sqlx::Row;

#[tauri::command]
pub async fn toggle_sandbox(state: State<'_, AppState>, enabled: bool) -> Result<(), String> {
    // Ideally update a runtime flag.
    // For demo purposes, we log the toggle event to DB which persists preference.
    // Or update `llm_settings` table where key='sandbox_enabled'.

    sqlx::query("INSERT OR REPLACE INTO llm_settings (key, value) VALUES (?, ?)")
        .bind("sandbox_enabled")
        .bind(if enabled { "true" } else { "false" })
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

pub async fn is_sandbox_enabled(pool: &sqlx::SqlitePool) -> bool {
    sqlx::query("SELECT value FROM llm_settings WHERE key = 'sandbox_enabled'")
        .fetch_optional(pool)
        .await
        .unwrap_or(None)
        .map(|row| row.try_get::<String, _>("value").unwrap_or_default() == "true")
        .unwrap_or(false)
}
