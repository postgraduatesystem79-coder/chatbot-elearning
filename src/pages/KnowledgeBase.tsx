import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  Trash2, 
  Search, 
  Bot, 
  User, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Database,
  MessageSquare,
  ExternalLink,
  ChevronRight,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface Document {
  id: string;
  filename: string;
  uploadDate: string;
  status: string;
  chunkCount: number;
}

interface Source {
  content: string;
  metadata: any;
}

interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
  sources?: Source[];
}

export default function KnowledgeBase() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [kbStatus, setKbStatus] = useState<{ docCount: number }>({ docCount: 0 });

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/knowledge-base/status');
        const data = await res.json();
        setKbStatus(data);
      } catch (err) {
        console.error('Failed to fetch KB status');
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);
  const [query, setQuery] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/knowledge-base/documents');
      const data = await res.json();
      setDocuments(data);
    } catch (err) {
      console.error('Error fetching documents:', err);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async (file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('يرجى رفع ملفات PDF فقط');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/knowledge-base/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      toast.success('تم رفع ومعالجة المستند بنجاح');
      fetchDocuments();
    } catch (err: any) {
      toast.error(`فشل الرفع: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/knowledge-base/documents/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('تم حذف المستند');
        fetchDocuments();
      }
    } catch (err) {
      toast.error('فشل حذف المستند');
    }
  };

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isQuerying) return;

    const userMsg: ChatMessage = { role: 'user', content: query };
    setChatHistory(prev => [...prev, userMsg]);
    setQuery('');
    setIsQuerying(true);

    try {
      const res = await fetch('/api/knowledge-base/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `خطأ في الخادم: ${res.status}`);
      }

      const data = await res.json();
      
      if (!data.answer) {
        throw new Error('لم يتم استلام إجابة من المساعد الذكي');
      }

      const botMsg: ChatMessage = { 
        role: 'bot', 
        content: data.answer || 'عذراً، لم أتمكن من العثور على إجابة.',
        sources: data.sources
      };
      setChatHistory(prev => [...prev, botMsg]);
    } catch (err: any) {
      console.error('Query Error:', err);
      toast.error(`فشل في الحصول على إجابة: ${err.message}`);
      // Add an error message to chat so user knows it failed
      setChatHistory(prev => [...prev, { 
        role: 'bot', 
        content: `عذراً، حدث خطأ أثناء محاولة الحصول على إجابة: ${err.message}` 
      }]);
    } finally {
      setIsQuerying(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">إدارة قاعدة المعرفة (RAG)</h2>
          <p className="text-slate-500 mt-1">رفع ملفات مهارات ريادة الأعمال الرقمية وتدريب المساعد الذكي</p>
        </div>
        <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-xl font-bold">
          <Database size={20} />
          <span>{documents.length} مستندات نشطة</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Upload & Documents */}
        <div className="lg:col-span-2 space-y-8">
          {/* Drag & Drop Upload */}
          <div 
            className={cn(
              "relative border-2 border-dashed rounded-3xl p-12 transition-all flex flex-col items-center justify-center text-center gap-4",
              dragActive ? "border-primary bg-primary/5 scale-[1.01]" : "border-slate-200 bg-white hover:border-primary/50",
              isUploading && "opacity-50 pointer-events-none"
            )}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              className="hidden" 
              accept=".pdf"
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
            />
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-2">
              {isUploading ? <Loader2 size={40} className="animate-spin" /> : <Upload size={40} />}
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">اسحب ملفات PDF هنا</h3>
              <p className="text-slate-500 mt-2">أو اضغط لاختيار ملف من جهازك</p>
            </div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 bg-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
            >
              اختيار ملف PDF
            </button>
            <p className="text-[11px] text-slate-400 mt-4 flex items-center gap-1">
              <Info size={12} />
              سيتم تقسيم الملف إلى أجزاء (Chunks) وتحويلها إلى متجهات (Vectors) تلقائياً
            </p>
          </div>

          {/* Documents Table */}
          <div className="bg-white border rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 border-b bg-slate-50/50 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <FileText size={20} className="text-primary" />
                المستندات المرفوعة
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-sm font-bold">
                    <th className="px-6 py-4">اسم الملف</th>
                    <th className="px-6 py-4">تاريخ الرفع</th>
                    <th className="px-6 py-4">الحالة</th>
                    <th className="px-6 py-4">الأجزاء</th>
                    <th className="px-6 py-4">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {documents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                        لا توجد مستندات مرفوعة حالياً
                      </td>
                    </tr>
                  ) : (
                    documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-700">{doc.filename}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {format(new Date(doc.uploadDate), 'PPP', { locale: ar })}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                            <CheckCircle2 size={12} />
                            {doc.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-slate-500">{doc.chunkCount}</td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => handleDelete(doc.id)}
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Test Bot UI */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-3xl overflow-hidden shadow-xl flex flex-col h-[700px]">
            <div className="p-6 bg-slate-800 border-b border-slate-700 flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                <Bot size={24} />
              </div>
              <div>
                <h3 className="font-bold text-white">اختبار المساعد الذكي</h3>
                <div className="flex items-center gap-2">
                  <p className="text-[11px] text-slate-400">تأكد من دقة الإجابات والمصادر</p>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[9px] font-bold",
                    kbStatus.docCount > 0 ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
                  )}>
                    {kbStatus.docCount > 0 ? `${kbStatus.docCount} مستندات جاهزة` : 'لا توجد مستندات'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {chatHistory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-4 opacity-30">
                  <MessageSquare size={64} className="text-slate-500" />
                  <p className="text-slate-400 font-bold">ابدأ بطرح سؤال لاختبار قاعدة المعرفة</p>
                </div>
              ) : (
                chatHistory.map((msg, i) => (
                  <div key={i} className={cn("flex flex-col gap-2", msg.role === 'user' ? "items-start" : "items-end")}>
                    <div className={cn(
                      "max-w-[90%] p-4 rounded-2xl text-sm leading-relaxed",
                      msg.role === 'user' ? "bg-slate-800 text-slate-200 rounded-tr-none" : "bg-primary text-white rounded-tl-none"
                    )}>
                      {msg.content}
                    </div>
                    
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="w-full mt-2 space-y-2">
                        <p className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                          <Search size={10} />
                          المصادر المسترجعة (Context):
                        </p>
                        <div className="grid gap-2">
                          {msg.sources.map((source, si) => (
                            <div key={si} className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl text-[10px] text-slate-400 italic">
                              "{source.content.substring(0, 150)}..."
                              <div className="mt-1 flex items-center gap-2 text-primary font-bold not-italic">
                                <span>{source.metadata.fileName}</span>
                                <ChevronRight size={10} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
              {isQuerying && (
                <div className="flex items-center gap-2 text-slate-500 text-xs animate-pulse">
                  <Loader2 size={14} className="animate-spin" />
                  <span>جاري البحث في قاعدة المعرفة...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleQuery} className="p-4 bg-slate-800 border-t border-slate-700">
              <div className="relative">
                <input 
                  type="text" 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="اسأل عن مهارات ريادة الأعمال..."
                  className="w-full bg-slate-900 border-none rounded-2xl px-6 py-4 text-sm text-white outline-none focus:ring-2 ring-primary/50 transition-all"
                />
                <button 
                  type="submit"
                  disabled={!query.trim() || isQuerying}
                  className="absolute left-2 top-2 bottom-2 bg-primary text-white px-4 rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
                >
                  {isQuerying ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
