import { motion } from 'framer-motion';
import { Check, X, Clock, Code, Zap } from 'lucide-react';

export interface AgentConfig {
    name: string;
    role: string;
    description: string;
    schedule: string;
    tasks: string[];
    tools: string[];
    event_triggers?: string[];
}

interface AgentPreviewProps {
    config: AgentConfig;
    onApprove: () => void;
    onCancel: () => void;
}

export const AgentPreview = ({ config, onApprove, onCancel }: AgentPreviewProps) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="my-4 p-4 rounded-xl bg-slate-800/80 border border-indigo-500/30 shadow-lg overflow-hidden"
        >
            <div className="flex justify-between items-start mb-3 border-b border-white/5 pb-2">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <Code className="w-4 h-4 text-indigo-400" />
                    Proposed Agent
                </h3>
                <span className="text-xs font-mono text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded">
                    DRAFT
                </span>
            </div>

            <div className="space-y-3 text-sm">
                <div>
                    <label className="text-xs text-slate-500 block mb-1">Name</label>
                    <div className="text-slate-200 font-medium">{config.name}</div>
                </div>

                <div>
                    <label className="text-xs text-slate-500 block mb-1">Goal</label>
                    <div className="text-slate-300 italic">"{config.description}"</div>
                </div>

                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="text-xs text-slate-500 block mb-1">Schedule</label>
                        <div className="flex items-center gap-1 text-slate-200">
                            <Clock className="w-3 h-3 text-amber-500" />
                            {config.schedule}
                        </div>
                    </div>
                </div>

                <div>
                    <label className="text-xs text-slate-500 block mb-1">Capabilities/Tools</label>
                    <div className="flex flex-wrap gap-2">
                        {config.tools.map(tool => (
                            <span key={tool} className="px-2 py-1 rounded bg-slate-700 text-xs text-slate-300 border border-white/5">
                                {tool}
                            </span>
                        ))}
                    </div>
                </div>

                {config.event_triggers && config.event_triggers.length > 0 && (
                    <div>
                        <label className="text-xs text-slate-500 block mb-1">Event Triggers</label>
                        <div className="flex flex-wrap gap-2">
                            {config.event_triggers.map(trigger => (
                                <span key={trigger} className="px-2 py-1 rounded bg-amber-500/10 text-xs text-amber-300 border border-amber-500/20 flex items-center gap-1">
                                    <Zap size={10} />
                                    {trigger}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {config.tasks && config.tasks.length > 0 && (
                    <div>
                        <label className="text-xs text-slate-500 block mb-1">Tasks</label>
                        <div className="flex flex-wrap gap-2">
                            {config.tasks.map((task, i) => (
                                <span key={i} className="px-2 py-1 rounded bg-slate-700/50 text-xs text-slate-300 border border-white/5">
                                    {i + 1}. {task}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex gap-2 mt-4 pt-3 border-t border-white/5">
                <button
                    onClick={onCancel}
                    className="flex-1 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium transition-colors"
                >
                    Edit / Cancel
                </button>
                <button
                    onClick={onApprove}
                    className="flex-1 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
                >
                    <Check className="w-3 h-3" />
                    Approve & Deploy
                </button>
            </div>
        </motion.div>
    );
};
