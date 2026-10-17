import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
  isStudent: boolean;
  setRole: (role: 'teacher' | 'student' | 'admin') => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: false,
  isAdmin: false,
  isTeacher: true,
  isStudent: false,
  setRole: () => {},
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(() => {
    const cached = localStorage.getItem('auth_user');
    if (cached) {
      try { return JSON.parse(cached); } catch { return null; }
    }
    return null;
  });
  
  const [profile, setProfile] = useState<any | null>(() => {
    const cached = localStorage.getItem('auth_profile');
    if (cached) {
      try { return JSON.parse(cached); } catch { return null; }
    }
    return null;
  });

  const [loading, setLoading] = useState(true);

  const [roleOverride, setRoleOverride] = useState<'teacher' | 'student' | 'admin' | null>(() => {
    return (localStorage.getItem('app_role') as any) || 'teacher';
  });

  const setRole = (newRole: 'teacher' | 'student' | 'admin') => {
    setRoleOverride(newRole);
    localStorage.setItem('app_role', newRole);
    if (user && db) {
      import('firebase/firestore').then(({ setDoc, doc }) => {
        setDoc(doc(db, 'users', user.uid), { role: newRole, status: 'active' }, { merge: true }).catch(() => {});
      });
    }
  };

  const logout = async () => {
    localStorage.setItem('explicit_logout', 'true');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_profile');
    setUser(null);
    setProfile(null);
    try {
      await auth.signOut();
    } catch (e) {
      console.warn("SignOut error:", e);
    }
  };

  useEffect(() => {
    try {
      const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
        console.log('Auth state:', firebaseUser ? 'Logged In' : 'Logged Out');
        if (firebaseUser) {
          const authData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || 'م/ اسراء',
          };
          setUser(firebaseUser);
          localStorage.setItem('auth_user', JSON.stringify(authData));
        } else {
          // Cached names are not an authenticated session, including after a project change.
          setUser(null);
          setProfile(null);
          localStorage.removeItem('auth_user');
          localStorage.removeItem('auth_profile');
          localStorage.removeItem('explicit_logout');
        }
        setLoading(false);
      }, (error) => {
        console.error('Firebase Auth Error:', error);
        setLoading(false);
      });

      return () => unsubscribeAuth();
    } catch (err) {
      console.error('Auth init failed:', err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.uid) {
      const path = `users/${user.uid}`;
      const unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
        const data = docSnap.data();
        if (data) {
          const newProfile = { ...data, uid: user.uid };
          setProfile(newProfile);
          localStorage.setItem('auth_profile', JSON.stringify(newProfile));
        } else {
          const email = (user.email || '').toLowerCase();
          const role = email === 'admin@system.com' ? 'admin' : email === 'teacher@system.com' ? 'teacher' : 'student';
          const initialProfile = { uid: user.uid, email: user.email || '', displayName: user.displayName || (role === 'student' ? 'طالبة المقرر' : 'معلم المقرر'), role, status: 'active', createdAt: serverTimestamp(), stats: {} };
          setDoc(doc(db, 'users', user.uid), initialProfile).catch(error => console.warn('Profile initialization failed:', error.code));
        }
        setLoading(false);
      }, (error) => {
        console.warn("Firestore profile offline:", error);
        setLoading(false);
      });
      return () => unsubscribeProfile();
    }
  }, [user?.uid]);

  const emailLower = (user?.email || '').toLowerCase();
  const isAdmin = roleOverride === 'admin' || profile?.role === 'admin' || [
    'postgraduatesystem79@gmail.com', 
    'gradateminia@gmail.com', 
    'drosamaayed@gmail.com', 
    'admin@adptive.edu.eg', 
    'admin@system.com'
  ].includes(emailLower);

  const isExplicitStudent = emailLower === 'student@system.com' || roleOverride === 'student' || profile?.role === 'student';
  const isExplicitTeacher = emailLower === 'teacher@system.com' || roleOverride === 'teacher' || profile?.role === 'teacher';

  const isTeacher = !isExplicitStudent && (isAdmin || isExplicitTeacher || (roleOverride === 'teacher'));
  const isStudent = isExplicitStudent || (!isTeacher && !isAdmin);

  let effectiveProfile = profile ? { ...profile } : { uid: user?.uid, email: user?.email };
  if (isStudent) {
    effectiveProfile = { ...effectiveProfile, role: 'student', status: 'active', displayName: effectiveProfile.displayName || 'طالبة المقرر' };
  } else if (isAdmin) {
    effectiveProfile = { ...effectiveProfile, role: 'admin', status: 'active', displayName: effectiveProfile.displayName || 'مدير النظام' };
  } else if (isTeacher) {
    effectiveProfile = { ...effectiveProfile, role: 'teacher', status: 'active', displayName: effectiveProfile.displayName || 'معلم المقرر' };
  }

  const value = {
    user,
    profile: effectiveProfile,
    loading,
    isAdmin,
    isTeacher,
    isStudent,
    setRole,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

