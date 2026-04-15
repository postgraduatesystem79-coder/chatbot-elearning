import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../lib/useAuth';
import { 
  Send, 
  User, 
  MoreVertical, 
  Phone, 
  Video, 
  Search, 
  Paperclip, 
  Smile,
  CheckCheck,
  X,
  PhoneOff,
  VideoOff,
  Image,
  FileText,
  Music,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

// ===================== Emoji Data =====================
const EMOJI_LIST = [
  '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃',
  '😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙',
  '🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏',
  '😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷',
  '🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯',
  '😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲',
  '😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱',
  '😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠',
  '🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻',
  '👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀',
  '👍','👎','👏','🙌','🤝','🤜','🤛','✊','👊','🤚',
  '✋','🖐️','👋','🤙','💪','🦵','🦶','🖖','☝️','👆',
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔',
  '❣️','💕','💞','💓','💗','💖','💘','💝','🔥','⭐',
];

// ===================== Types =====================
interface Message {
  id?: string;
  text: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  createdAt?: any;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
}

// ===================== Components =====================

/** Modal مكالمة صوتية / مرئية */
function CallModal({ type, onClose }: { type: 'phone' | 'video'; onClose: () => void }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const fmt = (n: number) => String(n).padStart(2, '0');
  const duration = `${fmt(Math.floor(seconds / 60))}:${fmt(seconds % 60)}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.85, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.85, y: 30 }}
        className="bg-[#202c33] rounded-3xl p-8 flex flex-col items-center gap-6 shadow-2xl min-w-[280px]"
      >
        {/* Avatar */}
        <div className="w-24 h-24 rounded-full bg-[#00a884]/20 border-4 border-[#00a884] flex items-center justify-center animate-pulse">
          <User size={40} className="text-[#00a884]" />
        </div>
        <div className="text-center">
          <p className="text-white font-bold text-lg">غرفة الدردشة الجماعية</p>
          <p className="text-[#aebac1] text-sm mt-1">
            {type === 'phone' ? '📞 مكالمة صوتية جارية...' : '📹 مكالمة مرئية جارية...'}
          </p>
          <p className="text-[#00a884] font-mono text-xl mt-2">{duration}</p>
        </div>
        {/* Controls */}
        <div className="flex items-center gap-6">
          <button
            onClick={onClose}
            className="w-14 h-14 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
            title="إنهاء المكالمة"
          >
            {type === 'phone' ? <PhoneOff size={24} className="text-white" /> : <VideoOff size={24} className="text-white" />}
          </button>
        </div>
        <p className="text-[#667781] text-xs">اضغط الزر الأحمر لإنهاء المكالمة</p>
      </motion.div>
    </motion.div>
  );
}

/** شريط البحث */
function SearchBar({ messages, onHighlight, onClose }: {
  messages: Message[];
  onHighlight: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!query.trim()) { onHighlight([]); return; }
    const matched = messages
      .filter(m => m.text?.toLowerCase().includes(query.toLowerCase()))
      .map(m => m.id!)
      .filter(Boolean);
    onHighlight(matched);
  }, [query, messages]);

  return (
    <motion.div
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -40, opacity: 0 }}
      className="bg-[#f0f2f5] px-4 py-2 flex items-center gap-3 border-b"
    >
      <Search size={18} className="text-slate-400 flex-shrink-0" />
      <input
        autoFocus
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="ابحث في الرسائل..."
        className="flex-1 bg-transparent outline-none text-sm text-slate-800 placeholder:text-slate-400"
      />
      {query && (
        <button onClick={() => { setQuery(''); onHighlight([]); }} className="text-slate-400 hover:text-slate-600">
          <X size={16} />
        </button>
      )}
      <button onClick={onClose} className="text-slate-400 hover:text-slate-600 ms-1">
        <X size={18} />
      </button>
    </motion.div>
  );
}

/** لوحة الإيموجي */
function EmojiPicker({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: 10 }}
      className="absolute bottom-full mb-2 left-0 bg-white rounded-2xl shadow-2xl border p-3 z-50 w-72"
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-sm font-bold text-slate-700">الإيموجي</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X size={16} />
        </button>
      </div>
      <div className="grid grid-cols-10 gap-0.5 max-h-48 overflow-y-auto custom-scrollbar">
        {EMOJI_LIST.map((em, i) => (
          <button
            key={i}
            onClick={() => { onSelect(em); onClose(); }}
            className="text-xl p-1 rounded hover:bg-slate-100 transition-colors leading-none"
          >
            {em}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

/** قائمة خيارات المرفقات */
function AttachMenu({ onClose }: { onClose: () => void }) {
  const items = [
    { icon: Image, label: 'صورة / فيديو', color: '#7f66ff', accept: 'image/*,video/*' },
    { icon: FileText, label: 'مستند', color: '#5f59f7', accept: '.pdf,.doc,.docx,.txt' },
    { icon: Music, label: 'صوت', color: '#00a884', accept: 'audio/*' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: 10 }}
      className="absolute bottom-full mb-2 left-10 bg-white rounded-2xl shadow-2xl border p-2 z-50 min-w-[160px]"
    >
      {items.map(({ icon: Icon, label, color, accept }) => (
        <label
          key={label}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
          onClick={onClose}
        >
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: color + '20' }}>
            <Icon size={18} style={{ color }} />
          </div>
          <span className="text-sm text-slate-700 font-medium">{label}</span>
          <input type="file" className="hidden" accept={accept} onChange={onClose} />
        </label>
      ))}
    </motion.div>
  );
}

/** قائمة المزيد (MoreVertical) */
function MoreMenu({ onClose }: { onClose: () => void }) {
  const items = ['مسح الرسائل (أنت فقط)', 'تعطيل الإشعارات', 'وصف المجموعة', 'إضافة مشارك'];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: -5 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -5 }}
      className="absolute top-full mt-1 end-0 bg-white rounded-xl shadow-2xl border z-50 py-1 min-w-[200px]"
    >
      {items.map(item => (
        <button
          key={item}
          onClick={onClose}
          className="block w-full text-start px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
        >
          {item}
        </button>
      ))}
    </motion.div>
  );
}

// ===================== Main Component =====================
export default function ChatRoom() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // UI State
  const [showSearch, setShowSearch] = useState(false);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [activCall, setActiveCall] = useState<'phone' | 'video' | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const inputAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const messagesRef = collection(db, 'chat_messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(100));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(data);
      setLoading(false);
      setTimeout(scrollToBottom, 100);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chat_messages');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Track scroll for "scroll to bottom" button
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const diff = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollBtn(diff > 150);
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inputAreaRef.current && !inputAreaRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
        setShowAttach(false);
      }
      setShowMore(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile) return;

    const text = newMessage.trim();
    setNewMessage('');
    setShowEmoji(false);

    try {
      await addDoc(collection(db, 'chat_messages'), {
        text,
        senderId: profile.uid,
        senderName: profile.displayName,
        senderRole: profile.role,
        createdAt: serverTimestamp()
      });
      scrollToBottom();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'chat_messages');
    }
  };

  if (!profile) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] bg-[#efeae2] rounded-2xl overflow-hidden border shadow-xl relative">
      
      {/* ===== Call Modal ===== */}
      <AnimatePresence>
        {activCall && (
          <CallModal type={activCall} onClose={() => setActiveCall(null)} />
        )}
      </AnimatePresence>

      {/* ===== WhatsApp Style Header ===== */}
      <div className="bg-[#f0f2f5] px-4 py-3 border-b flex items-center justify-between z-10 relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold border">
            <User size={24} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 leading-tight">غرفة الدردشة الجماعية</h3>
            <p className="text-[11px] text-slate-500 font-medium">الطلاب والمعلمون • متصل الآن</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-slate-500 relative">
          {/* Video Call */}
          <motion.button
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setActiveCall('video')}
            className="p-2 hover:bg-black/5 rounded-full transition-colors"
            title="مكالمة مرئية"
          >
            <Video size={20} />
          </motion.button>

          {/* Voice Call */}
          <motion.button
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setActiveCall('phone')}
            className="p-2 hover:bg-black/5 rounded-full transition-colors"
            title="مكالمة صوتية"
          >
            <Phone size={18} />
          </motion.button>

          <div className="w-[1px] h-6 bg-slate-300 mx-1" />

          {/* Search */}
          <motion.button
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => { setShowSearch(s => !s); setShowMore(false); }}
            className={cn(
              "p-2 rounded-full transition-colors",
              showSearch ? "bg-[#00a884]/15 text-[#00a884]" : "hover:bg-black/5"
            )}
            title="بحث في الرسائل"
          >
            <Search size={20} />
          </motion.button>

          {/* More Options */}
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowMore(m => !m)}
              className={cn(
                "p-2 rounded-full transition-colors",
                showMore ? "bg-[#00a884]/15 text-[#00a884]" : "hover:bg-black/5"
              )}
              title="المزيد من الخيارات"
            >
              <MoreVertical size={20} />
            </motion.button>
            <AnimatePresence>
              {showMore && <MoreMenu onClose={() => setShowMore(false)} />}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ===== Search Bar ===== */}
      <AnimatePresence>
        {showSearch && (
          <SearchBar
            messages={messages}
            onHighlight={setHighlightedIds}
            onClose={() => { setShowSearch(false); setHighlightedIds([]); }}
          />
        )}
      </AnimatePresence>

      {/* ===== Messages Area ===== */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 custom-scrollbar relative"
        style={{
          backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")',
          backgroundOpacity: 0.06
        }}
      >
        <div className="flex justify-center mb-4">
          <span className="bg-[#d1f4ff] text-[#54656f] text-[11px] font-bold px-3 py-1 rounded-lg uppercase tracking-wider shadow-sm">
            اليوم
          </span>
        </div>

        {loading && (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-[#00a884] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => {
            const isMe = msg.senderId === profile.uid;
            const time = msg.createdAt?.seconds 
              ? format(new Date(msg.createdAt.seconds * 1000), 'p', { locale: i18n.language === 'ar' ? ar : enUS })
              : format(new Date(), 'p');
            const isHighlighted = highlightedIds.includes(msg.id || '');

            return (
              <motion.div
                key={msg.id || i}
                layout
                initial={{ opacity: 0, scale: 0.8, x: isMe ? 20 : -20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                className={cn(
                  "flex flex-col max-w-[85%] md:max-w-[70%]",
                  isMe ? "ms-auto items-end" : "me-auto items-start"
                )}
              >
                <span className={cn(
                  "text-[11px] font-bold mb-1 px-2",
                  isMe ? "text-emerald-600" : "text-primary"
                )}>
                  {msg.senderName} 
                  <span className="text-[9px] bg-black/5 px-1 rounded ms-1 font-medium opacity-70">
                    {msg.senderRole === 'teacher' ? 'معلم' : 'طالب'}
                  </span>
                </span>
                <div className={cn(
                  "relative p-2 px-3 rounded-xl shadow-sm min-w-[80px] transition-all duration-300",
                  isMe 
                    ? "bg-[#d9fdd3] text-[#111b21] rounded-te-none" 
                    : "bg-white text-[#111b21] rounded-ts-none",
                  isHighlighted && "ring-2 ring-yellow-400 ring-offset-1 shadow-yellow-200 shadow-lg"
                )}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap pb-2">{msg.text}</p>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-[9px] text-[#667781]">{time}</span>
                    {isMe && <CheckCheck size={12} className="text-[#53bdeb]" />}
                  </div>
                  
                  {/* Message Tail */}
                  <div className={cn(
                    "absolute top-0 w-3 h-3",
                    isMe 
                      ? "-right-2 bg-[#d9fdd3] [clip-path:polygon(0_0,0_100%,100%_0)]" 
                      : "-left-2 bg-white [clip-path:polygon(100%_0,100%_100%,0_0)]"
                  )} />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ===== Scroll to Bottom Button ===== */}
      <AnimatePresence>
        {showScrollBtn && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToBottom}
            className="absolute bottom-20 end-4 z-20 w-10 h-10 bg-white border shadow-lg rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors"
            title="انتقل للأسفل"
          >
            <ChevronDown size={20} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ===== Input Area ===== */}
      <div ref={inputAreaRef} className="bg-[#f0f2f5] p-3 flex items-center gap-2 border-t relative">
        
        {/* Emoji Picker */}
        <AnimatePresence>
          {showEmoji && (
            <EmojiPicker
              onSelect={em => setNewMessage(m => m + em)}
              onClose={() => setShowEmoji(false)}
            />
          )}
        </AnimatePresence>

        {/* Attach Menu */}
        <AnimatePresence>
          {showAttach && (
            <AttachMenu onClose={() => setShowAttach(false)} />
          )}
        </AnimatePresence>

        {/* Emoji Button */}
        <motion.button
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => { setShowEmoji(e => !e); setShowAttach(false); }}
          className={cn(
            "p-2 rounded-full transition-colors flex-shrink-0",
            showEmoji ? "text-[#00a884] bg-[#00a884]/10" : "text-slate-500 hover:text-slate-700 hover:bg-black/5"
          )}
          title="إيموجي"
        >
          <Smile size={24} />
        </motion.button>

        {/* Attach Button */}
        <motion.button
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => { setShowAttach(a => !a); setShowEmoji(false); }}
          className={cn(
            "p-2 rounded-full transition-colors flex-shrink-0",
            showAttach ? "text-[#00a884] bg-[#00a884]/10" : "text-slate-500 hover:text-slate-700 hover:bg-black/5"
          )}
          title="إرفاق ملف"
        >
          <Paperclip size={22} />
        </motion.button>

        {/* Message Input + Send */}
        <form onSubmit={handleSendMessage} className="flex-1 flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onFocus={() => { setShowEmoji(false); setShowAttach(false); }}
            placeholder="اكتب رسالتك هنا..."
            className="flex-1 bg-white border-none rounded-xl px-4 py-2.5 text-sm text-slate-900 outline-none focus:ring-0 shadow-sm"
          />
          <motion.button 
            type="submit"
            disabled={!newMessage.trim()}
            whileHover={newMessage.trim() ? { scale: 1.08 } : {}}
            whileTap={newMessage.trim() ? { scale: 0.92 } : {}}
            className={cn(
              "w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-md flex-shrink-0",
              newMessage.trim() ? "bg-[#00a884] text-white hover:bg-[#008f6f]" : "bg-slate-300 text-slate-500"
            )}
          >
            <Send size={20} className={cn(i18n.language === 'ar' && "rotate-180")} />
          </motion.button>
        </form>
      </div>
    </div>
  );
}
