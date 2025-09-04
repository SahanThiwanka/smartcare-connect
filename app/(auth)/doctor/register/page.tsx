"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

// 🔹 Helper: translate Firebase errors to friendly messages
function getErrorMessage(code: string) {
  switch (code) {
    case "auth/invalid-email":
      return "Invalid email address.";
    case "auth/email-already-in-use":
      return "This email is already registered.";
    case "auth/weak-password":
      return "Password is too weak (use at least 6 characters).";
    case "auth/operation-not-allowed":
      return "Email/password accounts are not enabled.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export default function DoctorRegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      const res = await createUserWithEmailAndPassword(auth, email, password);

      if (res.user) {
        // send verification email
        await sendEmailVerification(res.user);

        // create Firestore user record (doctor needs admin approval)
        await setDoc(doc(db, "users", res.user.uid), {
          uid: res.user.uid,
          email,
          role: "doctor",
          approved: false,
          verified: false,
          profileCompleted: false,
          createdAt: Date.now(),
        });

        // sign out immediately so navbars don’t show
        await auth.signOut();

        alert(
          "Doctor registration successful! Please check your email to verify before logging in."
        );
        router.push("/login");
      }
    } catch (err: any) {
      setError(getErrorMessage(err.code || err.message)); // 👈 friendly errors
    }
  }

  return (
    <form onSubmit={handleRegister} className="p-6 max-w-sm mx-auto">
      <h2 className="mb-4 text-xl font-semibold">Doctor Registration</h2>
      <input
        type="email"
        placeholder="Email"
        className="mb-3 block w-full rounded border p-2"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        className="mb-3 block w-full rounded border p-2"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
      <button type="submit" className="rounded bg-black px-4 py-2 text-white">
        Register
      </button>
    </form>
  );
}
