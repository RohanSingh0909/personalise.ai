use tokio_cron_scheduler::{Job, JobScheduler};
use std::sync::Arc;
use tokio::sync::Mutex;
use sqlx::SqlitePool;
use sqlx::Row;
use tauri::State;
use crate::AppState;

pub struct SchedulerService {
    scheduler: JobScheduler,
    db_pool: SqlitePool,
}

impl SchedulerService {
    pub async fn new(db_pool: SqlitePool) -> Self {
        let scheduler = JobScheduler::new().await.expect("Failed to create scheduler");
        Self {
            scheduler,
            db_pool,
        }
    }
    
    pub async fn start(&self) -> Result<(), String> {
        self.scheduler.start().await.map_err(|e| e.to_string())
    }

    pub async fn add_cron_job(&self, schedule: &str, _command: String) -> Result<String, String> {
        let pool = self.db_pool.clone();
        let cmd = _command.clone();
        
        let job = Job::new_async(schedule, move |_uuid, _l| {
            let pool = pool.clone();
            let cmd = cmd.clone();
            Box::pin(async move {
                // Check if this is an Agent run
                if cmd.starts_with("Run Agent: ") {
                    let agent_name = cmd.trim_start_matches("Run Agent: ");
                    // Check Sandbox Status
                    let sandbox = sqlx::query("SELECT value FROM llm_settings WHERE key = 'sandbox_enabled'")
                        .fetch_optional(&pool)
                        .await
                        .unwrap_or(None)
                        .map(|row| sqlx::Row::try_get::<String, _>(&row, "value").unwrap_or_default() == "true")
                        .unwrap_or(false);

                    if sandbox {
                         let _ = sqlx::query("INSERT INTO logs (id, level, module, message, metadata) VALUES (?, ?, ?, ?, ?)")
                            .bind(uuid::Uuid::new_v4().to_string())
                            .bind("INFO")
                            .bind("scheduler")
                            .bind(format!("[SANDBOX] Simulating run for agent: {}", agent_name))
                            .bind("{}")
                            .execute(&pool)
                            .await;
                            
                        // Simulate steps (mock)
                        let _ = sqlx::query("INSERT INTO logs (id, level, module, message, metadata) VALUES (?, ?, ?, ?, ?)")
                            .bind(uuid::Uuid::new_v4().to_string())
                            .bind("INFO")
                            .bind("browser_automation")
                            .bind(format!("[SANDBOX] Opening browser for {}", agent_name))
                            .bind("{}")
                            .execute(&pool)
                            .await;
                            
                        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                         let _ = sqlx::query("INSERT INTO logs (id, level, module, message, metadata) VALUES (?, ?, ?, ?, ?)")
                            .bind(uuid::Uuid::new_v4().to_string())
                            .bind("INFO")
                            .bind("browser_automation")
                            .bind(format!("[SANDBOX] Navigating to LinkedIn..."))
                            .bind("{}")
                            .execute(&pool)
                            .await;
                    } else {
                        // Real Execution
                        println!("Running real command: {}", cmd);
                        let _ = sqlx::query("INSERT INTO logs (id, level, module, message, metadata) VALUES (?, ?, ?, ?, ?)")
                            .bind(uuid::Uuid::new_v4().to_string())
                            .bind("INFO")
                            .bind("scheduler")
                            .bind(format!("Executing job: {}", cmd))
                            .bind("{}")
                            .execute(&pool)
                            .await;
                    }
                } else {
                    // Generic job
                    println!("Running scheduled command: {}", cmd);
                    let _ = sqlx::query("INSERT INTO logs (id, level, module, message, metadata) VALUES (?, ?, ?, ?, ?)")
                        .bind(uuid::Uuid::new_v4().to_string())
                        .bind("INFO")
                        .bind("scheduler")
                        .bind(format!("Executed job: {}", cmd))
                        .bind("{}")
                        .execute(&pool)
                        .await;
                }
            })
        }).map_err(|e| e.to_string())?;

        let id = self.scheduler.add(job).await.map_err(|e| e.to_string())?;
        Ok(id.to_string())
    }
}

#[tauri::command]
pub async fn create_schedule(state: State<'_, AppState>, schedule: String, command: String) -> Result<String, String> {
    let scheduler = state.scheduler.lock().await;
    scheduler.add_cron_job(&schedule, command).await
}
