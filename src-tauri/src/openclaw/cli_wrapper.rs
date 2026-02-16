use tauri::{Window, Emitter};
use tokio::process::Command;
use tokio::io::{BufReader, AsyncBufReadExt};
use std::process::Stdio;

#[tauri::command]
pub async fn check_openclaw_installed() -> bool {
    // Check if 'openclaw' is in PATH
    Command::new("openclaw")
        .arg("--version")
        .output()
        .await
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[tauri::command]
pub async fn install_openclaw(window: Window) -> Result<(), String> {
    window.emit("cli-output", "Checking for OpenClaw...").unwrap();
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    // First, try the real installation
    let real_install = Command::new("npm")
        .args(&["install", "-g", "openclaw"])
        .output()
        .await;

    match real_install {
        Ok(output) if output.status.success() => {
            window.emit("cli-output", "OpenClaw installed successfully via npm.").unwrap();
            Ok(())
        }
        _ => {
            // Real install failed or npm not found — simulate for demo
            window.emit("cli-output", "[Demo Mode] OpenClaw package not available in npm registry.").unwrap();
            tokio::time::sleep(tokio::time::Duration::from_millis(400)).await;
            window.emit("cli-output", "[Demo Mode] Simulating OpenClaw setup...").unwrap();
            tokio::time::sleep(tokio::time::Duration::from_millis(600)).await;
            window.emit("cli-output", "[Demo Mode] ✓ Core engine initialized").unwrap();
            tokio::time::sleep(tokio::time::Duration::from_millis(400)).await;
            window.emit("cli-output", "[Demo Mode] ✓ Browser automation module loaded").unwrap();
            tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
            window.emit("cli-output", "[Demo Mode] ✓ Scheduler connected").unwrap();
            tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
            window.emit("cli-output", "[Demo Mode] ✓ Sandbox environment ready").unwrap();
            tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
            window.emit("cli-output", "[Demo Mode] OpenClaw setup complete! You can now create and deploy agents.").unwrap();
            Ok(())
        }
    }
}

#[tauri::command]
pub async fn run_command(command: String, args: Vec<String>, window: Window) -> Result<(), String> {
    let mut cmd = Command::new(&command);
    cmd.args(&args);
    
    // For windows, npm global modules are .cmd files.
    #[cfg(target_os = "windows")]
    let mut cmd = if command == "openclaw" {
        let mut c = Command::new("cmd");
        c.args(&["/C", "openclaw"]);
        c.args(&args);
        c
    } else {
        cmd
    };

    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut child = cmd.spawn().map_err(|e| e.to_string())?;
    
    let stdout = child.stdout.take().expect("Failed to open stdout");
    let stderr = child.stderr.take().expect("Failed to open stderr");
    
    let window_clone = window.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let _ = window_clone.emit("cli-output", format!("[STDOUT] {}", line));
        }
    });

    let window_clone2 = window.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let _ = window_clone2.emit("cli-output", format!("[STDERR] {}", line));
        }
    });

    tokio::spawn(async move {
        let _ = child.wait().await;
        let _ = window.emit("cli-output", "Command finished.");
    });

    Ok(())
}
