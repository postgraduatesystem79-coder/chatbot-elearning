import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Send, X, Minimize2, Maximize2, Loader2, Bot, User, Sparkles, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/useAuth';

interface Source {
  content: string;
  metadata: any;
}

interface Message {
  role: 'user' | 'model';
  parts: { text: string }[];
  timestamp: Date;
  sources?: Source[];
}

export function Chatbot() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, isMinimized]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    const userMessage: Message = {
      role: 'user',
      parts: [{ text: userText }],
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Send to our server-side API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          history: messages.map(m => ({ role: m.role, text: m.parts[0].text })),
          userName: profile?.displayName || 'طالب',
          language: i18n.language,
        }),
      });

      const data = await response.json();

      const modelMessage: Message = {
        role: 'model',
        parts: [{ text: data.answer || (i18n.language === 'ar' ? 'عذراً، حدث خطأ ما.' : 'Sorry, something went wrong.') }],
        timestamp: new Date(),
        sources: data.sources || []
      };

      setMessages(prev => [...prev, modelMessage]);
    } catch (error) {
      console.error('Chatbot error:', error);
      const errorMessage: Message = {
        role: 'model',
        parts: [{ text: i18n.language === 'ar' ? 'عذراً، حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى.' : 'Sorry, connection error. Please try again.' }],
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    // Re-show welcome message
    addWelcomeMessage();
  };

  const addWelcomeMessage = () => {
    const welcomeMessage: Message = {
      role: 'model',
      parts: [{
        text: i18n.language === 'ar'
          ? `مرحباً ${profile?.displayName || ''}! أنا مساعدك الذكي في بيئة التعلم الإلكترونية وروبوتات الدردشة لتنمية مهارات ريادة الاعمال الرقمية. كيف يمكنني مساعدتك اليوم؟`
          : `Hello ${profile?.displayName || ''}! I am your smart assistant on the E-Learning Environment and Chatbots platform for developing digital entrepreneurship skills. How can I help you today?`
      }],
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  };

  const toggleChat = () => {
    const opening = !isOpen;
    setIsOpen(opening);
    if (opening && messages.length === 0) {
      addWelcomeMessage();
    }
  };

  const isRtl = i18n.language === 'ar';

  return (
    <div
      className={cn("fixed bottom-6 z-50", isRtl ? "left-6" : "right-6")}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={cn(
              "bg-card border shadow-2xl rounded-2xl overflow-hidden flex flex-col transition-all duration-300",
              isMinimized ? "h-16 w-72" : "h-[520px] w-[360px] md:w-[420px]"
            )}
          >
            {/* ===== Header ===== */}
            <div className="bg-primary p-4 flex items-center justify-between text-primary-foreground flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="bg-white/20 p-1.5 rounded-lg">
                  <Sparkles size={18} />
                </div>
                <div>
                  <span className="font-bold text-sm block">{isRtl ? 'المساعد الذكي' : 'Smart Assistant'}</span>
                  {!isMinimized && (
                    <span className="text-[10px] opacity-70 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block animate-pulse" />
                      {isRtl ? 'متصل الآن' : 'Online'}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {!isMinimized && messages.length > 1 && (
                  <button
                    onClick={clearChat}
                    className="p-1.5 hover:bg-white/10 rounded-md transition-colors"
                    title={isRtl ? 'مسح المحادثة' : 'Clear chat'}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1.5 hover:bg-white/10 rounded-md transition-colors"
                >
                  {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-white/10 rounded-md transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* ===== Messages ===== */}
                <div
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50 dark:bg-slate-900/50"
                >
                  {messages.map((msg, i) => {
                    const isUser = msg.role === 'user';
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className={cn(
                          "flex gap-2 max-w-[88%]",
                          isUser
                            ? (isRtl ? "mr-auto flex-row-reverse" : "ml-auto flex-row-reverse")
                            : "mr-0"
                        )}
                      >
                        {/* Avatar */}
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm",
                          isUser ? "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300" : "bg-primary text-primary-foreground"
                        )}>
                          {isUser ? <User size={14} /> : <Bot size={14} />}
                        </div>

                        {/* Bubble */}
                        <div className={cn(
                          "p-3 rounded-2xl text-sm leading-relaxed shadow-sm",
                          isUser
                            ? "bg-white dark:bg-slate-800 border rounded-tr-none"
                            : "bg-primary/10 text-foreground border border-primary/20 rounded-tl-none"
                        )}>
                          <p className="whitespace-pre-wrap">{msg.parts[0].text}</p>
                          
                          {/* Display sources if any */}
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="mt-3 pt-2 border-t border-primary/10 space-y-2">
                              <p className="text-[10px] text-slate-500 font-bold opacity-70">
                                {isRtl ? 'المصادر المسترجعة (RAG Context):' : 'Retrieved Sources (RAG Context):'}
                              </p>
                              <div className="grid gap-2">
                                {msg.sources.map((source, si) => (
                                  <div key={si} className="bg-white/50 dark:bg-slate-800/50 p-2 rounded-lg text-[10px] opacity-80 border border-primary/5">
                                    <p className="italic mb-1 truncate">"{source.content.substring(0, 80)}..."</p>
                                    <div className="flex items-center gap-1 text-primary font-bold not-italic">
                                      <span>{source.metadata?.fileName}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <div className="text-[10px] opacity-40 mt-1.5 text-end">
                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}

                  {/* Loading indicator */}
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-2"
                    >
                      <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 shadow-sm">
                        <Bot size={14} />
                      </div>
                      <div className="bg-primary/10 p-3 rounded-2xl rounded-tl-none border border-primary/20 flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* ===== Input ===== */}
                <div className="p-3 border-t bg-card flex-shrink-0">
                  <div className="flex gap-2 items-end">
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={isRtl ? 'اكتب سؤالك هنا...' : 'Type your question here...'}
                      disabled={isLoading}
                      className="flex-1 bg-muted border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 ring-primary/20 outline-none transition-all disabled:opacity-50 resize-none"
                    />
                    <motion.button
                      onClick={handleSend}
                      disabled={!input.trim() || isLoading}
                      whileHover={input.trim() && !isLoading ? { scale: 1.05 } : {}}
                      whileTap={input.trim() && !isLoading ? { scale: 0.95 } : {}}
                      className="bg-primary text-primary-foreground p-2.5 rounded-xl hover:bg-primary/90 transition-all disabled:opacity-40 shadow-md flex-shrink-0"
                    >
                      {isLoading
                        ? <Loader2 size={18} className="animate-spin" />
                        : <Send size={18} className={cn(isRtl && "rotate-180")} />
                      }
                    </motion.button>
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center mt-2 opacity-60">
                    {isRtl ? 'مساعد ذكي مدعوم بـ Gemini AI' : 'Powered by Gemini AI'}
                  </p>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== Toggle FAB Button ===== */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={toggleChat}
            className="w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center relative group"
          >
            <MessageSquare size={24} />
            {/* Notification dot */}
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />

            {/* Tooltip */}
            <div className={cn(
              "absolute bottom-full mb-3 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl",
              isRtl ? "left-0" : "right-0"
            )}>
              {isRtl ? 'تحدث مع المساعد الذكي' : 'Chat with Smart Assistant'}
              <div className={cn(
                "absolute top-full w-2 h-2 bg-slate-800 rotate-45 -translate-y-1",
                isRtl ? "left-4" : "right-4"
              )} />
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
