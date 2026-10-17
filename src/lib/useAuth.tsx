import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
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

  const [loading, setLoading] = useState<boolean>(() => {
    return !localStorage.getItem('auth_user');
  });

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

  // Force loading=false after 2 seconds no matter what
  useEffect(() => {
    const forceTimer = setTimeout(() => {
      setLoading(false);
    }, 2000);
    return () => clearTimeout(forceTimer);
  }, []);

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
          // If explicit logout was triggered, clear
          if (localStorage.getItem('explicit_logout')) {
            setUser(null);
            setProfile(null);
            localStorage.removeItem('auth_user');
            localStorage.removeItem('auth_profile');
            localStorage.removeItem('explicit_logout');
          }
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
        }
        setLoading(false);
      }, (error) => {
        console.warn("Firestore profile offline:", error);
        setLoading(false);
      });
      return () => unsubscribeProfile();
    }
  }, [user?.uid]);

  const isAdmin = roleOverride === 'admin' || profile?.role === 'admin' || ['postgraduatesystem79@gmail.com', 'gradateminia@gmail.com', 'drosamaayed@gmail.com', 'admin@adptive.edu.eg', 'admin@system.com'].includes(user?.email || '');
  const isTeacher = roleOverride === 'teacher' || (!roleOverride && profile?.role === 'teacher') || isAdmin || (roleOverride !== 'student' && profile?.role !== 'student');
  const isStudent = roleOverride === 'student' || (!isTeacher && !isAdmin);

  const value = {
    user,
    profile: isAdmin 
      ? { ...profile, status: 'active', role: 'admin' } 
      : (isTeacher ? { ...profile, status: 'active', role: 'teacher' } : profile),
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

