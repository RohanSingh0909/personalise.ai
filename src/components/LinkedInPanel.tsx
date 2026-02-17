import React, { useState, useEffect } from 'react';
import { api, type TrendItem, type AgentRunResult } from '../lib/api';
import {
    Globe, TrendingUp, Send, RefreshCw, Check,
    Hash, User, Loader2, Sparkles, ArrowRight, ExternalLink,
    Play, Zap, Eye
} from 'lucide-react';

type SubTab = 'agent' | 'trends' | 'post';

export const LinkedInPanel = () => {
    const [subTab, setSubTab] = useState<SubTab>('agent');
    const [trends, setTrends] = useState<TrendItem[]>([]);
    const [postContent, setPostContent] = useState('');
    const [agentResult, setAgentResult] = useState<AgentRunResult | null>(null);
    const [isRunningAgent, setIsRunningAgent] = useState(false);
    const [isScraping, setIsScraping] = useState(false);
    const [isPosting, setIsPosting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [postResult, setPostResult] = useState<string | null>(null);
    const [postError, setPostError] = useState<string | null>(null);

    // Load saved trends on mount
    useEffect(() => {
        api.getSavedTrends().then(setTrends).catch(console.error);
    }, []);

    const handleRunAgent = async () => {
        setIsRunningAgent(true);
        setError(null);
        setAgentResult(null);
        try {
            const result = await api.runLinkedInAgent();
            setAgentResult(result);
            if (result.trends.length > 0) {
                setTrends(result.trends);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setIsRunningAgent(false);
        }
    };

    const handleScrape = async () => {
        setIsScraping(true);
        setError(null);
        try {
            const result = await api.scrapeLinkedInTrends();
            setTrends(result);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setIsScraping(false);
        }
    };

    const handlePost = async () => {
        if (!postContent.trim()) return;
        setIsPosting(true);
        setPostError(null);
        setPostResult(null);
        try {
            const result = await api.postToLinkedIn(postContent);
            setPostResult(result);
            setPostContent('');
        } catch (e) {
            setPostError(e instanceof Error ? e.message : String(e));
        } finally {
            setIsPosting(false);
        }
    };

    const useTrendForPost = (trend: TrendItem) => {
        setPostContent(
            `🔥 Trending: ${trend.title}\n\nMy thoughts on this:\n\n#TrendingNow #Insights #LinkedIn`
        );
        setSubTab('post');
    };

    const isAnyRunning = isRunningAgent || isScraping || isPosting;

    return (
        <div className="space-y-6">

            {/* ─── HERO: RUN AGENT BUTTON ─────────────────────── */}
            <div className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br from-blue-600/20 via-purple-600/10 to-cyan-600/20 border border-blue-500/20">
                <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl" />
                <div className="relative z-10 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500">
                                <Zap size={20} className="text-white" />
                            </div>
                            LinkedIn Agent
                        </h3>
                        <p className="text-sm text-slate-400 mt-2 max-w-md">
                            One click: Scrapes <strong className="text-blue-300">Google Trends</strong>, navigates to <strong className="text-cyan-300">LinkedIn</strong>,
                            and auto-posts. If not logged in, it waits for you.
                        </p>
                    </div>

                    <button
                        onClick={handleRunAgent}
                        disabled={isAnyRunning}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                        {isRunningAgent ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Agent Running...
                            </>
                        ) : (
                            <>
                                <Play size={18} />
                                Run Agent
                            </>
                        )}
                    </button>
                </div>

                {isRunningAgent && (
                    <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <div className="flex items-center gap-2 text-sm text-blue-300">
                            <Eye size={14} />
                            <span>A Chromium window is open. The agent is working... if LinkedIn needs login, log in in the browser.</span>
                        </div>
                    </div>
                )}

                {agentResult && (
                    <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                        <div className="flex items-center gap-2 text-sm text-green-300">
                            <Check size={14} />
                            <span>{agentResult.message || `Done! Scraped ${agentResult.trends.length} trends.`}</span>
                        </div>
                        {agentResult.postContent && (
                            <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                                📝 Posted: {agentResult.postContent.substring(0, 120)}...
                            </p>
                        )}
                    </div>
                )}

                {error && subTab === 'agent' && (
                    <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                        {error}
                    </div>
                )}
            </div>

            {/* ─── SUB-TAB NAVIGATION ────────────────────────── */}
            <div className="flex gap-2 bg-slate-900/50 p-1.5 rounded-xl border border-white/5">
                {([
                    { key: 'agent', label: 'Agent Log', icon: <Zap size={14} /> },
                    { key: 'trends', label: 'Trending Topics', icon: <TrendingUp size={14} /> },
                    { key: 'post', label: 'Manual Post', icon: <Send size={14} /> },
                ] as { key: SubTab; label: string; icon: React.ReactNode }[]).map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setSubTab(tab.key)}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                            ${subTab === tab.key
                                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/20'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ─── AGENT LOG TAB ─────────────────────────────── */}
            {subTab === 'agent' && (
                <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-slate-800/30 border border-white/5">
                        <h4 className="text-sm font-semibold text-white mb-3">How It Works</h4>
                        <div className="text-xs text-slate-400 space-y-2">
                            <div className="flex items-start gap-3">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] font-bold">1</span>
                                <p><strong className="text-blue-300">Opens Chromium</strong> — A visible browser window launches (your session is remembered).</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-[10px] font-bold">2</span>
                                <p><strong className="text-purple-300">Scrapes Google Trends</strong> — Fetches the hottest topics right now. No login needed.</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-bold">3</span>
                                <p><strong className="text-cyan-300">Navigates to LinkedIn</strong> — If you're already logged in, it auto-posts. If not, it waits for you to log in in the browser.</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-[10px] font-bold">4</span>
                                <p><strong className="text-green-300">Posts automatically</strong> — Creates a post from the scraped trends and publishes it.</p>
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-600 mt-3">💡 No credentials stored. Session cookies are kept in a local browser profile.</p>
                    </div>

                    {agentResult && agentResult.trends.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-white">Last Run — Trends Found</h4>
                            {agentResult.trends.slice(0, 5).map((t, i) => (
                                <div key={i} className="p-3 rounded-lg bg-slate-900/50 border border-white/5 text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                                            {t.source || 'Google'}
                                        </span>
                                        <span className="text-slate-300">{t.title}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ─── TRENDING TOPICS TAB ──────────────────────── */}
            {subTab === 'trends' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Sparkles className="text-cyan-400" size={20} />
                                Scraped Trends
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                {trends.length > 0
                                    ? `${trends.length} topics from Google`
                                    : 'Click "Scrape Google" or "Run Agent" to fetch trends'}
                            </p>
                        </div>
                        <button
                            onClick={handleScrape}
                            disabled={isAnyRunning}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isScraping ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" />
                                    Scraping...
                                </>
                            ) : (
                                <>
                                    <RefreshCw size={14} />
                                    Scrape Google
                                </>
                            )}
                        </button>
                    </div>

                    {error && subTab === 'trends' && (
                        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                            <p className="font-medium">Scraping failed</p>
                            <p className="text-xs text-red-400/70 mt-1">{error}</p>
                        </div>
                    )}

                    {isScraping && (
                        <div className="flex flex-col items-center justify-center py-16 space-y-4">
                            <div className="relative">
                                <div className="w-16 h-16 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                                <Globe className="absolute inset-0 m-auto text-blue-400" size={24} />
                            </div>
                            <div className="text-center">
                                <p className="text-white font-medium">Scraping Google Trends...</p>
                                <p className="text-xs text-slate-500 mt-1">A Chromium window is open. This takes 15–30 seconds.</p>
                            </div>
                        </div>
                    )}

                    {!isScraping && trends.length === 0 && !error && (
                        <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/5 border-dashed">
                            <TrendingUp className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                            <h4 className="text-slate-300 font-medium">No trends yet</h4>
                            <p className="text-slate-500 text-sm mt-1">
                                Click "Run Agent" above or "Scrape Google" to fetch trends.
                            </p>
                        </div>
                    )}

                    {!isScraping && trends.length > 0 && (
                        <div className="space-y-3">
                            {trends.map((trend, idx) => (
                                <div
                                    key={idx}
                                    className="group p-4 rounded-xl bg-slate-900/80 border border-white/5 hover:border-cyan-500/30 transition-all hover:bg-slate-900"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full border ${trend.item_type === 'news'
                                                        ? 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                                                        : trend.item_type === 'search'
                                                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                                                            : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'
                                                    }`}>
                                                    {trend.item_type || 'trending'}
                                                </span>
                                                {trend.source && (
                                                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                                        <ExternalLink size={8} />
                                                        {trend.source}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-200 leading-relaxed">{trend.title}</p>
                                            {trend.author && (
                                                <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                                                    <User size={10} />
                                                    {trend.author}
                                                </div>
                                            )}
                                            {trend.hashtags && trend.hashtags.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                    {trend.hashtags.map((tag, i) => (
                                                        <span
                                                            key={i}
                                                            className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20"
                                                        >
                                                            <Hash size={8} />
                                                            {tag.replace('#', '')}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => useTrendForPost(trend)}
                                            className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20"
                                            title="Use as post template"
                                        >
                                            <ArrowRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ─── MANUAL POST TAB ────────────────────────────── */}
            {subTab === 'post' && (
                <div className="space-y-5">
                    <div>
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Send className="text-cyan-400" size={20} />
                            Post to LinkedIn
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                            Write your post. Chromium will open — if not logged in, you'll have 5 min to log in.
                        </p>
                    </div>

                    <div className="relative">
                        <textarea
                            value={postContent}
                            onChange={(e) => setPostContent(e.target.value)}
                            placeholder={"What do you want to share? ✍️\n\nPro tip: Click the → on any trend to use it as a template!"}
                            rows={8}
                            className="w-full bg-slate-900/80 border border-white/10 rounded-xl p-4 text-sm text-white placeholder:text-slate-500 resize-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/30 outline-none transition-all"
                        />
                        <div className="absolute bottom-3 right-3 text-xs text-slate-600">
                            {postContent.length} / 3000
                        </div>
                    </div>

                    {postResult && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-300 text-sm">
                            <Check size={16} />
                            {postResult}
                        </div>
                    )}

                    {postError && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                            <p className="font-medium">Posting failed</p>
                            <p className="text-xs text-red-400/70 mt-1">{postError}</p>
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handlePost}
                            disabled={isPosting || !postContent.trim()}
                            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isPosting ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Posting...
                                </>
                            ) : (
                                <>
                                    <Send size={16} />
                                    Post to LinkedIn
                                </>
                            )}
                        </button>
                    </div>

                    {/* Quick templates */}
                    <div className="pt-4 border-t border-white/5">
                        <p className="text-xs font-medium text-slate-400 mb-3">Quick Templates</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {[
                                { label: '🔥 Hot Take', text: "🔥 Hot Take:\n\n[Your opinion here]\n\nAgree or disagree? Let me know 👇\n\n#Thoughts #Discussion" },
                                { label: '💡 Tip of the Day', text: "💡 Tip of the Day:\n\n[Your tip here]\n\nSave this for later! 🔖\n\n#Productivity #Tips #CareerGrowth" },
                                { label: '📊 Industry Insight', text: "📊 Industry Insight:\n\n[Your analysis here]\n\nWhat are your thoughts on this trend?\n\n#Industry #Trends #Analysis" },
                                { label: '🚀 Announcement', text: "🚀 Exciting news!\n\n[Your announcement here]\n\nStay tuned for more updates!\n\n#Announcement #Growth" },
                            ].map((tpl, i) => (
                                <button
                                    key={i}
                                    onClick={() => setPostContent(tpl.text)}
                                    className="px-3 py-2 text-xs text-left bg-slate-800/50 rounded-lg border border-white/5 hover:border-cyan-500/30 hover:bg-slate-800 transition-all text-slate-300"
                                >
                                    {tpl.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
