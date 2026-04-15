import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/useAuth';
import { db, handleFirestoreError, OperationType, createSecondaryAuth } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { 
  Users, 
  Search, 
  MoreVertical, 
  UserPlus,
  Mail,
  Trash2,
  Edit2,
  Shield,
  CheckCircle2,
  XCircle,
  X,
  Loader2,
  FileUp,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

export function UserManagement() {
  const { t } = useTranslation();
  const { profile, isAdmin } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'teacher' | 'student'>('all');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
    academicId: ''
  });

  useEffect(() => {
    const usersRef = collection(db, 'users');
    const usersQuery = query(usersRef);
    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleOpenAddModal = () => {
    setFormData({ name: '', email: '', password: '', role: 'student', academicId: '' });
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (user: any) => {
    setSelectedUser(user);
    setFormData({
      name: user.name || '',
      email: user.email || '',
      role: user.role || 'student',
      academicId: user.academicId || ''
    });
    setIsEditModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const path = isEditModalOpen && selectedUser ? `users/${selectedUser.id}` : 'users';
    try {
      if (isEditModalOpen && selectedUser) {
        await updateDoc(doc(db, 'users', selectedUser.id), {
          name: formData.name,
          role: formData.role,
          academicId: formData.academicId
        });
      } else {
        // Create Auth user using secondary instance
        const secondaryAuth = createSecondaryAuth();
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
        const user = userCredential.user;

        // Update profile in secondary instance
        await updateProfile(user, { displayName: formData.name });

        // Sign out from secondary instance
        await signOut(secondaryAuth);

        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          displayName: formData.name,
          name: formData.name,
          email: formData.email,
          role: formData.role,
          academicId: formData.academicId,
          createdAt: serverTimestamp(),
          stats: {
            hoursSpent: 0,
            coursesCompleted: 0,
            totalPoints: 0,
            contentVisits: {
              word: 0,
              ppt: 0,
              pdf: 0,
              video: 0,
              audio: 0
            },
            evaluationPerformance: {},
            completedLessons: [],
            sessionTiming: {}
          }
        });
      }
      setIsAddModalOpen(false);
      setIsEditModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, isEditModalOpen ? OperationType.UPDATE : OperationType.CREATE, path);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      (user.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.academicId?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    
    return matchesSearch && matchesRole;
  });

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleUpdateStatus = async (userId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { status: newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleBulkActivate = async () => {
    const inactiveUsers = users.filter(u => u.status !== 'active' && u.role === 'student');
    if (inactiveUsers.length === 0) return;
    
    setLoading(true);
    try {
      for (const user of inactiveUsers) {
        await updateDoc(doc(db, 'users', user.id), { status: 'active' });
      }
      toast.success('تم تفعيل جميع الطلاب بنجاح');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    } finally {
      setLoading(false);
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress({ current: 0, total: 0 });

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          toast.error('الملف فارغ');
          setIsUploading(false);
          return;
        }

        setUploadProgress({ current: 0, total: data.length });
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const name = row['الاسم'] || row['Name'] || row['name'];
          const academicId = row['الرقم الأكاديمي'] || row['Academic ID'] || row['id'] || row['academicId'];

          if (!name) {
            errorCount++;
            continue;
          }

          // Generate default email and password
          const sanitizedId = academicId ? academicId.toString().replace(/\s+/g, '') : Math.random().toString(36).substring(7);
          const email = `${sanitizedId}@student.edu`;
          const password = academicId ? academicId.toString() : '12345678';

          try {
            const secondaryAuth = createSecondaryAuth();
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
            const user = userCredential.user;

            await updateProfile(user, { displayName: name });
            await signOut(secondaryAuth);

            await setDoc(doc(db, 'users', user.uid), {
              uid: user.uid,
              displayName: name,
              name: name,
              email: email,
              role: 'student',
              academicId: academicId?.toString() || '',
              status: 'active',
              createdAt: serverTimestamp(),
              stats: {
                hoursSpent: 0,
                coursesCompleted: 0,
                totalPoints: 0,
                contentVisits: {
                  word: 0,
                  ppt: 0,
                  pdf: 0,
                  video: 0,
                  audio: 0
                },
                evaluationPerformance: {},
                completedLessons: [],
                sessionTiming: {}
              }
            });
            successCount++;
          } catch (err: any) {
            console.error(`Error creating user ${name}:`, err);
            // If user already exists, we might want to skip or update, but for now just count error
            errorCount++;
          }
          setUploadProgress(prev => ({ ...prev, current: i + 1 }));
        }

        toast.success(`تم الانتهاء: ${successCount} نجاح، ${errorCount} فشل`);
      } catch (err) {
        console.error('Excel parsing error:', err);
        toast.error('خطأ في معالجة ملف الإكسيل');
      } finally {
        setIsUploading(false);
        e.target.value = ''; // Reset input
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const template = [
      { 'الاسم': 'أحمد محمد', 'الرقم الأكاديمي': '2024001' },
      { 'الاسم': 'سارة علي', 'الرقم الأكاديمي': '2024002' }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "students_template.xlsx");
  };

  const downloadUserData = () => {
    const dataToExport = filteredUsers.map(user => ({
      'الاسم': user.displayName || user.name || 'N/A',
      'البريد الإلكتروني': user.email,
      'الحالة': user.status === 'active' ? 'نشط' : user.status === 'pending' ? 'معلق' : 'غير نشط'
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Users Data");
    XLSX.writeFile(wb, "users_report.xlsx");
  };

  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteDoc(doc(db, 'users', userId));
      setUserToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t('manage_users') || 'إدارة المستخدمين'}</h2>
          <p className="text-muted-foreground mt-1">{t('manage_users_subtitle') || 'إدارة صلاحيات وأدوار المستخدمين في النظام.'}</p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-3">
            <input 
              type="file" 
              id="excel-upload" 
              className="hidden" 
              accept=".xlsx, .xls" 
              onChange={handleExcelUpload}
              disabled={isUploading}
            />
            <button 
              onClick={downloadTemplate}
              className="bg-muted text-muted-foreground px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-muted/80 transition-all"
              title="تحميل نموذج الإكسيل"
            >
              <Download size={20} />
              <span className="hidden md:inline">نموذج</span>
            </button>
            <label 
              htmlFor="excel-upload"
              className={cn(
                "bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20 cursor-pointer",
                isUploading && "opacity-50 cursor-not-allowed"
              )}
            >
              {isUploading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>جاري الرفع ({uploadProgress.current}/{uploadProgress.total})</span>
                </>
              ) : (
                <>
                  <FileUp size={20} />
                  <span>رفع إكسيل</span>
                </>
              )}
            </label>
            <button 
              onClick={downloadUserData}
              className="bg-amber-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-amber-700 transition-all shadow-lg shadow-amber-900/20"
              title="تحميل بيانات المستخدمين"
            >
              <Download size={20} />
              <span>تحميل البيانات</span>
            </button>
            <button 
              onClick={handleBulkActivate}
              className="bg-green-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-green-700 transition-all shadow-lg shadow-green-900/20"
            >
              <CheckCircle2 size={20} />
              <span>تفعيل الكل</span>
            </button>
            <button 
              onClick={handleOpenAddModal}
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
            >
              <UserPlus size={20} />
              <span>{t('add_user') || 'إضافة مستخدم'}</span>
            </button>
          </div>
        )}
      </div>

      <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
        <div className="p-6 border-b bg-muted/10 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input
              type="text"
              placeholder={t('search_users') || 'بحث عن مستخدم...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-background border rounded-xl py-2.5 ps-10 pe-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            {(['all', 'admin', 'teacher', 'student'] as const).map((role) => (
              <button
                key={role}
                onClick={() => setFilterRole(role)}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all",
                  filterRole === role 
                    ? "bg-primary text-primary-foreground shadow-md" 
                    : "bg-background border hover:bg-accent"
                )}
              >
                {t(role) || role}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-start">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-6 py-4 text-start text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('user') || 'المستخدم'}</th>
                <th className="px-6 py-4 text-start text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('role') || 'الدور'}</th>
                <th className="px-6 py-4 text-start text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('status') || 'الحالة'}</th>
                <th className="px-6 py-4 text-start text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('academic_id') || 'الرقم الأكاديمي'}</th>
                <th className="px-6 py-4 text-end text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('actions') || 'إجراءات'}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <AnimatePresence mode="popLayout">
                {filteredUsers.map((user) => (
                  <motion.tr 
                    key={user.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="hover:bg-muted/30 transition-colors"
                  >
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
                      <select 
                        value={user.role}
                        onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                        disabled={!isAdmin || user.id === profile?.uid}
                        className={cn(
                          "bg-transparent border-none text-[10px] font-bold uppercase tracking-wider p-1 rounded focus:ring-0 cursor-pointer",
                          user.role === 'admin' ? "text-purple-500" : 
                          user.role === 'teacher' ? "text-blue-500" : "text-green-500"
                        )}
                      >
                        <option value="student">{t('student')}</option>
                        <option value="teacher">{t('teacher')}</option>
                        <option value="admin">{t('admin')}</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <select 
                        value={user.status || 'pending'}
                        onChange={(e) => handleUpdateStatus(user.id, e.target.value)}
                        disabled={!isAdmin || user.id === profile?.uid}
                        className={cn(
                          "bg-transparent border-none text-[10px] font-bold uppercase tracking-wider p-1 rounded focus:ring-0 cursor-pointer",
                          user.status === 'active' ? "text-green-500" : "text-amber-500"
                        )}
                      >
                        <option value="active">نشط</option>
                        <option value="pending">معلق</option>
                        <option value="inactive">غير نشط</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-muted-foreground">
                      {user.academicId || '---'}
                    </td>
                    <td className="px-6 py-4 text-end">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleOpenEditModal(user)}
                          className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors">
                          <Mail size={16} />
                        </button>
                        <button 
                          onClick={() => setUserToDelete(user.id)}
                          disabled={!isAdmin || user.id === profile?.uid}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-muted rounded-lg transition-colors disabled:opacity-30"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {filteredUsers.length === 0 && (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
              <p className="text-muted-foreground">{t('no_users_found') || 'لم يتم العثور على مستخدمين'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
    
    {/* Add/Edit User Modal */}
    <AnimatePresence>
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md bg-card rounded-2xl border shadow-2xl p-8 relative"
          >
            <button 
              onClick={() => {
                setIsAddModalOpen(false);
                setIsEditModalOpen(false);
              }}
              className="absolute top-4 left-4 p-2 hover:bg-muted rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            <h3 className="text-2xl font-bold mb-6">
              {isEditModalOpen ? (t('edit_user') || 'تعديل مستخدم') : (t('add_user') || 'إضافة مستخدم')}
            </h3>
            <form onSubmit={handleSaveUser} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('name') || 'الاسم'}</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-background border rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('email') || 'البريد الإلكتروني'}</label>
                <input
                  type="email"
                  required
                  disabled={isEditModalOpen}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-background border rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:opacity-50"
                />
              </div>
              {!isEditModalOpen && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('password') || 'كلمة المرور'}</label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-background border rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder="••••••••"
                  />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('role') || 'الدور'}</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full bg-background border rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                >
                  <option value="student">{t('student')}</option>
                  <option value="teacher">{t('teacher')}</option>
                  <option value="admin">{t('admin')}</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('academic_id') || 'الرقم الأكاديمي'}</label>
                <input
                  type="text"
                  value={formData.academicId}
                  onChange={(e) => setFormData({ ...formData, academicId: e.target.value })}
                  className="w-full bg-background border rounded-xl py-2.5 px-4 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>
              <div className="flex gap-4 justify-end pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setIsEditModalOpen(false);
                  }}
                  className="px-6 py-2.5 rounded-xl font-bold text-muted-foreground hover:bg-accent transition-all"
                >
                  {t('cancel') || 'إلغاء'}
                </button>
                <button
                  type="submit"
                  className="px-8 py-2.5 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                  {t('save') || 'حفظ'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    {/* Delete Confirmation Modal */}
    <AnimatePresence>
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md bg-card rounded-2xl border shadow-2xl p-8 relative"
          >
            <button 
              onClick={() => setUserToDelete(null)}
              className="absolute top-4 left-4 p-2 hover:bg-muted rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            <h3 className="text-xl font-bold mb-4">{t('confirm_delete_user') || 'تأكيد الحذف'}</h3>
            <p className="text-muted-foreground mb-6">{t('delete_user_warning') || 'هل أنت متأكد من رغبتك في حذف هذا المستخدم؟ لا يمكن التراجع عن هذا الإجراء.'}</p>
            <div className="flex gap-4 justify-end">
              <button
                onClick={() => setUserToDelete(null)}
                className="px-6 py-2 rounded-xl font-bold text-muted-foreground hover:bg-accent transition-all"
              >
                {t('cancel') || 'إلغاء'}
              </button>
              <button
                onClick={() => handleDeleteUser(userToDelete)}
                className="px-6 py-2 rounded-xl font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all shadow-lg shadow-destructive/20"
              >
                {t('delete') || 'حذف'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  </>
);
}
