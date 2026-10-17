import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { toast } from 'sonner';
// @ts-ignore
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, 'clothing-ai-health');
export const storage = getStorage(app);

// Secondary app for creating users without signing out the current user
export const createSecondaryAuth = () => {
  const secondaryApp = getApps().find(a => a.name === 'SecondaryApp') || initializeApp(firebaseConfig, 'SecondaryApp');
  return getAuth(secondaryApp);
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const currentUser = auth.currentUser;

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo: currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };

  let jsonString: string;
  try {
    jsonString = JSON.stringify(errInfo);
  } catch (e) {
    // Fallback if stringification fails due to circular references or other issues
    jsonString = JSON.stringify({
      error: errorMessage,
      operationType,
      path,
      authInfo: { userId: currentUser?.uid || 'unknown' },
      stringificationError: e instanceof Error ? e.message : String(e)
    });
  }

  console.error('Firestore Error: ', jsonString);
  try {
    if (errorMessage.includes('permission-denied') || errorMessage.includes('Missing or insufficient permissions')) {
      toast.error('خطأ في الصلاحيات: ليس لديك صلاحية تنفيذ هذه العملية (تأكد من تسجيل الدخول بحساب المعلم)');
    } else {
      toast.error(`حدث خطأ: ${errorMessage}`);
    }
  } catch (e) {
    // ignore
  }
}

// Test connection (non-blocking)
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    // Non-critical background connection check
  }
}
// Run non-blocking
setTimeout(() => {
  testConnection().catch(() => {});
}, 1000);
