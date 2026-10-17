import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { 
  Sparkles, 
  Info, 
  BookOpen, 
  MousePointer2, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck,
  Zap,
  Layout
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Chatbot } from '../components/Chatbot';

export function HomePage() {
  const { t } = useTranslation();

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-12 pb-20 overflow-hidden">
      {/* Hero Section */}
      {/* Banner / Hero Section */}
      <section className="relative isolate rounded-3xl pt-12 pb-24 px-6">
        {/* Modern Curved Background */}
        <div className="absolute inset-0 overflow-hidden rounded-3xl -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-orange-50 dark:from-[#064e40] dark:via-[#086b58] dark:to-[#04332a]" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 blur-[120px] rounded-full -mr-48 -mt-48 animate-pulse" />
        </div>

        <div className="max-w-6xl mx-auto text-center relative">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 text-emerald-900 border border-emerald-200 dark:bg-white/10 dark:text-orange-200 dark:border-white/20 font-bold text-xs mb-8 uppercase tracking-widest shadow-sm"
          >
            <Sparkles size={14} className="animate-pulse" />
            <span>بيئة تعليمية ذكية متطورة</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-7xl font-black text-emerald-950 dark:text-white mb-8 leading-[1.1] tracking-tight"
          >
            بيئة التعلم الإلكترونية <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-700 to-amber-700 dark:from-orange-400 dark:to-amber-200">وتطبيقات الذكاء الاصطناعي</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg md:text-xl text-slate-700 dark:text-white/80 font-medium max-w-3xl mx-auto leading-relaxed mb-12"
          >
            {t('home_welcome_subtitle') || 'بيئة رقمية متطورة تهدف لتنمية الوعي الصحي لاختيار مكملات الملابس باستخدام تطبيقات الذكاء الاصطناعي.'}
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-6"
          >
            <Link 
              to="/courses" 
              className="group relative px-12 py-5 bg-orange-700 hover:bg-orange-800 dark:bg-[#fc721e] dark:hover:bg-[#e65a10] text-white rounded-2xl font-black flex items-center gap-3 transition-all transform hover:scale-105 shadow-lg shadow-orange-700/20"
            >
              <div className="absolute inset-0 bg-white/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="text-lg">ابدئي التعلم الآن</span>
              <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform rotate-180" />
            </Link>
            
            <Link 
              to="/instructions" 
              className="px-12 py-5 bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-300 dark:bg-white/5 dark:hover:bg-white/10 dark:text-white dark:border-white/30 backdrop-blur-xl rounded-2xl font-bold transition-all flex items-center gap-2"
            >
              <Layout size={20} />
              <span>تعليمات الاستخدام</span>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* About & Instructions Grid */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid md:grid-cols-2 gap-8"
      >
        {/* About the Environment */}
        <motion.div variants={item} className="bg-card border rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
          
          <div className="relative z-10">
            <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
              <Info size={32} />
            </div>
            
            <h2 className="text-2xl font-black mb-4">{t('about_env')}</h2>
            <p className="text-muted-foreground font-medium leading-relaxed mb-6">
              {t('about_env_desc')}
            </p>
            
            <div className="space-y-3">
              {[
                "تطبيق معايير الوعي الصحي الفعالة",
                "دعم ذكي متواصل عبر الروبوت التعليمي",
                "محتوى أكاديمي تحت إشراف نخبة من المتخصصين"
              ].map((point, i) => (
                <div key={i} className="flex items-center gap-3 text-sm font-bold">
                  <div className="w-5 h-5 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center">
                    <CheckCircle2 size={12} />
                  </div>
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Usage Instructions */}
        <motion.div variants={item} className="bg-card border rounded-[2.5rem] p-8 shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />

          <div className="relative z-10">
            <div className="w-14 h-14 bg-secondary/10 text-secondary rounded-2xl flex items-center justify-center mb-6">
              <MousePointer2 size={32} />
            </div>

            <h2 className="text-2xl font-black mb-4">{t('usage_instructions')}</h2>
            
            <div className="space-y-4">
              {[t('inst_1'), t('inst_2'), t('inst_3'), t('inst_4')].map((inst, i) => (
                <div key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="w-8 h-8 bg-background border rounded-lg flex items-center justify-center text-xs font-black text-secondary shrink-0">
                    {i + 1}
                  </div>
                  <p className="text-sm font-bold leading-relaxed">{inst}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-card border rounded-3xl flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center shrink-0">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h4 className="font-black text-sm">بيئة آمنة</h4>
            <p className="text-[10px] text-muted-foreground font-bold">حماية تامة للبيانات والخصوصية</p>
          </div>
        </div>
        <div className="p-6 bg-card border rounded-3xl flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center shrink-0">
            <Zap size={24} />
          </div>
          <div>
            <h4 className="font-black text-sm">سرعة الاستجابة</h4>
            <p className="text-[10px] text-muted-foreground font-bold">دعم ذكي لحظي عبر المساعد التعليمي</p>
          </div>
        </div>
        <div className="p-6 bg-card border rounded-3xl flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center shrink-0">
            <BookOpen size={24} />
          </div>
          <div>
            <h4 className="font-black text-sm">محتوى متجدد</h4>
            <p className="text-[10px] text-muted-foreground font-bold">تحديثات مستمرة لنتائج البحث</p>
          </div>
        </div>
      </div>

      {/* Active Robot on Home Page */}
      <Chatbot />
    </div>
  );
}
