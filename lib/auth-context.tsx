"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import { ensureUserDoc } from "./user";
import type { UserDoc } from "./types";

type AuthContextValue = {
  user: User | null;
  userDoc: UserDoc | null;
  loading: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  userDoc: null,
  loading: true,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubUserDoc: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      unsubUserDoc?.();
      unsubUserDoc = undefined;
      setUser(u);

      if (!u) {
        setUserDoc(null);
        setLoading(false);
        return;
      }

      await ensureUserDoc(u);
      unsubUserDoc = onSnapshot(doc(db, "users", u.uid), (snap) => {
        setUserDoc(snap.exists() ? (snap.data() as UserDoc) : null);
        setLoading(false);
      });
    });

    return () => {
      unsubAuth();
      unsubUserDoc?.();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, userDoc, loading, logout: () => signOut(auth) }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
