import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  BookOpen,
  Image as ImageIcon, 
  Mic, 
  Cpu, 
  ExternalLink,
  Sparkles,
  Wand2
} from 'lucide-react';
import { motion } from 'motion/react';

const aiTools = [
  {
    category: "Learning & Research",
    categoryAr: "التعلم والبحث",
    icon: BookOpen,
    color: "bg-blue-500",
    tools: [
      { name: "NotebookLM", url: "https://notebooklm.google.com/", description: "Explore your sources, summarize lessons, and organize your study materials.", descriptionAr: "تلخيص الدروس وفهم المصادر وتنظيم المحتوى التعليمي." }
    ]
  },
  {
    category: "Image Generation",
    categoryAr: "توليد الصور",
    icon: ImageIcon,
    color: "bg-emerald-500",
    tools: [
      { name: "Gemini", url: "https://gemini.google.com/", description: "Create and edit images using text descriptions.", descriptionAr: "إنشاء الصور وتعديلها باستخدام الأوصاف النصية." }
    ]
  },
  {
    category: "Audio & Speech",
    categoryAr: "الصوت والكلام",
    icon: Mic,
    color: "bg-amber-500",
    tools: [
      { name: "ElevenLabs", url: "https://elevenlabs.io/", description: "Turn text into speech and create educational voiceovers.", descriptionAr: "تحويل النصوص إلى كلام وإنشاء التعليق الصوتي للمحتوى التعليمي." }
    ]
  }
];

export function Applications() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  return (
    <div className="space-y-12 pb-12">
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <motion.div
           initial={{ opacity: 0, scale: 0.8 }}
           animate={{ opacity: 1, scale: 1 }}
           className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-bold"
        >
          <Sparkles size={16} />
          <span>{isAr ? 'مستقبل التعليم' : 'Future of Education'}</span>
        </motion.div>
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
          {t('applications')}
        </h1>
        <p className="text-xl text-muted-foreground leading-relaxed">
          {isAr 
            ? 'اكتشف كيف يمكنك استخدام قوة الذكاء الاصطناعي لإنتاج محتوى تعليمي احترافي يشمل البحث وتلخيص الدروس والصور والصوت.'
            : 'Explore how you can use the power of AI to produce professional educational content including research, lesson summaries, images, and audio.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {aiTools.map((cat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-card border rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all"
          >
            <div className={`h-2 ${cat.color}`} />
            <div className="p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className={`p-4 rounded-2xl ${cat.color} text-white shadow-lg`}>
                  <cat.icon size={28} />
                </div>
                <h2 className="text-2xl font-bold">{isAr ? cat.categoryAr : cat.category}</h2>
              </div>

              <div className="space-y-6">
                {cat.tools.map((tool, tIdx) => (
                  <a key={tIdx} href={tool.url} target="_blank" rel="noopener noreferrer" className="group block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">{tool.name}</h3>
                      <ExternalLink size={14} className="text-muted-foreground group-hover:text-primary transition-all" />
                    </div>
                    <p className="text-sm text-muted-foreground leading-snug">
                      {isAr ? tool.descriptionAr : tool.description}
                    </p>
                  </a>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t">
                <a href={cat.tools[0].url} target="_blank" rel="noopener noreferrer" className="w-full py-4 bg-muted hover:bg-primary hover:text-primary-foreground rounded-2xl font-bold transition-all flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
                  <ExternalLink size={20} />
                  <span>{isAr ? 'فتح الموقع' : 'Open Website'}</span>
                </a>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Feature Section: The Robot Guide */}
      <motion.div 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="bg-gradient-to-br from-primary/5 to-secondary/5 rounded-[3rem] p-8 lg:p-16 border border-primary/10"
      >
        <div className="flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1 space-y-6">
            <div className="w-16 h-16 bg-white rounded-3xl shadow-xl flex items-center justify-center text-primary">
              <Wand2 size={32} />
            </div>
            <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">
              {isAr ? 'شخصية الروبوت التعليمي الذكي' : 'Smart Educational Robot Character'}
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {isAr 
                ? 'استمتع بتجربة تعلم فريدة من نوعها مع الروبوت التعليمي الذي يرافقك في كل خطوة. يقوم الروبوت بشرح مكملات الملابس وتقديم نصائح الوعي الصحي بطريقة تفاعلية وممتعة.'
                : 'Enjoy a unique learning experience with our educational robot guide. The robot explains clothing accessories and provides health awareness tips in an interactive and fun way.'}
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="bg-background/80 backdrop-blur-sm px-6 py-3 rounded-2xl border flex items-center gap-3 font-bold">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                {isAr ? 'تفاعل فوري' : 'Instant Interaction'}
              </div>
              <div className="bg-background/80 backdrop-blur-sm px-6 py-3 rounded-2xl border flex items-center gap-3 font-bold">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                {isAr ? 'دعم مستمر' : 'Continuous Support'}
              </div>
            </div>
          </div>
          <div className="w-full lg:w-[400px] aspect-square bg-gradient-to-br from-primary to-secondary rounded-full overflow-hidden shadow-2xl relative group">
             <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                <Cpu size={80} className="text-white animate-bounce" />
             </div>
             <img 
               src="https://images.unsplash.com/photo-1546776310-eef45dd6d63c?auto=format&fit=crop&q=80&w=800" 
               alt="AI Robot" 
               className="w-full h-full object-cover mix-blend-overlay group-hover:scale-110 transition-transform duration-700" 
             />
             <div className="absolute inset-0 flex flex-col justify-end p-8 text-white">
                <span className="text-xs font-black uppercase tracking-widest mb-1 opacity-70">AI Support</span>
                <p className="text-2xl font-bold">{isAr ? 'مساعدك الذكي دائماً معك' : 'Your Smart Assistant Always With You'}</p>
             </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
