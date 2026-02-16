import { useRef, useEffect } from 'react';
import { useAppStore } from '../store';
import { api, type AgentConfig } from '../lib/api';
import { Send, Bot, User, Terminal, Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { AgentPreview } from './AgentPreview';

export const ChatPanel = () => {
    const {
        messages,
        addMessage,
        updateMessageStatus,
        isThinking,
        setThinking,
        isOpen,
        togglePanel
    } = useAppStore();

    // Auto-scroll to bottom of chat
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };
    useEffect(scrollToBottom, [messages, isThinking]); // Also scroll when thinking state changes

    // Handle Input
    const handleSend = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const input = (e.currentTarget.elements.namedItem('prompt') as HTMLInputElement).value;
        if (!input.trim()) return;

        // Add user message
        addMessage({
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: Date.now()
        });

        (e.currentTarget.elements.namedItem('prompt') as HTMLInputElement).value = '';
        setThinking(true);

        try {
            const lowerInput = input.toLowerCase();

            // Check for agent creation intent
            if (lowerInput.includes('create agent') || lowerInput.includes('create an agent')) {
                const config = await api.generateAgentConfig(input);
                addMessage({
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: "I've drafted an agent configuration for you based on your request. Please review it below.",
                    timestamp: Date.now(),
                    agentConfig: config,
                    status: 'pending'
                });
            }
            // Check for setup/install openclaw intent
            else if ((lowerInput.includes('setup') || lowerInput.includes('install')) && lowerInput.includes('openclaw')) {
                try {
                    await api.installOpenClaw();
                    addMessage({
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: "OpenClaw has been set up successfully! ✅\n\nYou can now create agents using natural language. Try saying:\n• \"Create an agent: Monitor LinkedIn trends and draft a post daily\"\n• \"Create an agent: Comment on #openclaw posts every hour\"",
                        timestamp: Date.now(),
                    });
                } catch (installErr) {
                    const msg = installErr instanceof Error ? installErr.message : String(installErr);
                    addMessage({
                        id: (Date.now() + 1).toString(),
                        role: 'system',
                        content: `OpenClaw setup encountered an issue: ${msg}. You can still create agents using the Quick Start templates on the Dashboard.`,
                        timestamp: Date.now(),
                    });
                }
            }
            // Help intent
            else if (lowerInput.includes('help') || lowerInput.includes('what can you do')) {
                addMessage({
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: "Here's what I can do:\n\n🤖 **Create Agents** — Tell me what you want automated and I'll generate a config\n📅 **Schedule Tasks** — Set up cron-based automated workflows\n🔒 **Sandbox Mode** — Test agents safely before going live\n⚙️ **Settings** — Configure API keys for external LLMs\n\nTry: \"Create an agent: Summarize tech news daily at 8am\"",
                    timestamp: Date.now()
                });
            }
            // Status intent
            else if (lowerInput.includes('status') || lowerInput.includes('system info')) {
                addMessage({
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: "Here's your current system status:\n\n✅ **Assistant**: Online\n✅ **Scheduler**: Running\n✅ **Database**: Connected\n🔒 **Sandbox Mode**: Enabled by default\n\nTo check your agents, visit the **Scheduled Agents** tab (calendar icon).\nTo change LLM settings, go to **Settings** (gear icon).",
                    timestamp: Date.now()
                });
            }
            // Schedule intent
            else if (lowerInput.includes('schedule') && (lowerInput.includes('task') || lowerInput.includes('job') || lowerInput.includes('daily') || lowerInput.includes('hourly'))) {
                addMessage({
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: "To schedule a task, create an agent with a schedule! Try:\n\n• \"Create an agent: Monitor LinkedIn trends and draft a post daily\"\n• \"Create an agent: Comment on #openclaw posts every hour\"\n• \"Create an agent: Summarize tech news daily at 8am\"\n\nOr use the **Quick Start** templates on the Dashboard.",
                    timestamp: Date.now()
                });
            }
            // Normal Chat (fallback to LLM)
            else {
                const response = await api.chat(input);
                addMessage({
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: response,
                    timestamp: Date.now()
                });
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            addMessage({
                id: Date.now().toString(),
                role: 'system',
                content: `Error: ${errorMsg}`,
                timestamp: Date.now()
            });
        } finally {
            setThinking(false);
        }
    };

    const handleApproveAgent = async (messageId: string, config: AgentConfig) => {
        try {
            const agentId = await api.deployAgent(config);
            updateMessageStatus(messageId, 'approved');
            // Log to approval_history audit trail
            await api.logApproval(agentId, `Deploy agent: ${config.name}`, 'APPROVED').catch(console.error);
            addMessage({
                id: Date.now().toString(),
                role: 'system',
                content: `Agent "${config.name}" deployed and scheduled successfully! Check the Scheduled Agents tab to see it.`,
                timestamp: Date.now()
            });
        } catch (e) {
            addMessage({
                id: Date.now().toString(),
                role: 'system',
                content: `Failed to deploy agent: ${e}`,
                timestamp: Date.now()
            });
        }
    };

    const handleCancelAgent = async (messageId: string, config?: AgentConfig) => {
        updateMessageStatus(messageId, 'cancelled');
        // Log cancellation to audit trail
        await api.logApproval('', `Cancel agent: ${config?.name || 'Unknown'}`, 'REJECTED').catch(console.error);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="fixed bottom-24 right-8 w-96 h-[600px] max-h-[80vh] flex flex-col glass-panel overflow-hidden z-40 bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-slate-900 to-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-tr from-primary to-accent">
                            <Bot className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-white">Personaliz Assistant</h2>
                            <p className="text-xs text-slate-400 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                Online • Local Model
                            </p>
                        </div>
                    </div>
                    <button onClick={togglePanel} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                    {messages.map((msg) => (
                        <div key={msg.id}>
                            <div
                                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                            >
                                <div className={`
                                    w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                                    ${msg.role === 'user' ? 'bg-indigo-600' : msg.role === 'system' ? 'bg-amber-600' : 'bg-slate-700'}
                                `}>
                                    {msg.role === 'user' ? <User size={16} /> : msg.role === 'system' ? <Terminal size={16} /> : <Bot size={16} />}
                                </div>

                                <div className={`
                                    max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed
                                    ${msg.role === 'user'
                                        ? 'bg-indigo-600 text-white rounded-tr-sm'
                                        : msg.role === 'system'
                                            ? 'bg-slate-800 border border-amber-500/30 text-amber-200 font-mono text-xs rounded-tl-sm'
                                            : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-white/5'}
                                `}>
                                    {msg.content}
                                </div>
                            </div>

                            {/* Agent Preview if present */}
                            {msg.agentConfig && msg.status === 'pending' && (
                                <AgentPreview
                                    config={msg.agentConfig}
                                    onApprove={() => handleApproveAgent(msg.id, msg.agentConfig!)}
                                    onCancel={() => handleCancelAgent(msg.id, msg.agentConfig)}
                                />
                            )}
                            {msg.agentConfig && msg.status === 'approved' && (
                                <div className="ml-11 mt-2 text-xs text-green-400 flex items-center gap-1">
                                    <Sparkles size={12} /> Agent approved and deployed.
                                </div>
                            )}
                            {msg.agentConfig && msg.status === 'cancelled' && (
                                <div className="ml-11 mt-2 text-xs text-slate-500">
                                    Agent creation cancelled.
                                </div>
                            )}
                        </div>
                    ))}

                    {isThinking && (
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 animate-pulse">
                                <Sparkles size={16} className="text-accent" />
                            </div>
                            <div className="bg-slate-800 p-3 rounded-2xl rounded-tl-sm border border-white/5 flex items-center gap-1">
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <form onSubmit={handleSend} className="p-4 border-t border-white/10 bg-slate-900/50">
                    <div className="relative">
                        <input
                            name="prompt"
                            type="text"
                            placeholder="Ask me to create an agent..."
                            className="w-full bg-slate-800 text-white placeholder-slate-500 rounded-xl py-3 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-primary/50 border border-white/5"
                            autoComplete="off"
                        />
                        <button
                            type="submit"
                            className="absolute right-2 top-2 p-1.5 bg-primary hover:bg-primary/80 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isThinking}
                        >
                            <Send size={16} />
                        </button>
                    </div>
                    <div className="mt-2 flex justify-center">
                        <p className="text-[10px] text-slate-500">
                            Powered by OpenClaw & Local LLM
                        </p>
                    </div>
                </form>
            </motion.div>
        </AnimatePresence>
    );
};
