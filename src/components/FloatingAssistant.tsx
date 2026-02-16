import { motion } from 'framer-motion';
import { useAppStore } from '../store';
import { MessageSquare, Sparkles } from 'lucide-react';

export const FloatingAssistant = () => {
    const { isOpen, togglePanel, isThinking } = useAppStore();

    return (
        <motion.div
            className="fixed bottom-8 right-8 z-50 cursor-pointer group"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={togglePanel}
        >
            <div className={`relative w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-colors duration-300 ${isOpen ? 'bg-gradient-to-tr from-accent to-pink-500' : 'bg-gradient-to-br from-primary to-secondary'}`}>
                {isThinking ? (
                    <div className="absolute inset-0 rounded-full border-4 border-white/30 border-t-white animate-spin"></div>
                ) : null}

                <MessageSquare className="w-8 h-8 text-white relative z-10" />

                {/* Floating particles */}
                <div className="absolute -top-1 -right-1">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500"></span>
                    </span>
                </div>
            </div>

            {!isOpen && (
                <div className="absolute bottom-full right-0 mb-4 w-48 p-3 rounded-xl bg-slate-800 text-sm text-slate-200 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                    <div className="flex items-center gap-2 mb-1 text-sky-400 font-semibold">
                        <Sparkles size={14} />
                        <span>Ready to help!</span>
                    </div>
                    Need an agent? Just ask!
                </div>
            )}
        </motion.div>
    );
};
