import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  getDocs, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // In callback environments like onSnapshot, throwing causes FIRESTORE INTERNAL ASSERTION FAILED
  // We avoid throwing so that we don't crash the Firebase SDK event loop
}

export const getUserProfile = async (uid: string) => {
  const path = `users/${uid}`;
  try {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
};

export const createUserProfile = async (uid: string, data: any) => {
  const path = `users/${uid}`;
  try {
    await setDoc(doc(db, 'users', uid), {
      ...data,
      uid,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const saveChatMessage = async (uid: string, message: any) => {
  const path = `users/${uid}/chat`;
  try {
    await addDoc(collection(db, 'users', uid, 'chat'), {
      ...message,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const getChatHistory = async (uid: string) => {
  const path = `users/${uid}/chat`;
  try {
    const q = query(
      collection(db, 'users', uid, 'chat'),
      orderBy('timestamp', 'asc'),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
};

export const saveQuizAttempt = async (uid: string, attempt: any) => {
  const path = `users/${uid}/history`;
  try {
    await addDoc(collection(db, 'users', uid, 'history'), {
      ...attempt,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const getQuizHistory = async (uid: string) => {
  const path = `users/${uid}/history`;
  try {
    const q = query(
      collection(db, 'users', uid, 'history'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
};

export const getAnsweredQuestionTexts = async (uid: string): Promise<string[]> => {
  const path = `users/${uid}/history`;
  try {
    const q = query(collection(db, 'users', uid, 'history'), orderBy('timestamp', 'desc'), limit(100)); // Increased limit to enforce uniqueness better
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data().question).filter(Boolean);
  } catch(e) {
    return [];
  }
};
