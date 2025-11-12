"use client";

import { useEffect, useState, useMemo } from "react";
import { onAuthStateChanged, User, getIdTokenResult } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

/** Add caregiver to the union */
export type Role = "patient" | "doctor" | "admin" | "caregiver" | null;

export type UserDoc =
  | ({
      uid: string;
      email?: string | null;
      role?: Role;
      profileCompleted?: boolean;
      approved?: boolean; // only relevant for doctors
      [key: string]: any; // allow extra fields
    } | null);

/** Ensure only allowed role values (or null) pass through */
function normalizeRole(input: unknown): Role {
  const allowed = new Set(["patient", "doctor", "admin", "caregiver"]);
  if (typeof input === "string" && allowed.has(input)) {
    return input as Role;
  }
  return null;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [profileCompleted, setProfileCompleted] = useState(false);
  const [approved, setApproved] = useState<boolean | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubDoc: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      // clean up previous user doc listener
      if (unsubDoc) {
        unsubDoc();
        unsubDoc = null;
      }

      if (u) {
        // Optional: read custom claims (fallback source of truth if you use them)
        // This won’t override Firestore, it only fills gaps if role is missing there.
        let claimedRole: Role = null;
        try {
          const token = await getIdTokenResult(u, /* forceRefresh */ false);
          claimedRole = normalizeRole(token.claims?.role);
        } catch {
          /* ignore */
        }

        const ref = doc(db, "users", u.uid);
        unsubDoc = onSnapshot(
          ref,
          (snap) => {
            if (snap.exists()) {
              const data = snap.data() as any;

              const docRole = normalizeRole(data?.role);
              const finalRole = docRole ?? claimedRole ?? null;

              setUserDoc({ uid: u.uid, email: u.email, ...data });
              setRole(finalRole);
              setProfileCompleted(Boolean(data?.profileCompleted));

              // Doctors may be gated by admin approval; others usually null
              setApproved(
                finalRole === "doctor"
                  ? (data?.approved ?? null)
                  : null
              );
            } else {
              // user doc not created yet
              setUserDoc({ uid: u.uid, email: u.email, role: claimedRole ?? null });
              setRole(claimedRole ?? null);
              setProfileCompleted(false);
              setApproved(null);
            }
            setLoading(false);
          },
          () => {
            // onSnapshot error
            setUserDoc({ uid: u.uid, email: u.email, role: claimedRole ?? null });
            setRole(claimedRole ?? null);
            setProfileCompleted(false);
            setApproved(null);
            setLoading(false);
          }
        );
      } else {
        // signed out
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

  // Nice convenience flags for rendering
  const flags = useMemo(() => {
    const isAuthed = !!user;
    const isPatient = role === "patient";
    const isDoctor = role === "doctor";
    const isAdmin = role === "admin";
    const isCaregiver = role === "caregiver";
    const ready = !loading;
    return { isAuthed, isPatient, isDoctor, isAdmin, isCaregiver, ready };
  }, [user, role, loading]);

  return {
    user,
    role,
    profileCompleted,
    approved,
    userDoc,
    loading,
    ...flags,
  };
}
