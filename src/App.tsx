import { useEffect, useState } from "react";
import { useAppStore } from './store';
import { api, type AgentRecord } from './lib/api';
import { FloatingAssistant } from './components/FloatingAssistant';
import { ChatPanel } from './components/ChatPanel';
import { Bot, Calendar, FileText, Settings, Shield, Trash2, Clock, Zap, PlayCircle, Filter, Globe } from 'lucide-react';
import { LinkedInPanel } from './components/LinkedInPanel';
import { SettingsPanel } from "./components/SettingsPanel";

function App() {
  const { checkStatus, appendToStream, commitStream, addMessage } = useAppStore();
  const [logs, setLogs] = useState<any[]>([]);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [logFilter, setLogFilter] = useState<string>('all');

  // Fetch agents whenever the schedule tab is shown
  const fetchAgents = () => {
    api.getAgents().then(setAgents).catch(console.error);
  };

  // G8: On first launch, detect OS and initialize
  useEffect(() => {
    checkStatus();

    const unlistenCli = api.onCliOutput((output) => {
      console.log('CLI:', output);
    });

    const unlistenLlm = api.onLlmToken((token) => {
      appendToStream(token);
    });

    return () => {
      unlistenCli.then(f => f());
      unlistenLlm.then(f => f());
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'sandbox') {
      api.getLogs().then(setLogs).catch(console.error);
      const interval = setInterval(() => {
        api.getLogs().then(setLogs).catch(console.error);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'schedule' || activeTab === 'dashboard') {
      fetchAgents();
      const interval = setInterval(fetchAgents, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const handleDeleteAgent = async (agentId: string) => {
    try {
      await api.deleteAgent(agentId);
      setAgents(agents.filter(a => a.id !== agentId));
    } catch (e) {
      console.error('Failed to delete agent:', e);
    }
  };

  const handleQuickStart = (text: string) => {
    addMessage({
      id: Date.now().toString(),
      role: 'user',
      content: `Create an agent: ${text}`,
      timestamp: Date.now()
    });
    useAppStore.setState({ isOpen: true, isThinking: true });

    api.generateAgentConfig(`Create an agent: ${text}`).then(config => {
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I've drafted an agent configuration for you based on the template. Please review it below.",
        timestamp: Date.now(),
        agentConfig: config,
        status: 'pending'
      });
      useAppStore.setState({ isThinking: false });
    }).catch(e => {
      const errorMsg = e instanceof Error ? e.message : String(e);
      addMessage({
        id: Date.now().toString(),
        role: 'system',
        content: `Error: ${errorMsg}`,
        timestamp: Date.now()
      });
      useAppStore.setState({ isThinking: false });
    });
  };

  const formatSchedule = (expr: string | null): string => {
    if (!expr) return 'No schedule';
    if (expr === '0 0 9 * * *') return 'Daily at 9:00 AM';
    if (expr === '0 * * * * *') return 'Every minute';
    if (expr === '0 */5 * * * *') return 'Every 5 minutes';
    if (expr === '0 0 * * * *') return 'Every hour';
    return expr;
  };

  const formatDate = (d: string): string => {
    if (!d) return '';
    try {
      const date = new Date(d);
      return date.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return d; }
  };

  return (
    <main className="container mx-auto h-screen flex overflow-hidden">
      {/* Sidebar Navigation */}
      <nav className="w-20 bg-slate-900/50 backdrop-blur-md border-r border-white/5 flex flex-col items-center py-8 gap-8 z-30">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
          <Bot className="text-white w-6 h-6" />
        </div>

        <div className="flex-1 flex flex-col gap-6 w-full px-2">
          <NavButton icon={<FileText size={20} />} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} tooltip="Overview" />
          <NavButton icon={<Globe size={20} />} active={activeTab === 'linkedin'} onClick={() => setActiveTab('linkedin')} tooltip="LinkedIn" />
          <NavButton icon={<Calendar size={20} />} active={activeTab === 'schedule'} onClick={() => setActiveTab('schedule')} tooltip="Schedule" badge={agents.length > 0 ? agents.length : undefined} />
          <NavButton icon={<Shield size={20} />} active={activeTab === 'sandbox'} onClick={() => setActiveTab('sandbox')} tooltip="Sandbox Logs" />
          <div className="flex-1" />
          <NavButton icon={<Settings size={20} />} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} tooltip="Settings" />
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-y-auto">

        {/* Header */}
        <header className="absolute top-0 left-0 w-full p-8 z-20 pointer-events-none">
          <div className="flex justify-between items-end pointer-events-auto">
            <div>
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                {activeTab === 'dashboard' && 'Dashboard'}
                {activeTab === 'linkedin' && 'LinkedIn Automation'}
                {activeTab === 'schedule' && 'Scheduled Agents'}
                {activeTab === 'sandbox' && 'Sandbox Activity'}
                {activeTab === 'settings' && 'Settings'}
              </h1>
              <p className="text-slate-400 mt-1">
                {activeTab === 'dashboard' && 'Your personal automation center.'}
                {activeTab === 'linkedin' && 'Scrape trends & post content.'}
                {activeTab === 'schedule' && `${agents.length} agent${agents.length !== 1 ? 's' : ''} deployed.`}
                {activeTab === 'sandbox' && 'Review simulated actions.'}
                {activeTab === 'settings' && 'Configure your assistant.'}
              </p>
            </div>
          </div>
        </header>

        <div className="pt-32 px-8 pb-12 cursor-default">
          {activeTab === 'settings' && <SettingsPanel />}
          {activeTab === 'linkedin' && <LinkedInPanel />}
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group cursor-pointer" onClick={() => setActiveTab('schedule')}>
                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Calendar className="text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Active Schedules</h3>
                <p className="text-slate-400 text-sm">
                  {agents.length > 0 ? `${agents.length} agent${agents.length !== 1 ? 's' : ''} running.` : 'No agents scheduled yet.'}
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group cursor-pointer" onClick={() => setActiveTab('sandbox')}>
                <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Shield className="text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Sandbox Mode</h3>
                <p className="text-slate-400 text-sm">Safe execution enabled.</p>
              </div>

              {/* Agent Templates */}
              <div className="col-span-1 lg:col-span-2 mt-8">
                <h2 className="text-xl font-bold text-white mb-4">Quick Start Agents</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <AgentCard
                    title="LinkedIn Trend Monitor"
                    desc="Finds trending topics and drafts posts."
                    tag="Social Media"
                    onClick={() => handleQuickStart("Monitor LinkedIn trends and draft a post daily")}
                  />
                  <AgentCard
                    title="Hashtag Engagement"
                    desc="Comments on posts with specific tags."
                    tag="Growth"
                    onClick={() => handleQuickStart("Comment on #openclaw posts every hour")}
                  />
                  <AgentCard
                    title="Daily Digest"
                    desc="Summarizes news from 5 sources."
                    tag="Research"
                    onClick={() => handleQuickStart("Summarize tech news daily at 8am")}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="space-y-4">
              {agents.length === 0 ? (
                <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/5 border-dashed">
                  <Calendar className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-300">No agents scheduled yet</h3>
                  <p className="text-slate-500 mt-2">Create an agent using the chat assistant or Quick Start templates.</p>
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className="mt-4 px-4 py-2 bg-primary hover:bg-primary/80 text-white text-sm rounded-lg transition-colors"
                  >
                    Go to Dashboard
                  </button>
                </div>
              ) : (
                agents.map((agent) => {
                  let parsedConfig: any = {};
                  try { parsedConfig = JSON.parse(agent.config); } catch { }

                  return (
                    <div key={agent.id} className="p-5 rounded-2xl bg-slate-900/80 border border-white/5 hover:border-primary/30 transition-all group">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0 group-hover:from-indigo-500/40 group-hover:to-purple-500/40 transition-colors">
                            <Bot className="text-indigo-300 w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-white">{agent.name}</h3>
                            <p className="text-sm text-slate-400 mb-3">{agent.role || 'Agent'}</p>

                            {/* Details grid */}
                            <div className="flex flex-wrap gap-3 text-xs">
                              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                                <Clock size={12} />
                                {formatSchedule(agent.schedule_expression)}
                              </span>
                              <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${agent.enabled
                                ? 'bg-green-500/10 text-green-300 border-green-500/20'
                                : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                }`}>
                                <PlayCircle size={12} />
                                {agent.enabled ? 'Active' : 'Paused'}
                              </span>
                              {parsedConfig.tools && (
                                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                  <Zap size={12} />
                                  {parsedConfig.tools.length} tools
                                </span>
                              )}
                            </div>

                            {/* Tasks */}
                            {parsedConfig.tasks && parsedConfig.tasks.length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs text-slate-500 mb-1">Tasks:</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {parsedConfig.tasks.map((task: string, i: number) => (
                                    <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-white/5 text-slate-300 border border-white/5">
                                      {task}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Event Triggers */}
                            {parsedConfig.event_triggers && parsedConfig.event_triggers.length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs text-slate-500 mb-1">Event Triggers:</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {parsedConfig.event_triggers.map((trigger: string, i: number) => (
                                    <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                                      <Zap size={10} />
                                      {trigger}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            <p className="text-xs text-slate-600 mt-3">
                              Created {formatDate(agent.created_at)}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteAgent(agent.id)}
                          className="p-2 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                          title="Delete agent"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'sandbox' && (
            <div className="space-y-4">
              {/* G5 + G7: Log filter tabs for scheduled run history and LLM routing */}
              <div className="flex gap-2 mb-4">
                {['all', 'scheduler', 'llm_router', 'browser_automation'].map(filter => (
                  <button
                    key={filter}
                    onClick={() => setLogFilter(filter)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${logFilter === filter
                      ? 'bg-primary text-white shadow-lg shadow-primary/20'
                      : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-white/5'
                      }`}
                  >
                    <Filter size={12} />
                    {filter === 'all' ? 'All Logs' : filter === 'llm_router' ? 'LLM Routing' : filter === 'scheduler' ? 'Run History' : 'Browser'}
                  </button>
                ))}
              </div>

              {logs.filter(l => logFilter === 'all' || l.module === logFilter).length === 0 ? (
                <div className="text-center py-10 text-slate-500">No logs found{logFilter !== 'all' ? ` for ${logFilter}` : ''}.</div>
              ) : (
                logs.filter(l => logFilter === 'all' || l.module === logFilter).map((log) => {
                  const borderColor = log.module === 'llm_router' ? 'border-l-blue-500' : log.module === 'scheduler' ? 'border-l-green-500' : 'border-l-amber-500';
                  const iconColor = log.module === 'llm_router' ? 'text-blue-500' : log.module === 'scheduler' ? 'text-green-500' : 'text-amber-500';
                  return (
                    <div key={log.id} className={`p-4 rounded-xl bg-slate-900 border border-l-4 ${borderColor} border-white/5 flex items-start gap-4`}>
                      <div className="mt-1"><Shield className={`w-5 h-5 ${iconColor}`} /></div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-mono mb-1" style={{ color: log.module === 'llm_router' ? '#60a5fa' : log.module === 'scheduler' ? '#4ade80' : '#fbbf24' }}>
                            {log.module.toUpperCase()} • {log.timestamp}
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${log.level === 'ERROR' ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-400'
                            }`}>{log.level}</span>
                        </div>
                        <p className="text-slate-300">{log.message}</p>
                        {log.metadata && log.metadata !== '{}' && (
                          <div className="mt-2 text-xs text-slate-500 bg-black/30 p-2 rounded font-mono">
                            {log.metadata}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

      </div>

      {/* Floating Elements */}
      <ChatPanel />
      <FloatingAssistant />

    </main>
  );
}

const NavButton = ({ icon, active, onClick, tooltip, badge }: { icon: any, active: boolean, onClick: () => void, tooltip: string, badge?: number }) => (
  <button
    onClick={onClick}
    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 relative group
            ${active ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'text-slate-400 hover:bg-white/5 hover:text-white'}
        `}
  >
    {icon}
    {badge !== undefined && badge > 0 && (
      <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow">
        {badge}
      </span>
    )}
    {/* Tooltip */}
    <span className="absolute left-14 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-white/10">
      {tooltip}
    </span>
  </button>
);

const AgentCard = ({ title, desc, tag, onClick }: { title: string, desc: string, tag: string, onClick: () => void }) => (
  <div onClick={onClick} className="p-5 rounded-xl bg-slate-800/50 border border-white/5 hover:border-primary/50 hover:bg-slate-800 transition-all cursor-pointer group">
    <div className="flex justify-between items-start mb-3">
      <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
        <Bot size={20} />
      </div>
      <span className="text-[10px] font-uppercase tracking-wider font-semibold bg-white/5 px-2 py-1 rounded text-slate-400">
        {tag}
      </span>
    </div>
    <h3 className="font-semibold text-white mb-1">{title}</h3>
    <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
  </div>
);

export default App;

