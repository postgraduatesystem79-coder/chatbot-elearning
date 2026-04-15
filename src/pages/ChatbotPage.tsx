import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Sparkles, Bot, User, MessageSquare } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/useAuth';

interface Message {
  role: 'user' | 'model';
  parts: { text: string }[];
  timestamp: Date;
}

export function ChatbotPage() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (messages.length === 0) {
      const userName = profile?.displayName || profile?.name || '';
      const arWelcome = userName 
        ? `مرحباً دكتورة/أستاذة ${userName}! أنا مساعدك الذكي في بيئة التعلم الإلكترونية لتنمية مهارات ريادة الأعمال الرقمية بكلية التربية النوعية. كيف يمكنني مساعدتك اليوم؟`
        : `مرحباً بك! أنا مساعدك الذكي في بيئة التعلم الإلكترونية لتنمية مهارات ريادة الأعمال الرقمية بكلية التربية النوعية. كيف يمكنني مساعدتك اليوم؟`;
      
      const enWelcome = userName
        ? `Hello ${userName}! I am your smart assistant in the E-Learning environment at the Faculty of Specific Education. How can I help you today?`
        : `Hello! I am your smart assistant in the E-Learning environment at the Faculty of Specific Education. How can I help you today?`;

      const welcomeMessage: Message = {
        role: 'model',
        parts: [{ text: i18n.language === 'ar' ? arWelcome : enWelcome }],
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, [i18n.language, profile]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      parts: [{ text: input }],
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          history: messages
            .filter((_, idx) => idx !== 0) // skip welcome
            .map(m => ({ role: m.role, text: m.parts[0].text })),
          userName: profile?.displayName || profile?.name || 'طالب',
          language: i18n.language,
        }),
      });

      const data = await response.json();
      setMessages(prev => [...prev, {
        role: 'model',
        parts: [{ text: data.answer || 'عذراً، لم أتمكن من الإجابة.' }],
        timestamp: new Date(),
      }]);
    } catch (error: any) {
      setMessages(prev => [...prev, {
        role: 'model',
        parts: [{ text: i18n.language === 'ar' ? `عذراً، حدث خطأ: ${error.message}` : `Error: ${error.message}` }],
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] bg-card border rounded-2xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="bg-primary p-6 flex items-center justify-between text-primary-foreground">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl">
            <Sparkles size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold">{t('chatbot')}</h2>
            <p className="text-xs opacity-80">{i18n.language === 'ar' ? 'مساعدك الشخصي للتعلم الرقمي' : 'Your personal digital learning assistant'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white/10 px-3 py-1 rounded-full text-xs">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span>{i18n.language === 'ar' ? 'متصل' : 'Online'}</span>
          </div>
        </div>
      </div>

      {/* Messages List */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-muted/30"
      >
        {messages.map((msg, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex gap-4 max-w-[80%]",
              msg.role === 'user' ? (i18n.language === 'ar' ? "mr-auto flex-row-reverse" : "ml-auto flex-row-reverse") : "mr-0"
            )}
          >
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-1 shadow-md",
              msg.role === 'user' ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"
            )}>
              {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
            </div>
            <div className={cn(
              "p-4 rounded-2xl text-base leading-relaxed shadow-sm border",
              msg.role === 'user' 
                ? "bg-card border-border rounded-tr-none" 
                : "bg-primary/5 text-foreground border-primary/10 rounded-tl-none"
            )}>
              <div className="whitespace-pre-wrap">{msg.parts[0].text}</div>
              <div className="text-[10px] opacity-40 mt-2 text-end font-mono">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </motion.div>
        ))}
        {isLoading && (
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 shadow-md">
              <Bot size={20} />
            </div>
            <div className="bg-primary/5 p-4 rounded-2xl rounded-tl-none border border-primary/10">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-6 border-t bg-card">
        <div className="flex gap-3 max-w-4xl mx-auto">
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={i18n.language === 'ar' ? 'اكتب سؤالك هنا...' : 'Type your question here...'}
              className="w-full bg-muted border-none rounded-2xl px-6 py-4 text-base focus:ring-2 ring-primary/20 outline-none transition-all pr-12"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground opacity-20">
              <MessageSquare size={20} />
            </div>
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-primary text-primary-foreground px-8 rounded-2xl hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
          >
            <span className="hidden md:inline font-bold">{i18n.language === 'ar' ? 'إرسال' : 'Send'}</span>
            <Send size={20} className={cn(i18n.language === 'ar' && "rotate-180")} />
          </button>
        </div>
      </div>
    </div>
  );
}