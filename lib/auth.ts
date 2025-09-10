"use client";
import { auth, db } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { doc, getDoc, setDoc, DocumentData } from "firebase/firestore";

type Role = "patient" | "doctor" | null;

type UserData = {
  uid: string;
  email: string;
  role: Role;
  approved: boolean;
  createdAt: number;
  profileCompleted?: boolean;
  // allow additional optional fields
  [key: string]: unknown;
};

export async function registerWithEmail(
  email: string,
  password: string,
  role: Exclude<Role, null>, // must be patient or doctor
  extra: Partial<UserData> = {}
) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  const userDoc: UserData = {
    uid,
    email,
    role,
    approved: role === "doctor" ? false : true, // 👈 doctors need approval
    createdAt: Date.now(),
    ...extra,
  };
  await setDoc(doc(db, "users", uid), userDoc);
  return cred.user;
}

export async function loginWithEmail(email: string, password: string) {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  return user;
}

export async function logout() {
  await signOut(auth);
}

export async function getUserRole(uid: string): Promise<Role> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const data = snap.data() as DocumentData;
  return (data.role as Role) ?? null;
}

const googleProvider = new GoogleAuthProvider();

export async function loginWithGoogle() {
  const res = await signInWithPopup(auth, googleProvider);
  const user = res.user;

  // check if user doc exists
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) {
    const newUser: UserData = {
      uid: user.uid,
      email: user.email ?? "",
      role: null,
      profileCompleted: false,
      approved: false,
      createdAt: Date.now(),
    };
    await setDoc(doc(db, "users", user.uid), newUser);
  }

  return user;
}
