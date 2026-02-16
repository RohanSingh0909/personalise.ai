use tauri::{State, Window, Emitter};
use crate::AppState;
use crate::llm::{local, external};
use sqlx::Row;
use serde_json::json;

#[tauri::command]
pub async fn chat(
    state: State<'_, AppState>,
    prompt: String,
    window: Window,
) -> Result<String, String> {
    // 1. Log incoming request
    let log_id = uuid::Uuid::new_v4().to_string();
    let _ = sqlx::query("INSERT INTO logs (id, level, module, message, metadata) VALUES (?, ?, ?, ?, ?)")
        .bind(&log_id)
        .bind("INFO")
        .bind("llm_router")
        .bind("Handling chat request")
        .bind(json!({"prompt": prompt}).to_string())
        .execute(&state.db)
        .await;

    // 2. Check for configured API Key
    let api_key_row = sqlx::query("SELECT value FROM llm_settings WHERE key = 'openai_api_key'")
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    let response = if let Some(row) = api_key_row {
        let api_key: String = row.try_get("value").unwrap_or_default();
        if !api_key.is_empty() {
            // Use External
            window.emit("llm-status", "Using External LLM (OpenAI)").unwrap();
            match external::chat_openai(&prompt, &api_key).await {
                Ok(res) => {
                    // Emit full response as stream chunks for UI compatibility if needed
                    window.emit("llm-token", &res).unwrap(); 
                    res
                },
                Err(e) => {
                    window.emit("llm-status", format!("External failed: {}. Falling back to Local.", e)).unwrap();
                    // Fallback
                    local::chat_stream(&prompt, &window).await?
                }
            }
        } else {
             local::chat_stream(&prompt, &window).await?
        }
    } else {
        // Use Local (Phi-3)
        window.emit("llm-status", "Using Local LLM (Phi-3)").unwrap();
        local::chat_stream(&prompt, &window).await?
    };

    // 3. Log completion
    let _ = sqlx::query("INSERT INTO logs (id, level, module, message, metadata) VALUES (?, ?, ?, ?, ?)")
        .bind(uuid::Uuid::new_v4().to_string())
        .bind("INFO")
        .bind("llm_router")
        .bind("Request completed")
        .bind(json!({"response_length": response.len()}).to_string())
        .execute(&state.db)
        .await;

    Ok(response)
}
