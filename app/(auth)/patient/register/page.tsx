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
import { FirebaseError } from "firebase/app";
import { motion } from "framer-motion";
import {
  Mail,
  Lock,
  HeartPulse,
  Loader2,
  Chrome,
  UserPlus,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

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

export default function PatientRegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔹 Email Registration
  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      if (res.user) {
        await sendEmailVerification(res.user);
        await setDoc(doc(db, "users", res.user.uid), {
          uid: res.user.uid,
          email,
          role: "patient",
          verified: false,
          profileCompleted: false,
          createdAt: Date.now(),
        });

        await auth.signOut();
        toast.success("Registration successful! Please verify your email.");
        router.push("/login");
      }
    } catch (err: unknown) {
      const error = err as FirebaseError;
      toast.error(getErrorMessage(error.code || "unknown"));
    } finally {
      setLoading(false);
    }
  }

  // 🔹 Google Registration
  async function handleGoogleRegister() {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      const user = res.user;

      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        await auth.signOut();
        toast.error(
          "This Google account is already registered. Please log in."
        );
        return;
      }

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        role: "patient",
        verified: true,
        profileCompleted: false,
        createdAt: Date.now(),
      });

      await auth.signOut();
      toast.success("Patient registered successfully! Please log in.");
      router.push("/login");
    } catch (err: unknown) {
      const error = err as FirebaseError;
      toast.error(getErrorMessage(error.code || "unknown"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white">
      <Toaster position="top-center" />

      {/* Left Panel - Illustration */}
      <motion.div
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="hidden md:flex flex-1 flex-col items-center justify-center p-12 bg-gradient-to-tr from-pink-700 via-red-600 to-rose-700"
      >
        <div className="text-center space-y-6">
          <HeartPulse className="w-20 h-20 mx-auto text-white" />
          <h1 className="text-4xl font-bold">Join SmartCare Connect</h1>
          <p className="text-gray-200 text-lg">
            Take charge of your health journey. Track, connect, and care with
            SmartCare.
          </p>
        </div>
      </motion.div>

      {/* Right Panel - Form */}
      <motion.div
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="flex-1 flex items-center justify-center p-8"
      >
        <div className="w-full max-w-md bg-white/10 backdrop-blur-lg border border-white/20 p-8 rounded-2xl shadow-lg">
          <h2 className="text-3xl font-semibold text-center mb-6 flex items-center justify-center gap-2">
            <UserPlus className="w-6 h-6 text-pink-400" /> Patient Registration
          </h2>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md bg-white/20 border border-gray-500 pl-10 pr-3 py-2 placeholder-gray-300 text-white focus:ring-2 focus:ring-pink-500 outline-none"
                required
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md bg-white/20 border border-gray-500 pl-10 pr-3 py-2 placeholder-gray-300 text-white focus:ring-2 focus:ring-pink-500 outline-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 rounded-md bg-pink-600 hover:bg-pink-700 py-2 transition font-semibold text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Registering...
                </>
              ) : (
                "Register"
              )}
            </button>

            <div className="text-center text-gray-400 text-sm mt-2">or</div>

            <button
              type="button"
              onClick={handleGoogleRegister}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 py-2 rounded-md hover:bg-gray-100 transition"
            >
              <Chrome className="w-5 h-5 text-red-500" />
              Continue with Google
            </button>

            <p className="text-center text-gray-400 text-sm mt-4">
              Already have an account?{" "}
              <a
                href="/login"
                className="text-pink-400 hover:underline font-medium"
              >
                Login here
              </a>
            </p>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
