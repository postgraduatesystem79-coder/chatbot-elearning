import React from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '../lib/useAuth';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export function Header() {
  const { profile, isTeacher, isAdmin, setRole } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const roleTitle = isAdmin ? 'مدير النظام' : (isTeacher ? 'معلم المقرر' : 'طالب');

  return (
    <header className="bg-gradient-to-r from-primary to-secondary border-b border-white/10 px-6 py-4 sticky top-0 z-30 font-sans shadow-lg" dir="rtl">
      <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row items-center justify-between gap-6">
        
        {/* Right Section: University Name */}
        <div className="flex-shrink-0">
          <h2 className="text-white text-lg font-bold tracking-tight">جامعة المنيا</h2>
        </div>

        {/* Middle Section: Platform Titles */}
        <div className="flex-1 flex flex-col items-center text-center px-4">
          <h1 className="text-white text-lg lg:text-xl font-extrabold leading-relaxed drop-shadow-md">
            {t('platform_title')}
          </h1>
          <p className="text-white/80 text-sm mt-1 font-medium">
            {t('college_name')} • {t('university_name')}
          </p>
        </div>

        {/* Left Section: Faculty & User Profile */}
        <div className="flex flex-col items-center lg:items-end gap-2">
          <div className="flex items-center gap-3">
            <span className="text-white/90 text-sm font-semibold">
              {t('college_name')}
            </span>

            {/* Quick Role Switcher Pill */}
            <div className="flex items-center bg-black/25 p-1 rounded-xl text-xs font-bold border border-white/10">
              <button
                type="button"
                onClick={() => setRole('teacher')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  isTeacher ? "bg-white text-primary shadow-md font-black" : "text-white/70 hover:text-white"
                }`}
              >
                معلم
              </button>
              <button
                type="button"
                onClick={() => setRole('student')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  !isTeacher ? "bg-white text-primary shadow-md font-black" : "text-white/70 hover:text-white"
                }`}
              >
                طالب
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md p-1.5 px-4 rounded-xl border border-white/20 shadow-xl">
            {/* Notifications */}
            <div className="relative">
              <button className="p-2 text-white/80 hover:text-white transition-colors">
                <Bell size={20} strokeWidth={1.5} />
              </button>
              <span className="absolute top-2 right-2 w-2 h-2 bg-secondary rounded-full border border-primary"></span>
            </div>

            {/* Vertical Divider */}
            <div className="h-8 border-l border-white/20"></div>

            {/* User Info */}
            <div 
              className="flex items-center gap-3 cursor-pointer hover:bg-white/5 p-1 rounded-lg transition-all"
              onClick={() => navigate('/profile')}
              title={t('view_profile') || 'عرض الملف الشخصي'}
            >
              <div className="flex flex-col items-start">
                <span className="text-white font-bold text-sm leading-none">
                  {profile?.displayName || t('teacher_name')}
                </span>
                <span className="text-white/80 text-[10px] mt-1 font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded">
                  {roleTitle}
                </span>
              </div>

              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white font-bold shadow-inner">
                {profile?.displayName?.[0]?.toUpperCase() || 'A'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
