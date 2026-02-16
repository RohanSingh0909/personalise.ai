import { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { api } from '../lib/api';
import { Settings, Shield, Power, HardDrive, Key, Check, Monitor } from 'lucide-react';

export const SettingsPanel = () => {
    const { sandboxMode, toggleSandbox, currentModel, setCurrentModel, installOpenClaw, openClawStatus, isInstalling } = useAppStore();
    const [apiKey, setApiKey] = useState('');
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);

    // Load saved API key on mount
    useEffect(() => {
        api.getLlmSetting('openai_api_key')
            .then(val => {
                if (val) {
                    setApiKey(val);
                    setCurrentModel('External (OpenAI)');
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const saveApiKey = async () => {
        try {
            await api.saveLlmSetting('openai_api_key', apiKey);
            setSaved(true);
            if (apiKey.trim()) {
                setCurrentModel('External (OpenAI)');
            } else {
                setCurrentModel('Local (Phi-3)');
            }
            setTimeout(() => setSaved(false), 2500);
        } catch (e) {
            console.error('Failed to save API key:', e);
        }
    };

    const handleModelSwitch = async (model: string) => {
        setCurrentModel(model);
        if (model === 'Local (Phi-3)') {
            // Clear the API key from DB so router falls back to local
            await api.saveLlmSetting('openai_api_key', '');
        }
    };

    return (
        <div className="p-6 bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/5 space-y-8">
            <h2 className="text-xl font-bold flex items-center gap-2">
                <Settings className="w-6 h-6 text-slate-400" />
                Settings & Configuration
            </h2>

            {/* General Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-800/50 rounded-xl border border-white/5">
                    <h3 className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                        <Power className="w-4 h-4" />
                        OpenClaw Status
                    </h3>
                    <div className="flex items-center justify-between">
                        <span className="text-slate-200">Core Engine</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${openClawStatus === 'installed' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {openClawStatus.toUpperCase()}
                        </span>
                    </div>
                    {openClawStatus !== 'installed' && (
                        <button
                            onClick={installOpenClaw}
                            disabled={isInstalling}
                            className="mt-3 w-full py-1.5 px-3 bg-primary hover:bg-primary/90 text-white text-xs rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isInstalling ? 'Installing...' : 'Install OpenClaw'}
                        </button>
                    )}
                </div>

                <div className="p-4 bg-slate-800/50 rounded-xl border border-white/5">
                    <h3 className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Sandbox Mode
                    </h3>
                    <div className="flex items-center justify-between">
                        <span className="text-slate-200">Safety Layer</span>
                        <button
                            onClick={toggleSandbox}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${sandboxMode ? 'bg-green-500' : 'bg-slate-700'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${sandboxMode ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                        When enabled, actions are simulated but not executed.
                    </p>
                </div>

                <div className="p-4 bg-slate-800/50 rounded-xl border border-white/5">
                    <h3 className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                        <Monitor className="w-4 h-4" />
                        System Info
                    </h3>
                    <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                            <span className="text-slate-400">Platform</span>
                            <span className="text-slate-200">{navigator.platform || 'Unknown'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">LLM Mode</span>
                            <span className={`font-semibold ${currentModel.includes('External') ? 'text-blue-400' : 'text-green-400'}`}>
                                {currentModel}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Database</span>
                            <span className="text-green-400">Connected</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Model Selection */}
            <div className="space-y-4">
                <h3 className="text-sm font-medium text-slate-400 flex items-center gap-2">
                    <HardDrive className="w-4 h-4" />
                    LLM Configuration
                </h3>
                <p className="text-xs text-slate-500">
                    The assistant uses a local LLM by default. Add an API key to switch to a cloud model for smarter responses.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                        onClick={() => handleModelSwitch('Local (Phi-3)')}
                        className={`p-4 rounded-xl border text-left transition-all ${currentModel === 'Local (Phi-3)' ? 'bg-primary/10 border-primary ring-1 ring-primary' : 'bg-slate-800/50 border-white/5 hover:border-white/10'}`}
                    >
                        <div className="font-semibold text-white mb-1">Local (Phi-3 via Ollama)</div>
                        <p className="text-xs text-slate-400">Runs offline. Private. No cost. Fallback built-in responses if Ollama isn't running.</p>
                    </button>

                    <button
                        onClick={() => handleModelSwitch('External (OpenAI)')}
                        className={`p-4 rounded-xl border text-left transition-all ${currentModel === 'External (OpenAI)' ? 'bg-primary/10 border-primary ring-1 ring-primary' : 'bg-slate-800/50 border-white/5 hover:border-white/10'}`}
                    >
                        <div className="font-semibold text-white mb-1">External (OpenAI)</div>
                        <p className="text-xs text-slate-400">Uses GPT-4o API. Requires key. Smarter responses for complex tasks.</p>
                    </button>
                </div>

                {currentModel === 'External (OpenAI)' && (
                    <div className="mt-4 p-4 bg-slate-800/30 rounded-xl border border-white/5 animate-in fade-in slide-in-from-top-2">
                        <label className="block text-xs font-medium text-slate-400 mb-1">OpenAI API Key</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Key className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                                <input
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="sk-..."
                                    className="w-full bg-slate-900 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                                />
                            </div>
                            <button
                                onClick={saveApiKey}
                                className={`px-4 py-2 text-white text-sm rounded-lg transition-all flex items-center gap-1.5 ${saved ? 'bg-green-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                            >
                                {saved ? <><Check size={14} /> Saved</> : 'Save'}
                            </button>
                        </div>
                        <p className="mt-2 text-[11px] text-slate-500">
                            Your key is stored locally in the SQLite database. It never leaves your machine except for OpenAI API calls.
                        </p>
                    </div>
                )}

                {/* Architecture Explanation */}
                <div className="mt-4 p-4 bg-slate-800/20 rounded-xl border border-white/5">
                    <h4 className="text-xs font-semibold text-slate-400 mb-2">How Model Switching Works</h4>
                    <pre className="text-[11px] text-slate-500 font-mono whitespace-pre-wrap">
                        {`if user_llm_key exists in DB:
    → use External API model (OpenAI GPT-4o)
else:
    → use Local Phi-3 model (Ollama)
    → if Ollama unavailable:
        → use built-in keyword responses`}
                    </pre>
                </div>
            </div>
        </div>
    );
};
