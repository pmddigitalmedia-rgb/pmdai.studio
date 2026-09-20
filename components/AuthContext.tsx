import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut as fbSignOut, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, updateDoc, increment, collection, addDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../services/firebase';
import { UserProfile, UserRole } from '../types';

export const ADMIN_EMAILS = ['pmddigitalmedia@gmail.com'];

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isActualAdmin: boolean;
  clientPreviewMode: boolean;
  setClientPreviewMode: (preview: boolean) => void;
  toggleClientPreviewMode: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  deductCredits: (amount: number, description: string, toolId?: string) => Promise<boolean>;
  addCredits: (amount: number, description: string) => Promise<void>;
  setAdminRoleManually?: (userId: string, role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [clientPreviewMode, setClientPreviewModeState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pmd_client_preview_mode') === 'true';
    } catch {
      return false;
    }
  });

  const setClientPreviewMode = (preview: boolean) => {
    setClientPreviewModeState(preview);
    try {
      localStorage.setItem('pmd_client_preview_mode', preview ? 'true' : 'false');
    } catch {}
  };

  const toggleClientPreviewMode = () => {
    setClientPreviewMode(!clientPreviewMode);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        
        // Listen to live profile updates (e.g. credit changes)
        const isDefaultAdmin = ADMIN_EMAILS.includes(currentUser.email?.toLowerCase() || '');
        const defaultProfile: UserProfile = {
          uid: currentUser.uid,
          email: currentUser.email || '',
          displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
          role: isDefaultAdmin ? 'admin' : 'client',
          credits: isDefaultAdmin ? 999999 : 300,
          plan: isDefaultAdmin ? 'agency' : 'starter',
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        const unsubDoc = onSnapshot(userDocRef, async (snapshot) => {
          if (snapshot.exists()) {
            setProfile(snapshot.data() as UserProfile);
          } else {
            // First time signup: initialize profile
            try {
              await setDoc(userDocRef, defaultProfile);
              setProfile(defaultProfile);
            } catch (createErr) {
              console.warn("Could not save initial profile to Firestore:", createErr);
              setProfile(defaultProfile);
            }
          }
          setLoading(false);
        }, (error) => {
          console.warn("Firestore profile sync notice:", error.message);
          // Fallback to local authenticated profile so the app remains fully functional
          setProfile(defaultProfile);
          setLoading(false);
        });

        return () => unsubDoc();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Google sign in failed:", err);
      throw err;
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (cred.user) {
      await updateProfile(cred.user, { displayName: name });
    }
  };

  const signOut = async () => {
    await fbSignOut(auth);
  };

  const isActualAdmin = profile?.role === 'admin' || ADMIN_EMAILS.includes(user?.email?.toLowerCase() || '');
  const isAdmin = isActualAdmin && !clientPreviewMode;

  const deductCredits = async (amount: number, description: string, toolId?: string): Promise<boolean> => {
    if (!user) return false;
    
    // Admins have infinite bypass (even in client preview mode to test freely)
    if (isActualAdmin) {
      return true;
    }

    if (!profile || profile.credits < amount) {
      return false;
    }

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        credits: increment(-amount),
        updatedAt: Date.now()
      });

      // Log transaction
      const txCol = collection(db, 'users', user.uid, 'transactions');
      await addDoc(txCol, {
        userId: user.uid,
        amount: -amount,
        type: 'usage',
        description,
        toolId: toolId || 'unknown',
        timestamp: Date.now()
      });

      return true;
    } catch (err) {
      console.error("Credit deduction failed:", err);
      return false;
    }
  };

  const addCredits = async (amount: number, description: string) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        credits: increment(amount),
        updatedAt: Date.now()
      });

      const txCol = collection(db, 'users', user.uid, 'transactions');
      await addDoc(txCol, {
        userId: user.uid,
        amount: amount,
        type: 'purchase',
        description,
        timestamp: Date.now()
      });
    } catch (err) {
      console.error("Failed adding credits:", err);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      isAdmin,
      isActualAdmin,
      clientPreviewMode,
      setClientPreviewMode,
      toggleClientPreviewMode,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      deductCredits,
      addCredits
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
