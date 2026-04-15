import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Info, ArrowRight, CheckCircle } from 'lucide-react';
import { motion } from 'motion/react';

export function GeneralInstructions() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const instructions = [
    "اقرأ أهداف الدرس بعناية قبل البدء.",
    "شاهد الفيديوهات واطلع على الملفات المرفقة (PDF, Word, PPT).",
    "شارك في الأنشطة التفاعلية المخصصة لكل درس.",
    "يجب اجتياز التقييم بنجاح للانتقال للدرس التالي.",
    "في حال الإجابة الخاطئة، سيتم توجيهك لمراجعة المحتوى مرة أخرى.",
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card p-8 rounded-3xl shadow-sm border"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-6">
            <Info size={48} />
          </div>
          <h1 className="text-3xl font-bold text-foreground">{t('instructions')}</h1>
          <p className="text-muted-foreground mt-3 text-center max-w-md">يرجى قراءة التعليمات التالية بعناية لضمان أفضل تجربة تعلم</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {instructions.map((text, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-start gap-4 p-6 bg-muted/30 rounded-2xl border border-transparent hover:border-primary/20 transition-all group"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <CheckCircle size={18} />
              </div>
              <p className="text-sm font-bold leading-relaxed">{text}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 flex justify-center">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-3 px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20"
          >
            <ArrowRight className="rtl:rotate-180" size={20} />
            <span>{t('main_menu')}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
