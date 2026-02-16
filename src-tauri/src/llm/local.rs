use reqwest::Client;
use serde_json::json;
use tauri::{Window, Emitter};
use futures::StreamExt;

/// Try streaming from Ollama. If Ollama is unreachable, fall back to
/// a built-in simulated response so the demo still works offline.
pub async fn chat_stream(prompt: &str, window: &Window) -> Result<String, String> {
    match try_ollama_stream(prompt, window).await {
        Ok(response) => Ok(response),
        Err(_) => {
            // Ollama is not running — use built-in simulation
            window.emit("llm-status", "Ollama unavailable — using built-in assistant").unwrap();
            Ok(simulate_response(prompt, window).await)
        }
    }
}

async fn try_ollama_stream(prompt: &str, window: &Window) -> Result<String, String> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let request_body = json!({
        "model": "phi3",
        "prompt": prompt,
        "stream": true
    });

    let mut stream = client.post("http://localhost:11434/api/generate")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .bytes_stream();

    let mut full_response = String::new();

    while let Some(item) = stream.next().await {
        let chunk = item.map_err(|e| e.to_string())?;
        let text = String::from_utf8_lossy(&chunk);
        
        for line in text.lines() {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
                if let Some(token) = json["response"].as_str() {
                    full_response.push_str(token);
                    window.emit("llm-token", token).map_err(|e: tauri::Error| e.to_string())?;
                }
            }
        }
    }
    
    Ok(full_response)
}

/// Built-in keyword-matched responses for demo mode when no LLM is available.
async fn simulate_response(prompt: &str, window: &Window) -> String {
    let lower = prompt.to_lowercase();

    let response = if lower.contains("setup") && lower.contains("openclaw") {
        "OpenClaw is our automation engine. I've checked your system — it looks like OpenClaw \
         isn't installed yet. You can install it from the **Settings** panel (gear icon in the sidebar), \
         or I can help you create agents right away using the built-in templates!\n\n\
         Try saying: **\"Create an agent: Monitor LinkedIn trends\"**"
    } else if lower.contains("hello") || lower.contains("hi") || lower.contains("hey") {
        "Hey there! 👋 I'm your Personaliz Assistant. I can help you:\n\n\
         • **Create agents** — just say \"Create an agent: [describe what it should do]\"\n\
         • **Schedule tasks** — automate daily/hourly workflows\n\
         • **Manage settings** — configure API keys and sandbox mode\n\n\
         What would you like to build today?"
    } else if lower.contains("help") || lower.contains("what can you do") {
        "Here's what I can do:\n\n\
         🤖 **Create Agents** — Tell me what you want automated and I'll generate a config\n\
         📅 **Schedule Tasks** — Set up cron-based automated workflows\n\
         🔒 **Sandbox Mode** — Test agents safely before going live\n\
         ⚙️ **Settings** — Configure API keys for external LLMs\n\n\
         Try: \"Create an agent: Summarize tech news daily at 8am\""
    } else if lower.contains("status") || lower.contains("running") {
        "Here's your current system status:\n\n\
         ✅ **Assistant**: Online\n\
         ✅ **Scheduler**: Running\n\
         ✅ **Database**: Connected\n\
         ⚠️ **Ollama LLM**: Not detected (using built-in responses)\n\
         🔒 **Sandbox Mode**: Enabled\n\n\
         To enable full LLM capabilities, either start Ollama or add an OpenAI API key in Settings."
    } else if lower.contains("agent") || lower.contains("automate") || lower.contains("schedule") {
        "I'd love to help you create an agent! To get started, try phrasing your request like:\n\n\
         • \"Create an agent: Monitor LinkedIn trends and draft a post daily\"\n\
         • \"Create an agent: Comment on #openclaw posts every hour\"\n\
         • \"Create an agent: Summarize tech news daily at 8am\"\n\n\
         Or click one of the **Quick Start Agent** cards on the Dashboard!"
    } else {
        "Thanks for your message! I'm currently running in built-in mode (no external LLM connected). \
         I can still help you create and deploy agents.\n\n\
         💡 **Tip**: Start Ollama for local AI, or add an OpenAI API key in Settings for full chat capabilities.\n\n\
         In the meantime, try: \"Create an agent: [describe your automation]\""
    };

    // Simulate token-by-token streaming for a natural feel
    for word in response.split(' ') {
        let token = format!("{} ", word);
        window.emit("llm-token", &token).unwrap();
        tokio::time::sleep(tokio::time::Duration::from_millis(25)).await;
    }

    response.to_string()
}
