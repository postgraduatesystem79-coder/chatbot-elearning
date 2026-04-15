import React, { useState } from 'react';
import { useAuth } from '../lib/useAuth';
import { useTranslation } from 'react-i18next';
import { User, Mail, Shield, Calendar, Award, Clock, BookOpen, BarChart3, Edit2, Check, X } from 'lucide-react';
import { motion } from 'motion/react';
import { LearningAnalytics } from '../components/LearningAnalytics';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';

export function Profile() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(profile?.displayName || '');

  if (!profile) return null;

  const handleSaveName = async () => {
    if (!newName.trim()) {
      toast.error(t('name_required') || 'الاسم مطلوب');
      return;
    }

    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        displayName: newName,
        name: newName // Update both fields for consistency
      });
      setIsEditing(false);
      toast.success(t('profile_updated') || 'تم تحديث الملف الشخصي بنجاح');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(t('update_failed') || 'فشل تحديث الملف الشخصي');
    }
  };

  const stats = [
    { label: t('hours_spent'), value: profile.stats?.hoursSpent || 0, icon: Clock, color: 'text-blue-500' },
    { label: t('courses_completed'), value: profile.stats?.coursesCompleted || 0, icon: BookOpen, color: 'text-green-500' },
    { label: t('total_points'), value: profile.stats?.totalPoints || 0, icon: Award, color: 'text-yellow-500' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row items-start gap-8">
        {/* Profile Card */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full md:w-80 bg-card border rounded-xl overflow-hidden shadow-sm shrink-0"
        >
          <div className="h-24 bg-primary/10"></div>
          <div className="px-6 pb-6 -mt-12">
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-3xl font-bold border-4 border-card shadow-lg">
                {profile.displayName?.[0]?.toUpperCase() || 'U'}
              </div>
              
              <div className="mt-4 flex items-center gap-2 group">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="bg-background border rounded px-2 py-1 text-sm focus:ring-2 ring-primary/20 outline-none w-40"
                      autoFocus
                    />
                    <button onClick={handleSaveName} className="p-1 text-green-500 hover:bg-green-50 rounded">
                      <Check size={16} />
                    </button>
                    <button onClick={() => { setIsEditing(false); setNewName(profile.displayName); }} className="p-1 text-red-500 hover:bg-red-50 rounded">
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <h2 className="text-xl font-bold">{profile.displayName}</h2>
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary transition-all"
                    >
                      <Edit2 size={16} />
                    </button>
                  </>
                )}
              </div>
              
              <p className="text-sm text-muted-foreground capitalize">{t(profile.role)}</p>
            </div>

            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="text-muted-foreground" size={18} />
                <span className="truncate">{profile.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Shield className="text-muted-foreground" size={18} />
                <span>{t('role')}: {t(profile.role)}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="text-muted-foreground" size={18} />
                <span>{t('joined') || 'Joined'}: {profile.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats and Content */}
        <div className="flex-1 space-y-8">
          {profile.role === 'student' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-card border rounded-xl p-6 flex items-center gap-4 shadow-sm"
                >
                  <div className={stat.color}>
                    <stat.icon size={32} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card border rounded-xl p-8"
          >
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <User className="text-primary" size={20} />
              {t('personal_info') || 'Personal Information'}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{t('full_name')}</p>
                <div className="flex items-center gap-2 group">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className="bg-background border rounded px-2 py-1 text-sm focus:ring-2 ring-primary/20 outline-none w-full"
                      />
                    </div>
                  ) : (
                    <>
                      <p className="font-medium">{profile.displayName}</p>
                      <button 
                        onClick={() => setIsEditing(true)}
                        className="p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary transition-all"
                      >
                        <Edit2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{t('email')}</p>
                <p className="font-medium">{profile.email}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{t('academic_id')}</p>
                <p className="font-medium">{profile.uid.substring(0, 8).toUpperCase()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{t('status')}</p>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {t(profile.status || 'active')}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Learning Analytics Dashboard */}
      {profile.role === 'student' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <BarChart3 size={24} />
            </div>
            <h2 className="text-2xl font-bold text-primary">{t('learning_analytics')}</h2>
          </div>
          <LearningAnalytics />
        </motion.div>
      )}
    </div>
  );
}
