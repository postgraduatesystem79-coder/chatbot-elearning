import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpen, 
  MessageSquare, 
  User, 
  Settings, 
  LogOut, 
  Bell,
  Menu,
  X,
  ShieldCheck,
  GraduationCap,
  Users,
  HelpCircle,
  Database
} from 'lucide-react';
import { useAuth } from '../lib/useAuth';
import { auth } from '../lib/firebase';
import { ThemeToggle } from './ThemeToggle';
import { LanguageToggle } from './LanguageToggle';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

import { Header } from './Header';
import { Chatbot } from './Chatbot';

export function Layout({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const { profile, isAdmin, isTeacher } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { name: t('chatbot'), path: '/chatbot', icon: MessageSquare },
    { name: t('instructions'), path: '/instructions', icon: HelpCircle },
    { name: t('courses'), path: '/courses', icon: BookOpen },
    { name: t('activities'), path: '/activities', icon: LayoutDashboard },
    { name: t('chat_room') || 'غرفة الدردشة', path: '/chat-room', icon: MessageSquare },
    { name: t('student_questions') || 'أسئلة واستفسارات الطلبة', path: '/student-questions', icon: MessageSquare },
    { name: 'قاعدة المعرفة (RAG)', path: '/knowledge-base', icon: Database },
    { name: t('profile'), path: '/profile', icon: User },
  ];

  if (isAdmin || isTeacher) {
    navItems.push({ name: t('teacher_dashboard') || 'لوحة تحكم المعلم', path: '/teacher', icon: LayoutDashboard });
    navItems.push({ name: t('manage_users'), path: '/users', icon: Users });
    navItems.push({ name: t('quiz_management'), path: '/quizzes', icon: HelpCircle });
  }

  if (isAdmin) {
    navItems.push({ name: t('admin'), path: '/admin', icon: ShieldCheck });
  }

  return (
    <div className="min-h-screen bg-background font-sans rtl" dir="rtl">
      {/* Sidebar - Desktop */}
      <aside className={cn(
        "fixed top-0 bottom-0 z-40 hidden w-64 border-e bg-card transition-all md:block start-0"
      )}>
        <div className="flex flex-col h-full">
          <div className="flex items-center h-16 px-6 border-b">
            <Link to="/" className="flex items-center gap-2 font-bold text-xl text-primary">
              <GraduationCap className="w-8 h-8" />
              <span>{t('app_name')}</span>
            </Link>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                  location.pathname === item.path 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon size={20} />
                <span className="font-medium">{item.name}</span>
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t space-y-2">
            <ThemeToggle />
            <LanguageToggle />
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
            >
              <LogOut size={20} />
              <span className="font-medium">{t('logout')}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="transition-all md:ps-64">
        <Header />
        
        {/* Mobile Menu Trigger (Floating on mobile) */}
        <div className="md:hidden fixed bottom-6 right-6 z-50">
          <button 
            className="w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu size={24} />
          </button>
        </div>

        {/* Page Content */}
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>

        {/* Chatbot */}
        {location.pathname !== '/chatbot' && <Chatbot />}
      </main>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm md:hidden"
            />
            <motion.div
              initial={{ x: i18n.language === 'ar' ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: i18n.language === 'ar' ? '100%' : '-100%' }}
              className={cn(
                "fixed top-0 bottom-0 z-50 w-72 bg-card border-s shadow-xl md:hidden start-0"
              )}
            >
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between h-16 px-6 border-b">
                  <span className="font-bold text-xl text-primary">{t('app_name')}</span>
                  <button onClick={() => setIsMobileMenuOpen(false)}>
                    <X size={24} />
                  </button>
                </div>
                <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
                  {navItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                        location.pathname === item.path 
                          ? "bg-primary text-primary-foreground" 
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <item.icon size={20} />
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  ))}
                </nav>
                <div className="p-4 border-t space-y-4">
                  <div className="flex justify-around">
                    <ThemeToggle />
                    <LanguageToggle />
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-3 py-2 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                  >
                    <LogOut size={20} />
                    <span className="font-medium">{t('logout')}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
