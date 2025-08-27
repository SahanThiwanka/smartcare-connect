"use client";
import { auth, db } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

type Role = "patient" | "doctor";

export async function registerWithEmail(
  email: string,
  password: string,
  role: Role,
  extra: Record<string, any> = {}
) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  await setDoc(doc(db, "users", uid), {
    uid,
    email,
    role,
    approved: role === "doctor" ? false : true, // 👈 NEW: doctors need approval
    createdAt: Date.now(),
    ...extra,
  });
  return cred.user;
}

export async function loginWithEmail(email: string, password: string) {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  return user;
}

export async function logout() {
  await signOut(auth);
}

export async function getUserRole(uid: string): Promise<Role | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const data = snap.data() as any;
  return (data.role as Role) ?? null;
}
