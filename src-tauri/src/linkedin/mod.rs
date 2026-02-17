use serde::{Deserialize, Serialize};
use sqlx::Row;
use std::process::Stdio;
use tauri::{Manager, State};
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

use crate::AppState;

// ── Data Types ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendItem {
    pub title: String,
    #[serde(default)]
    pub subtitle: Option<String>,
    #[serde(default)]
    pub author: Option<String>,
    #[serde(default)]
    pub hashtags: Option<Vec<String>>,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default, rename = "type")]
    pub item_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRunResult {
    pub trends: Vec<TrendItem>,
    #[serde(default, rename = "postContent")]
    pub post_content: Option<String>,
    #[serde(default, rename = "postResult")]
    pub post_result: Option<String>,
    #[serde(default)]
    pub message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ScriptOutput {
    success: bool,
    #[serde(default)]
    data: Option<serde_json::Value>,
    #[serde(default)]
    error: Option<String>,
}

#[derive(Debug, Serialize)]
struct ScriptInput {
    action: String,
    #[serde(rename = "userDataDir")]
    user_data_dir: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
}

// ── Helper: resolve the linkedin profile dir ────────────────────────────

fn get_profile_dir(app: &tauri::AppHandle) -> Result<String, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;
    let profile = data_dir.join("linkedin-profile");
    Ok(profile.to_string_lossy().to_string())
}

// ── Helper: Run the Node.js Puppeteer script ────────────────────────────

async fn run_puppeteer_script(input: ScriptInput) -> Result<ScriptOutput, String> {
    let script_path = resolve_script_path()?;

    let mut cmd = Command::new("node");
    cmd.arg(&script_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn Node.js process: {}. Is Node.js installed?", e))?;

    // Write input JSON to stdin
    let json_input =
        serde_json::to_string(&input).map_err(|e| format!("Failed to serialize input: {}", e))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(json_input.as_bytes())
            .await
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;
        drop(stdin);
    }

    let output = child
        .wait_with_output()
        .await
        .map_err(|e| format!("Failed to wait for process: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !stderr.is_empty() {
        eprintln!("[LinkedIn Script STDERR]: {}", stderr);
    }

    let result_line = stdout
        .lines()
        .find(|l| !l.trim().is_empty())
        .ok_or_else(|| {
            format!(
                "No output from script. Stderr: {}",
                stderr.chars().take(500).collect::<String>()
            )
        })?;

    serde_json::from_str::<ScriptOutput>(result_line)
        .map_err(|e| format!("Failed to parse script output: {}. Raw: {}", e, result_line))
}

fn resolve_script_path() -> Result<String, String> {
    let candidates = vec![
        std::path::PathBuf::from("../scripts/linkedin-scraper.cjs"),
        std::path::PathBuf::from("scripts/linkedin-scraper.cjs"),
        std::env::current_exe()
            .unwrap_or_default()
            .parent()
            .unwrap_or(std::path::Path::new("."))
            .join("../scripts/linkedin-scraper.cjs"),
        std::env::current_exe()
            .unwrap_or_default()
            .parent()
            .unwrap_or(std::path::Path::new("."))
            .join("scripts/linkedin-scraper.cjs"),
    ];

    for candidate in &candidates {
        if candidate.exists() {
            let resolved = candidate
                .canonicalize()
                .unwrap_or_else(|_| candidate.clone())
                .to_string_lossy()
                .to_string();

            // On Windows, canonicalize() returns \\?\C:\... UNC paths
            // which Node.js cannot handle. Strip the \\?\ prefix.
            let cleaned = if resolved.starts_with(r"\\?\") {
                resolved[4..].to_string()
            } else {
                resolved
            };

            return Ok(cleaned);
        }
    }

    Err(format!(
        "Could not find linkedin-scraper.cjs. Searched: {:?}",
        candidates
    ))
}

// ── Tauri Commands ──────────────────────────────────────────────────────

/// Run the full LinkedIn agent: scrape Google Trends → navigate to LinkedIn →
/// wait for login if needed → post content.
/// Opens a VISIBLE Chromium window.
#[tauri::command]
pub async fn run_linkedin_agent(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    content: Option<String>,
) -> Result<AgentRunResult, String> {
    let profile_dir = get_profile_dir(&app)?;

    // Log the action
    let _ = sqlx::query(
        "INSERT INTO logs (id, level, module, message, metadata) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind("INFO")
    .bind("browser_automation")
    .bind("Running LinkedIn Agent: Google Scrape → LinkedIn Post")
    .bind("{}")
    .execute(&state.db)
    .await;

    let input = ScriptInput {
        action: "run_agent".to_string(),
        user_data_dir: profile_dir,
        content,
    };

    let result = run_puppeteer_script(input).await?;

    if !result.success {
        let err = result
            .error
            .unwrap_or_else(|| "Unknown error".to_string());

        let _ = sqlx::query(
            "INSERT INTO logs (id, level, module, message, metadata) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(uuid::Uuid::new_v4().to_string())
        .bind("ERROR")
        .bind("browser_automation")
        .bind(format!("LinkedIn Agent failed: {}", err))
        .bind("{}")
        .execute(&state.db)
        .await;

        return Err(err);
    }

    // Parse the full result
    let agent_result: AgentRunResult = result
        .data
        .map(|d| {
            serde_json::from_value(d).unwrap_or(AgentRunResult {
                trends: vec![],
                post_content: None,
                post_result: None,
                message: Some("Completed but failed to parse result.".to_string()),
            })
        })
        .unwrap_or(AgentRunResult {
            trends: vec![],
            post_content: None,
            post_result: None,
            message: Some("No data returned.".to_string()),
        });

    // Persist trends
    for trend in &agent_result.trends {
        let _ = sqlx::query(
            "INSERT OR IGNORE INTO linkedin_trends (id, title, subtitle, author, hashtags, source, item_type) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(&trend.title)
        .bind(&trend.subtitle)
        .bind(&trend.author)
        .bind(trend.hashtags.as_ref().map(|h| h.join(", ")))
        .bind(&trend.source)
        .bind(&trend.item_type)
        .execute(&state.db)
        .await;
    }

    // Log success
    let _ = sqlx::query(
        "INSERT INTO logs (id, level, module, message, metadata) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind("INFO")
    .bind("browser_automation")
    .bind(format!(
        "LinkedIn Agent done: {} trends scraped. {}",
        agent_result.trends.len(),
        agent_result.post_result.as_deref().unwrap_or("No post.")
    ))
    .bind("{}")
    .execute(&state.db)
    .await;

    Ok(agent_result)
}

/// Scrape trending topics from Google (no LinkedIn login needed).
/// Opens a VISIBLE Chromium window.
#[tauri::command]
pub async fn scrape_linkedin_trends(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<TrendItem>, String> {
    let profile_dir = get_profile_dir(&app)?;

    let _ = sqlx::query(
        "INSERT INTO logs (id, level, module, message, metadata) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind("INFO")
    .bind("browser_automation")
    .bind("Scraping trends from Google...")
    .bind("{}")
    .execute(&state.db)
    .await;

    let input = ScriptInput {
        action: "scrape_only".to_string(),
        user_data_dir: profile_dir,
        content: None,
    };

    let result = run_puppeteer_script(input).await?;

    if !result.success {
        let err = result.error.unwrap_or_else(|| "Unknown error".to_string());
        return Err(err);
    }

    let trends: Vec<TrendItem> = result
        .data
        .map(|d| serde_json::from_value(d).unwrap_or_default())
        .unwrap_or_default();

    // Persist
    for trend in &trends {
        let _ = sqlx::query(
            "INSERT OR IGNORE INTO linkedin_trends (id, title, subtitle, author, hashtags, source, item_type) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(&trend.title)
        .bind(&trend.subtitle)
        .bind(&trend.author)
        .bind(trend.hashtags.as_ref().map(|h| h.join(", ")))
        .bind(&trend.source)
        .bind(&trend.item_type)
        .execute(&state.db)
        .await;
    }

    let _ = sqlx::query(
        "INSERT INTO logs (id, level, module, message, metadata) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind("INFO")
    .bind("browser_automation")
    .bind(format!("Google scrape done: {} trends.", trends.len()))
    .bind("{}")
    .execute(&state.db)
    .await;

    Ok(trends)
}

/// Post content to LinkedIn. If not logged in, waits for user login.
/// Opens a VISIBLE Chromium window.
#[tauri::command]
pub async fn post_to_linkedin(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    content: String,
) -> Result<String, String> {
    if content.trim().is_empty() {
        return Err("Post content cannot be empty.".to_string());
    }

    let profile_dir = get_profile_dir(&app)?;

    let _ = sqlx::query(
        "INSERT INTO logs (id, level, module, message, metadata) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind("INFO")
    .bind("browser_automation")
    .bind(format!("Posting to LinkedIn ({} chars)...", content.len()))
    .bind("{}")
    .execute(&state.db)
    .await;

    let input = ScriptInput {
        action: "post_only".to_string(),
        user_data_dir: profile_dir,
        content: Some(content.clone()),
    };

    let result = run_puppeteer_script(input).await?;

    if !result.success {
        let err = result.error.unwrap_or_else(|| "Unknown error".to_string());
        return Err(err);
    }

    let _ = sqlx::query(
        "INSERT INTO logs (id, level, module, message, metadata) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind("INFO")
    .bind("browser_automation")
    .bind("LinkedIn post submitted successfully!")
    .bind(
        serde_json::json!({ "content_preview": content.chars().take(100).collect::<String>() })
            .to_string(),
    )
    .execute(&state.db)
    .await;

    Ok("Post submitted successfully!".to_string())
}

/// Get previously scraped trends from the database.
#[tauri::command]
pub async fn get_saved_trends(state: State<'_, AppState>) -> Result<Vec<TrendItem>, String> {
    let rows = sqlx::query(
        "SELECT title, subtitle, author, hashtags, source, item_type FROM linkedin_trends ORDER BY scraped_at DESC LIMIT 50",
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let trends: Vec<TrendItem> = rows
        .iter()
        .map(|row| {
            let hashtags_str: Option<String> = row.get("hashtags");
            TrendItem {
                title: row.get("title"),
                subtitle: row.get("subtitle"),
                author: row.get("author"),
                hashtags: hashtags_str
                    .map(|s| s.split(", ").map(|h| h.to_string()).collect()),
                source: row.get("source"),
                item_type: row.get("item_type"),
            }
        })
        .collect();

    Ok(trends)
}
