import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  role: 'admin' | 'viewer' | null;
  allowedIdentifiers?: string[];
  forcePasswordChange?: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, role: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'viewer' | null>(null);
  const [allowedIdentifiers, setAllowedIdentifiers] = useState<string[]>([]);
  const [forcePasswordChange, setForcePasswordChange] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setRole(userData.role || 'admin'); // Fallback to admin if role is missing
          setAllowedIdentifiers(userData.allowedIdentifiers || []);
          setForcePasswordChange(userData.forcePasswordChange || false);
        } else {
          // Default role for first user or new users
          const initialRole = 'admin'; 
          const data = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email?.split('@')[0],
            role: initialRole,
            allowedIdentifiers: [],
            forcePasswordChange: false,
            createdAt: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', user.uid), data);
          setRole(initialRole);
          setAllowedIdentifiers([]);
          setForcePasswordChange(false);
        }
      } else {
        setRole(null);
        setAllowedIdentifiers([]);
        setForcePasswordChange(false);
      }
      setLoading(false);
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, allowedIdentifiers, forcePasswordChange, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
