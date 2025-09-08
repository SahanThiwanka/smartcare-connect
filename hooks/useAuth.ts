"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

type Role = "patient" | "doctor" | "admin" | null;

export type UserDoc = {
  uid: string;
  email?: string | null;
  role?: Role;
  profileCompleted?: boolean;
  approved?: boolean;
  [key: string]: any; // allow extra fields
} | null;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [profileCompleted, setProfileCompleted] = useState(false);
  const [approved, setApproved] = useState<boolean | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubDoc: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);

      if (unsubDoc) {
        unsubDoc();
        unsubDoc = null;
      }

      if (u) {
        const ref = doc(db, "users", u.uid);
        unsubDoc = onSnapshot(ref, (snap) => {
          if (snap.exists()) {
            const data = snap.data() as any;
            setUserDoc({ uid: u.uid, email: u.email, ...data });
            setRole((data.role ?? null) as Role);
            setProfileCompleted(Boolean(data.profileCompleted));
            setApproved(data.approved ?? null);
          } else {
            setUserDoc(null);
            setRole(null);
            setProfileCompleted(false);
            setApproved(null);
          }
          setLoading(false);
        });
      } else {
        setUserDoc(null);
        setRole(null);
        setProfileCompleted(false);
        setApproved(null);
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubDoc) unsubDoc();
    };
  }, []);

  return { user, role, profileCompleted, approved, userDoc, loading };
}
