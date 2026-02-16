#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod db;
mod llm;
mod openclaw;
mod scheduler;
mod sandbox;
mod logs; // Used by scheduler but module needs to be available

use tauri::Manager;
use std::sync::Arc;
use tokio::sync::Mutex;
use sqlx::Row;
use crate::scheduler::SchedulerService;

pub struct AppState {
    pub db: sqlx::SqlitePool,
    pub scheduler: Arc<Mutex<SchedulerService>>,
}

fn main() {
    tracing_subscriber::fmt::init();

    println!("Starting application...");

    tauri::Builder::default()
        .setup(|app| {
            // Resolve the app data directory (outside project tree)
            let app_data_dir = app.path().app_data_dir()
                .expect("Failed to resolve app data directory");
            println!("App data dir: {:?}", app_data_dir);

            let db_path = app_data_dir.join("personaliz.db");

            // Use Tauri's async runtime (persists for the app's entire lifetime)
            // so the scheduler's background tasks stay alive.
            let db_pool = tauri::async_runtime::block_on(async {
                println!("Initializing Database...");
                let pool = db::init(&db_path).await
                    .expect("Failed to init database");
                println!("Database initialized.");
                pool
            });

            let scheduler = tauri::async_runtime::block_on(async {
                println!("Initializing Scheduler...");
                let scheduler_service = SchedulerService::new(db_pool.clone()).await;
                let scheduler = Arc::new(Mutex::new(scheduler_service));
                println!("Scheduler initialized.");

                println!("Starting Scheduler...");
                if let Err(e) = scheduler.lock().await.start().await {
                    eprintln!("Failed to start scheduler: {:?}", e);
                }
                println!("Scheduler started.");
                scheduler
            });

            // Manage state
            app.manage(AppState {
                db: db_pool,
                scheduler,
            });

            // Open devtools in debug mode
            let window = app.get_webview_window("main").unwrap();
            #[cfg(debug_assertions)]
            window.open_devtools();

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            llm::router::chat,
            openclaw::cli_wrapper::check_openclaw_installed,
            openclaw::cli_wrapper::install_openclaw,
            openclaw::cli_wrapper::run_command,
            openclaw::agent_builder::generate_agent_config,
            openclaw::agent_builder::deploy_agent,
            openclaw::agent_builder::get_agents,
            openclaw::agent_builder::delete_agent,
            scheduler::create_schedule,
            logs::get_logs,
            sandbox::toggle_sandbox,
            save_llm_setting,
            get_llm_setting,
            log_approval
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Personaliz.", name)
}

/// Persist an LLM setting (e.g. "openai_api_key") to the database.
#[tauri::command]
async fn save_llm_setting(
    state: tauri::State<'_, AppState>,
    key: String,
    value: String,
) -> Result<(), String> {
    sqlx::query("INSERT OR REPLACE INTO llm_settings (key, value) VALUES (?, ?)")
        .bind(&key)
        .bind(&value)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Read an LLM setting back from the database.
#[tauri::command]
async fn get_llm_setting(
    state: tauri::State<'_, AppState>,
    key: String,
) -> Result<Option<String>, String> {
    let row = sqlx::query("SELECT value FROM llm_settings WHERE key = ?")
        .bind(&key)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(row.map(|r| sqlx::Row::get(&r, "value")))
}

/// Write to the approval_history table for audit trail.
#[tauri::command]
async fn log_approval(
    state: tauri::State<'_, AppState>,
    agent_id: String,
    action: String,
    status: String,
) -> Result<(), String> {
    let aid: Option<&str> = if agent_id.is_empty() { None } else { Some(&agent_id) };
    sqlx::query("INSERT INTO approval_history (id, agent_id, action, status) VALUES (?, ?, ?, ?)")
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(aid)
        .bind(&action)
        .bind(&status)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

