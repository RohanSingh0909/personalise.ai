# Personaliz Desktop Assistant

A production-quality desktop wrapper around [OpenClaw](https://github.com/openclaw/openclaw) designed for non-technical users. Built with **Tauri v2 + React + Rust**.

> **No CLI required.** Create, schedule, and manage automation agents through a conversational interface.

---

## 🚀 Features

- **Conversational Interface**: Chat with your local assistant to build automation agents
- **Local & Cloud LLMs**: Runs offline with Phi-3 (Ollama) or connects to OpenAI GPT-4o
- **Agent Sandbox**: Simulate browser actions safely before deploying
- **Visual Scheduler**: Manage cron jobs and recurring tasks with a modern UI
- **OpenClaw Integration**: Automatically installs and manages OpenClaw CLI in the background
- **Approval Flow**: Human confirmation before any public posting action
- **Observability**: Real-time logs, execution history, and LLM routing visibility stored in local SQLite
- **Event Handlers**: Polling-based heartbeats, periodic checks, and web event detection triggers

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Tauri Desktop App                 │
├──────────────────┬──────────────────────────────────┤
│  Frontend (React)│  Backend (Rust)                  │
│  ┌─────────────┐ │  ┌──────────────┐               │
│  │ ChatPanel    │ │  │ LLM Router   │──┐            │
│  │ AgentPreview │ │  │ (router.rs)  │  │            │
│  │ SettingsPanel│ │  └──────────────┘  │            │
│  │ FloatingIcon │ │  ┌──────────────┐  │            │
│  └─────────────┘ │  │ CLI Wrapper  │  ▼            │
│  ┌─────────────┐ │  │(cli_wrapper) │ ┌────────┐   │
│  │ Zustand Store│ │  └──────────────┘ │ Ollama │   │
│  │ (state mgmt) │ │  ┌──────────────┐ │(Local) │   │
│  └─────────────┘ │  │ Scheduler    │ └────────┘   │
│                   │  │(tokio-cron)  │ ┌────────┐   │
│                   │  └──────────────┘ │ OpenAI │   │
│                   │  ┌──────────────┐ │(Cloud) │   │
│                   │  │ Sandbox      │ └────────┘   │
│                   │  └──────────────┘              │
│                   │  ┌──────────────┐              │
│                   │  │ SQLite DB    │              │
│                   │  │ (agents,logs)│              │
│                   │  └──────────────┘              │
└──────────────────┴──────────────────────────────────┘
```

### Key Modules

| Module | File | Purpose |
|--------|------|---------|
| **CLI Wrapper** | `cli_wrapper.rs` | Manages OpenClaw CLI processes, captures stdout/stderr, streams to UI |
| **LLM Router** | `llm/router.rs` | Switches between local (Ollama/Phi-3) and cloud (OpenAI) based on DB config |
| **Local LLM** | `llm/local.rs` | Connects to Ollama API at `localhost:11434`, falls back to built-in responses |
| **External LLM** | `llm/external.rs` | OpenAI GPT-4o API integration |
| **Agent Builder** | `openclaw/agent_builder.rs` | Generates agent configs, deploys to DB + scheduler |
| **Scheduler** | `scheduler/mod.rs` | Async cron scheduler backed by SQLite, sandbox-aware |
| **Sandbox** | `sandbox/mod.rs` | Intercepts agent actions, logs simulated steps instead of real effects |
| **Logs** | `logs/mod.rs` | Execution logging with module-level filtering |

---

## 🧠 LLM Integration

### How Local LLM Works

On first install (no API key), the app uses a **local open-source LLM**:

1. **Primary**: Connects to [Ollama](https://ollama.ai) running locally at `http://localhost:11434`
   - Model: `phi3` (Microsoft Phi-3, small but capable)
   - Supports streaming responses via `/api/chat` endpoint
2. **Fallback**: If Ollama is not installed/running, built-in keyword-based responses handle:
   - Agent creation (generates mock configs based on keywords)
   - Setup guidance
   - Help and status queries

### How Model Switching Works

```
On every chat request:
  1. Check DB → SELECT value FROM llm_settings WHERE key = 'openai_api_key'
  2. If API key exists and is non-empty:
     → Route to OpenAI GPT-4o API
     → On failure: fall back to local model
  3. Else:
     → Route to Ollama (localhost:11434)
     → On failure: use built-in responses
  4. Log routing decision to DB (module: 'llm_router')
```

**Implementation** (`llm/router.rs`):
- Every request is logged with the routing decision
- The `llm-status` event is emitted to the frontend so the UI shows which model is active
- Automatic fallback chain ensures the app always responds

### Switching Models via Settings UI

1. Go to **Settings** tab (gear icon)
2. Select **Local (Phi-3)** or **External (OpenAI)**
3. If External: enter your API key → click **Save**
4. The key is persisted to SQLite (`llm_settings` table)
5. All subsequent LLM calls automatically use the saved key
6. Switching back to Local clears the key from DB

---

## ⏰ Scheduling System

### How Scheduling Works

1. **Agent Creation**: When an agent is approved, `deploy_agent()`:
   - Saves the agent config JSON to the `agents` table
   - Parses the schedule (e.g., "daily" → `0 0 9 * * *`)
   - Creates a cron job via `tokio-cron-scheduler`
   - Saves a record in the `schedules` table

2. **Runtime**: The scheduler runs in the Tauri async runtime (Tokio):
   - Jobs persist across the app session
   - Each job checks sandbox mode before execution
   - All executions are logged to the `logs` table

3. **Cron Expressions Supported**:
   - `0 0 9 * * *` — Daily at 9:00 AM
   - `0 * * * * *` — Every minute
   - `0 0 * * * *` — Every hour
   - Custom 6-field cron expressions

4. **Viewing Schedules**: The **Scheduled Agents** tab shows:
   - Agent name, role, tools, tasks, event triggers
   - Human-readable schedule description
   - Active/Paused status
   - Delete button

---

## 🔒 Sandbox Mode

### How Sandbox Mode Works

1. **Toggle**: In Settings, flip the Sandbox Mode switch
2. **Persistence**: The setting is saved to `llm_settings` table (`key='sandbox_enabled'`)
3. **Behavior When Enabled** (default):
   - Scheduled agents run but **do not execute real actions**
   - Instead, they log simulated steps: `[SANDBOX] Simulating run for agent: ...`
   - Browser automation is simulated: `[SANDBOX] Opening browser...`, `[SANDBOX] Navigating to LinkedIn...`
   - All actions visible in the **Sandbox Activity** tab
4. **Behavior When Disabled**:
   - Agents execute real commands
   - Real browser automation runs
   - All actions still logged for audit

### Safety Guarantees

- Sandbox is **enabled by default** on first install
- Agents never post to real social media unless sandbox is explicitly disabled
- Every action (simulated or real) is logged with timestamp and module

---

## 🎯 Event Handlers

Agents support event-based triggers in addition to cron schedules:

| Trigger Type | Description | Example |
|-------------|-------------|---------|
| `daily_heartbeat` | Periodic health check, fires daily | LinkedIn Trend Monitor |
| `hourly_poll` | Polls for new content every hour | Hashtag Engagement Bot |
| `on_trending_spike` | Fires when trending topics are detected | Trend analysis agents |
| `new_post_with_hashtag` | Fires when a new post with target hashtag appears | Engagement bots |
| `periodic_check` | General-purpose periodic polling | General agents |

Event triggers are stored in the agent config JSON and displayed in both the Agent Preview and Scheduled Agents views.

---

## 📋 Approval Flow & Audit Trail

1. User requests agent creation via chat
2. Agent config is generated and shown in **AgentPreview** component
3. User reviews: Name, Role, Schedule, Tools, Event Triggers, Tasks
4. User clicks **Approve & Deploy** or **Edit / Cancel**
5. Decision is logged to `approval_history` table:
   - `agent_id`, `action`, `status` (APPROVED/REJECTED), `timestamp`
6. Approved agents are immediately deployed and scheduled

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Desktop Framework** | Tauri v2 |
| **Frontend** | React 18, TypeScript, TailwindCSS v4, Framer Motion, Zustand |
| **Backend** | Rust (Tokio, SQLx, tracing, reqwest) |
| **Database** | SQLite (via sqlx) |
| **Scheduler** | tokio-cron-scheduler |
| **LLM (Local)** | Ollama + Phi-3 |
| **LLM (Cloud)** | OpenAI GPT-4o |

---

## 🗂 Database Schema

| Table | Purpose |
|-------|---------|
| `agents` | Stores deployed agent configs (id, name, role, config JSON, created_at) |
| `schedules` | Links agents to cron expressions (agent_id, schedule_expression, enabled) |
| `logs` | Execution logs with module tagging (scheduler, llm_router, browser_automation) |
| `events` | Event history for trigger-based actions |
| `llm_settings` | Key-value store for LLM config (API keys, sandbox mode, model preference) |
| `approval_history` | Audit trail for agent approvals and rejections |

---

## 🏃‍♂️ Getting Started

### Prerequisites

- **Node.js & npm** (v18+)
- **Rust & Cargo** (latest stable)
- *(Optional)* [Ollama](https://ollama.ai) installed for local LLM support

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/personaliz.git
   cd personaliz
   ```

2. **Install Frontend Dependencies**
   ```bash
   npm install
   ```

3. **Run Development Mode**
   ```bash
   npm run tauri dev
   ```
   This starts the React dev server and the Tauri application window.

4. **Build for Production**
   ```bash
   npm run tauri build
   ```

### First Launch

On first launch, the assistant will:
1. Detect your OS platform
2. Initialize the SQLite database
3. Start the cron scheduler
4. Show a welcome message with system status
5. Guide you to set up OpenClaw or create your first agent

---

## 🧪 Demo Agents

### Demo 1: LinkedIn Trend Monitor
**Objective**: Search trending topics and draft a LinkedIn post daily.

**Flow**:
1. User says: *"Create an agent: Monitor LinkedIn trends and draft a post daily"*
2. Agent config generated with:
   - Schedule: Daily at 9:00 AM
   - Tools: browser, linkedin_api
   - Event Triggers: on_trending_spike, daily_heartbeat
   - Tasks: Search trending topics → Draft post → Preview → Post to feed
3. User reviews in AgentPreview → clicks **Approve & Deploy**
4. Agent added to scheduler, approval logged
5. In Sandbox mode: simulates browser actions and logs results
6. Agent appears in Scheduled Agents tab with full details

### Demo 2: Hashtag Engagement Bot
**Objective**: Comment on posts with #openclaw hashtag every hour.

**Flow**:
1. User says: *"Create an agent: Comment on #openclaw posts every hour"*
2. Agent config generated with:
   - Schedule: Every minute (for demo) / Every hour (production)
   - Tools: browser, http
   - Event Triggers: new_post_with_hashtag, hourly_poll
   - Tasks: Search #openclaw → Analyze sentiment → Post comment
3. Approved and deployed same as Demo 1
4. Scheduler fires cron job, logs visible in Sandbox Activity → Run History tab

---

## 📊 Observability

### Log Categories

| Module | Color | Description |
|--------|-------|-------------|
| `llm_router` | 🔵 Blue | LLM routing decisions (local vs external) |
| `scheduler` | 🟢 Green | Scheduled job executions and run history |
| `browser_automation` | 🟡 Amber | Browser actions (simulated in sandbox) |

### Filtering Logs

The Sandbox Activity tab includes filter buttons:
- **All Logs** — Show everything
- **Run History** — Only scheduler execution logs
- **LLM Routing** — Shows which model handled each request
- **Browser** — Browser automation actions

---

## 🔐 Security

- API keys are stored **locally only** in SQLite, never transmitted except to the configured API
- Sandbox mode is **enabled by default** — no accidental posting
- All agent deployments require **explicit user approval**
- Approval audit trail is maintained in `approval_history` table

---

## 📄 License

MIT License.
