import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, deleteDoc, doc } from 'firebase/firestore';
import { 
  Users, 
  ShieldCheck, 
  AlertTriangle, 
  Settings, 
  Search, 
  MoreVertical, 
  UserPlus,
  Mail,
  Trash2,
  Edit2,
  Lock,
  Unlock,
  Activity,
  Database,
  Globe,
  X
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export function AdminDashboard() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);

  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  useEffect(() => {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('createdAt', 'desc'), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersList);
      setTotalUsers(snapshot.size); // This is only for the current query, but better than nothing for now
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
    }
  };

  const stats = [
    { label: t('total_users') || 'Total Users', value: totalUsers || 4520, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: t('active_sessions') || 'Active Sessions', value: 124, icon: Activity, color: 'text-green-500', bg: 'bg-green-500/10' },
    { label: t('database_size') || 'DB Size', value: '1.2 GB', icon: Database, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: t('system_health') || 'System Health', value: '99.9%', icon: ShieldCheck, color: 'text-green-500', bg: 'bg-green-500/10' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('admin_dashboard') || 'Admin Dashboard'}</h2>
          <p className="text-muted-foreground mt-1">{t('admin_subtitle') || 'System-wide management and monitoring.'}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/users" className="bg-muted text-foreground px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-muted/80 transition-all">
            <Users size={20} />
            <span>{t('manage_users') || 'إدارة المستخدمين'}</span>
          </Link>
          <button className="bg-muted text-foreground px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-muted/80 transition-all">
            <Settings size={20} />
            <span>{t('system_settings') || 'Settings'}</span>
          </button>
          <button className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
            <UserPlus size={20} />
            <span>{t('add_user') || 'Add User'}</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-card p-6 rounded-xl border shadow-sm flex items-center gap-4"
          >
            <div className={cn("p-3 rounded-lg", stat.bg, stat.color)}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
              <h3 className="text-2xl font-bold">{stat.value}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      {/* User Management */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">{t('user_management') || 'User Management'}</h3>
          <div className="relative w-80">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input
              type="text"
              placeholder={t('search_users') || 'Search users by name or email...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-card border rounded-xl py-2.5 ps-10 pe-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
        </div>

        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-start">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-6 py-4 text-start text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('user') || 'User'}</th>
                <th className="px-6 py-4 text-start text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('role') || 'Role'}</th>
                <th className="px-6 py-4 text-start text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('status') || 'Status'}</th>
                <th className="px-6 py-4 text-start text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('last_login') || 'Last Login'}</th>
                <th className="px-6 py-4 text-end text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('actions') || 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {(user.displayName || user.name || user.email || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-sm">{user.displayName || user.name || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      user.role === 'admin' ? "bg-purple-500/10 text-purple-500" : 
                      user.role === 'teacher' ? "bg-blue-500/10 text-blue-500" : "bg-green-500/10 text-green-500"
                    )}>
                      {t(user.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", (user.status || 'active') === 'active' ? "bg-green-500" : "bg-destructive")}></div>
                      <span className="text-xs font-medium capitalize">{user.status || 'active'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-muted-foreground">{user.lastLogin || 'N/A'}</td>
                  <td className="px-6 py-4 text-end">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors">
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => setUserToDelete(user.id)}
                        disabled={user.id === profile?.uid}
                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-muted rounded-lg transition-colors disabled:opacity-30"
                      >
                        <Trash2 size={16} />
                      </button>
                      <button className="p-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors">
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* System Logs Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-card p-6 rounded-xl border shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">{t('system_logs') || 'System Logs'}</h3>
            <button className="text-xs font-bold text-primary hover:underline">{t('view_all')}</button>
          </div>
          <div className="space-y-3">
            {[
              { type: 'info', msg: 'System backup completed successfully', time: '10m ago' },
              { type: 'warning', msg: 'High CPU usage detected on server 01', time: '25m ago' },
              { type: 'error', msg: 'Failed login attempt from IP 192.168.1.1', time: '1h ago' },
              { type: 'info', msg: 'New teacher account approved: Sarah J.', time: '3h ago' },
            ].map((log, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-transparent hover:border-border transition-all">
                <div className={cn(
                  "w-2 h-2 mt-1.5 rounded-full",
                  log.type === 'info' ? "bg-blue-500" : log.type === 'warning' ? "bg-yellow-500" : "bg-destructive"
                )}></div>
                <div className="flex-1">
                  <p className="text-xs font-medium">{log.msg}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{log.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card p-6 rounded-xl border shadow-sm space-y-4">
          <h3 className="font-bold text-lg">{t('quick_actions') || 'Quick Actions'}</h3>
          <div className="grid grid-cols-2 gap-4">
            <button className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl bg-muted/50 hover:bg-primary/10 hover:text-primary transition-all group border border-transparent hover:border-primary/20">
              <Globe size={32} className="text-muted-foreground group-hover:text-primary" />
              <span className="text-sm font-bold">{t('manage_languages') || 'Languages'}</span>
            </button>
            <button className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl bg-muted/50 hover:bg-primary/10 hover:text-primary transition-all group border border-transparent hover:border-primary/20">
              <Mail size={32} className="text-muted-foreground group-hover:text-primary" />
              <span className="text-sm font-bold">{t('email_templates') || 'Emails'}</span>
            </button>
            <button className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl bg-muted/50 hover:bg-primary/10 hover:text-primary transition-all group border border-transparent hover:border-primary/20">
              <AlertTriangle size={32} className="text-muted-foreground group-hover:text-primary" />
              <span className="text-sm font-bold">{t('security_audit') || 'Security'}</span>
            </button>
            <button className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl bg-muted/50 hover:bg-primary/10 hover:text-primary transition-all group border border-transparent hover:border-primary/20">
              <Settings size={32} className="text-muted-foreground group-hover:text-primary" />
              <span className="text-sm font-bold">{t('api_keys') || 'API Keys'}</span>
            </button>
          </div>
        </div>
      </div>
      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-card rounded-2xl border shadow-2xl p-8 text-center relative"
          >
            <button 
              onClick={() => setUserToDelete(null)}
              className="absolute top-4 left-4 p-2 hover:bg-muted rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-2xl font-bold mb-2">{t('confirm_delete')}</h3>
            <p className="text-muted-foreground mb-8">
              {t('delete_user_warning') || 'Are you sure you want to delete this user? This action cannot be undone.'}
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setUserToDelete(null)}
                className="flex-1 px-6 py-3 rounded-xl font-bold text-muted-foreground hover:bg-accent transition-all"
              >
                {t('cancel')}
              </button>
              <button
                onClick={async () => {
                  if (userToDelete) {
                    await handleDeleteUser(userToDelete);
                    setUserToDelete(null);
                  }
                }}
                className="flex-1 px-6 py-3 rounded-xl font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all shadow-lg shadow-destructive/20"
              >
                {t('delete')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
