import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface LogEntry {
    id: string;
    timestamp: string;
    level: string;
    module: string;
    message: string;
    metadata: string;
}

export interface AgentConfig {
    name: string;
    role: string;
    description: string;
    schedule: string;
    tasks: string[];
    tools: string[];
    event_triggers?: string[];
}

/**
 * Check if the app is running inside the Tauri webview.
 * `window.__TAURI_INTERNALS__` is injected by the Tauri runtime;
 * if absent, the frontend was opened in a regular browser.
 */
function isTauriAvailable(): boolean {
    return typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;
}

/**
 * Safe invoke wrapper — throws a user-friendly error instead of
 * "Cannot read properties of undefined (reading 'invoke')".
 */
async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    if (!isTauriAvailable()) {
        throw new Error(
            `Tauri IPC is not available. Make sure you run the app with "npm run tauri dev" instead of "npm run dev". ` +
            `Command "${cmd}" cannot be called from a regular browser.`
        );
    }
    return await invoke<T>(cmd, args);
}

/**
 * Safe listen wrapper — returns a no-op unlisten if Tauri is unavailable.
 */
function safeListen<T>(event: string, callback: (payload: T) => void): Promise<() => void> {
    if (!isTauriAvailable()) {
        console.warn(`[Tauri] Cannot listen for "${event}" — not running inside Tauri webview.`);
        return Promise.resolve(() => { });
    }
    return listen<T>(event, (e) => callback(e.payload));
}

export interface AgentRecord {
    id: string;
    name: string;
    role: string;
    config: string;
    created_at: string;
    schedule_expression: string | null;
    enabled: boolean;
}

// Wrappers for Tauri commands
export const api = {
    /** Returns true when the Tauri IPC bridge is available. */
    isTauri: isTauriAvailable,

    greet: async (name: string): Promise<string> => {
        return await safeInvoke("greet", { name });
    },

    checkOpenClaw: async (): Promise<boolean> => {
        return await safeInvoke("check_openclaw_installed");
    },

    installOpenClaw: async (): Promise<void> => {
        return await safeInvoke("install_openclaw");
    },

    chat: async (prompt: string): Promise<string> => {
        return await safeInvoke("chat", { prompt });
    },

    toggleSandbox: async (enabled: boolean): Promise<void> => {
        return await safeInvoke("toggle_sandbox", { enabled });
    },

    createSchedule: async (schedule: string, command: string): Promise<string> => {
        return await safeInvoke("create_schedule", { schedule, command });
    },

    generateAgentConfig: async (prompt: string): Promise<AgentConfig> => {
        return await safeInvoke("generate_agent_config", { prompt });
    },

    deployAgent: async (config: AgentConfig): Promise<string> => {
        return await safeInvoke("deploy_agent", { config });
    },

    getAgents: async (): Promise<AgentRecord[]> => {
        return await safeInvoke("get_agents");
    },

    deleteAgent: async (agentId: string): Promise<void> => {
        return await safeInvoke("delete_agent", { agentId });
    },

    getLogs: async (): Promise<LogEntry[]> => {
        return await safeInvoke("get_logs");
    },

    saveLlmSetting: async (key: string, value: string): Promise<void> => {
        return await safeInvoke("save_llm_setting", { key, value });
    },

    getLlmSetting: async (key: string): Promise<string | null> => {
        return await safeInvoke("get_llm_setting", { key });
    },

    logApproval: async (agentId: string, action: string, status: string): Promise<void> => {
        return await safeInvoke("log_approval", { agentId, action, status });
    },

    // ── LinkedIn Agent ───────────────────────────────────

    /** Full flow: Opens Chromium → scrapes Google Trends → posts to LinkedIn */
    runLinkedInAgent: async (content?: string): Promise<AgentRunResult> => {
        return await safeInvoke("run_linkedin_agent", { content: content || null });
    },

    /** Scrape trending topics from Google (no LinkedIn login needed) */
    scrapeLinkedInTrends: async (): Promise<TrendItem[]> => {
        return await safeInvoke("scrape_linkedin_trends");
    },

    /** Post content to LinkedIn (waits for login if needed) */
    postToLinkedIn: async (content: string): Promise<string> => {
        return await safeInvoke("post_to_linkedin", { content });
    },

    /** Get previously scraped trends from DB */
    getSavedTrends: async (): Promise<TrendItem[]> => {
        return await safeInvoke("get_saved_trends");
    },

    // Listeners
    onCliOutput: (callback: (output: string) => void) => {
        return safeListen<string>("cli-output", callback);
    },

    onLlmToken: (callback: (token: string) => void) => {
        return safeListen<string>("llm-token", callback);
    },

    onLlmStatus: (callback: (status: string) => void) => {
        return safeListen<string>("llm-status", callback);
    }
};

export interface AgentRunResult {
    trends: TrendItem[];
    postContent?: string;
    postResult?: string;
    message?: string;
}

export interface TrendItem {
    title: string;
    subtitle?: string;
    author?: string;
    hashtags?: string[];
    source?: string;
    item_type?: string;
}
