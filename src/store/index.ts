import { create } from 'zustand';
import { api } from '../lib/api';

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    agentConfig?: AgentConfig;
    status?: 'pending' | 'approved' | 'rejected' | 'cancelled';
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

export interface Agent {
    id: string;
    name: string;
    role: string;
    schedule: string;
    status: 'active' | 'inactive' | 'pending';
}

interface AppState {
    // Chat State
    messages: Message[];
    addMessage: (message: Message) => void;
    updateMessageStatus: (id: string, status: 'approved' | 'rejected' | 'cancelled') => void;
    isThinking: boolean;
    setThinking: (thinking: boolean) => void;
    streamingBuffer: string;
    appendToStream: (chunk: string) => void;
    commitStream: () => void;
    // App State
    isOpen: boolean; // Is the chat panel open
    togglePanel: () => void;
    sandboxMode: boolean;
    toggleSandbox: () => Promise<void>;
    // System State
    isInstalling: boolean;
    openClawStatus: 'checking' | 'installed' | 'missing' | 'installing';
    checkStatus: () => Promise<void>;
    installOpenClaw: () => Promise<void>;
    currentModel: string;
    setCurrentModel: (model: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
    messages: [{
        id: 'welcome',
        role: 'assistant',
        content: [
            "👋 **Welcome to Personaliz Desktop Assistant!**",
            "",
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            "📋 **SYSTEM STATUS**",
            `• 🖥️ Platform: **${typeof navigator !== 'undefined' ? navigator.platform : 'Desktop'}**`,
            "• ✅ Database: Connected",
            "• ✅ Scheduler: Running",
            "• 🔒 Sandbox Mode: Enabled",
            "",
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            "🚀 **QUICK START**",
            "",
            '• Type **"Help"** — View all chat commands',
            '• Type **"Create an agent: [description]"**',
            '• Type **"Run LinkedIn Trend Monitor"**',
            '• Type **"Setup OpenClaw"** — Install core engine',
            "",
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            "_Assistant is ready. How can I help you today?_"
        ].join("\n"),
        timestamp: Date.now()
    }],
    addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
    updateMessageStatus: (id, status) => set((state) => ({
        messages: state.messages.map(m => m.id === id ? { ...m, status } : m)
    })),
    isThinking: false,
    setThinking: (thinking) => set({ isThinking: thinking }),
    streamingBuffer: '',
    appendToStream: (chunk) => set((state) => ({ streamingBuffer: state.streamingBuffer + chunk })),
    commitStream: () => set((state) => {
        const newMsg: Message = {
            id: Date.now().toString(),
            role: 'assistant',
            content: state.streamingBuffer,
            timestamp: Date.now()
        };
        return { messages: [...state.messages, newMsg], streamingBuffer: '' };
    }),

    isOpen: false,
    togglePanel: () => set((state) => ({ isOpen: !state.isOpen })),
    sandboxMode: true, // Default to safe mode
    toggleSandbox: async () => {
        const newVal = !get().sandboxMode;
        await api.toggleSandbox(newVal);
        set({ sandboxMode: newVal });
    },

    isInstalling: false,
    openClawStatus: 'checking',
    checkStatus: async () => {
        const installed = await api.checkOpenClaw();
        set({ openClawStatus: installed ? 'installed' : 'missing' });
    },
    installOpenClaw: async () => {
        set({ isInstalling: true, openClawStatus: 'installing' });
        try {
            await api.installOpenClaw();
            set({ openClawStatus: 'installed', isInstalling: false });
            get().addMessage({
                id: Date.now().toString(),
                role: 'system',
                content: 'OpenClaw has been successfully installed!',
                timestamp: Date.now()
            });
        } catch (e) {
            set({ openClawStatus: 'missing', isInstalling: false });
            get().addMessage({
                id: Date.now().toString(),
                role: 'system',
                content: `Installation failed: ${e}`,
                timestamp: Date.now()
            });
        }
    },

    currentModel: 'Local (Phi-3)',
    setCurrentModel: (model) => set({ currentModel: model }),
}));
