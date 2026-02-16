use reqwest::Client;
use serde_json::json;

pub async fn chat_openai(prompt: &str, api_key: &str) -> Result<String, String> {
    let client = Client::new();
    let res = client.post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&json!({
            "model": "gpt-4o",
            "messages": [{"role": "user", "content": prompt}],
            "stream": false
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("OpenAI API Error: {}", res.status()));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    
    // Extract content
    if let Some(choices) = json["choices"].as_array() {
        if let Some(choice) = choices.first() {
            if let Some(content) = choice["message"]["content"].as_str() {
                return Ok(content.to_string());
            }
        }
    }
    
    Err("Failed to parse OpenAI response".into())
}
