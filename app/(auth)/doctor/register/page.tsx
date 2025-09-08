"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

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
  const [loading, setLoading] = useState(false);

  // 🔹 Email/Password Registration
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await createUserWithEmailAndPassword(auth, email, password);

      if (res.user) {
        await sendEmailVerification(res.user);

        await setDoc(doc(db, "users", res.user.uid), {
          uid: res.user.uid,
          email,
          role: "doctor",
          approved: false, // requires admin approval
          verified: false,
          profileCompleted: false,
          createdAt: Date.now(),
        });

        await auth.signOut();

        alert(
          "Doctor registration successful! Please check your email to verify before logging in."
        );
        router.push("/login");
      }
    } catch (err: any) {
      setError(getErrorMessage(err.code || err.message));
    } finally {
      setLoading(false);
    }
  }

  // 🔹 Google Registration
  async function handleGoogleRegister() {
    setError(null);
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      const user = res.user;

      // check if doctor account already exists
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        await auth.signOut();
        setError(
          "This Google account is already registered. Please login instead."
        );
        setLoading(false);
        return;
      }

      // create doctor Firestore record
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        role: "doctor",
        approved: false, // must be approved by admin
        verified: true, // Google is always verified
        profileCompleted: false,
        createdAt: Date.now(),
      });

      await auth.signOut();

      alert(
        "Doctor registration successful with Google! Please wait for admin approval before logging in."
      );
      router.push("/login");
    } catch (err: any) {
      setError(getErrorMessage(err.code || err.message));
    } finally {
      setLoading(false);
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

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-black px-4 py-2 text-white mb-3"
      >
        {loading ? "Registering..." : "Register"}
      </button>

      <div className="flex items-center justify-center my-3">
        <span className="text-gray-400 text-sm">or</span>
      </div>

      <button
        type="button"
        onClick={handleGoogleRegister}
        disabled={loading}
        className="w-full rounded bg-red-500 hover:bg-red-600 px-4 py-2 text-white"
      >
        {loading ? "Registering with Google..." : "Continue with Google"}
      </button>
    </form>
  );
}
