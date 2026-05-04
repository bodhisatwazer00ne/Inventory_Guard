import React, { useState, useEffect, createContext, useContext } from 'react';
import { onAuthStateChanged, User, GoogleAuthProvider, signInWithPopup, signOut, signInAnonymously } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  loginWithGoogle: (role?: 'ADMIN' | 'SALES') => Promise<void>;
  loginAnonymously: (role?: 'ADMIN' | 'SALES') => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const docRef = doc(db, 'users', user.uid);
        try {
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            setProfile({ id: docSnap.id, ...docSnap.data() } as UserProfile);
          } else {
            const roleToAssign = (sessionStorage.getItem('pendingRole') as 'ADMIN' | 'SALES') || 'ADMIN';
            sessionStorage.removeItem('pendingRole');

            const newProfile = {
              shopName: user.isAnonymous ? `Demo Shop` : (user.displayName || 'My Shop'),
              email: user.email || (user.isAnonymous ? `demo-${roleToAssign.toLowerCase()}@inventoryguard.test` : ''),
              role: roleToAssign,
              shopId: user.isAnonymous ? 'demo-shop-v1' : user.uid,
              createdAt: new Date().toISOString(),
            };
            await setDoc(docRef, newProfile);
            setProfile({ id: user.uid, ...newProfile } as UserProfile);
          }
        } catch (err) {
          console.error("Error fetching/creating profile:", err);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loginWithGoogle = async (role: 'ADMIN' | 'SALES' = 'ADMIN') => {
    try {
      const provider = new GoogleAuthProvider();
      sessionStorage.setItem('pendingRole', role);
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      toast.error(error.message || "Google Login failed");
    }
  };

  const loginAnonymously = async (role: 'ADMIN' | 'SALES' = 'ADMIN') => {
    try {
      sessionStorage.setItem('pendingRole', role);
      await signInAnonymously(auth);
      toast.success(`Logged in as Demo ${role}`);
    } catch (error: any) {
      console.error("Anonymous login error:", error);
      if (error.code === 'auth/operation-not-allowed') {
        toast.error("Demo login is not enabled. Please enable 'Anonymous' provider in Firebase Console.");
      } else {
        toast.error(error.message || "Demo login failed");
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, loginWithGoogle, loginAnonymously, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
