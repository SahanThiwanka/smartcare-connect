"use client";
import { auth, db } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
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

const googleProvider = new GoogleAuthProvider();

export async function loginWithGoogle() {
  const res = await signInWithPopup(auth, googleProvider);
  const user = res.user;

  // check if user doc exists
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) {
    // new user → ask them to complete profile
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: user.email,
      role: null, // let them choose later?
      profileCompleted: false,
      createdAt: Date.now(),
    });
  }

  return user;
}
