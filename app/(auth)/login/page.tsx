"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { motion } from "framer-motion";
import { Mail, Lock, Loader2, ShieldCheck, LogIn, Chrome } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

function getErrorMessage(code: string) {
  switch (code) {
    case "auth/invalid-email":
      return "Invalid email address.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/user-not-found":
      return "No account found with this email.";
    case "auth/wrong-password":
      return "Incorrect password.";
    case "auth/email-already-in-use":
      return "This email is already registered.";
    case "auth/weak-password":
      return "Password is too weak.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await signInWithEmailAndPassword(auth, email, password);

      if (!res.user.emailVerified) {
        toast.error("Please verify your email before logging in.");
        setLoading(false);
        return;
      }

      const snap = await getDoc(doc(db, "users", res.user.uid));
      if (!snap.exists()) {
        toast.error("No account found. Please register first.");
        setLoading(false);
        return;
      }

      const data = snap.data();
      if (!data) {
        toast.error("User data missing. Please contact support.");
        setLoading(false);
        return;
      }

      if (!data.profileCompleted) router.push("/setup-profile");
      else if (data.role === "patient") router.push("/patient/dashboard");
      else if (data.role === "doctor") router.push("/doctor/dashboard");
      else if (data.role === "admin") router.push("/admin");
      else router.push("/");
    } catch (err: unknown) {
      const error = err as FirebaseError;
      toast.error(getErrorMessage(error.code || "unknown"));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      const user = res.user;

      const snap = await getDoc(doc(db, "users", user.uid));
      if (!snap.exists()) {
        await auth.signOut();
        toast.error("No account found. Please register first.");
        return;
      }

      const data = snap.data();
      if (!data) {
        toast.error("User data missing. Please contact support.");
        return;
      }

      if (!data.profileCompleted) router.push("/setup-profile");
      else if (data.role === "patient") router.push("/patient/dashboard");
      else if (data.role === "doctor") router.push("/doctor/dashboard");
      else if (data.role === "admin") router.push("/admin");
      else router.push("/");
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

      {/* Left Panel */}
      <motion.div
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="hidden md:flex flex-1 flex-col items-center justify-center p-12 bg-gradient-to-tr from-blue-700 via-indigo-600 to-purple-700"
      >
        <div className="text-center space-y-6">
          <ShieldCheck className="w-20 h-20 mx-auto text-white" />
          <h1 className="text-4xl font-bold">SmartCare Connect</h1>
          <p className="text-gray-200 text-lg">
            Your personal health management platform — secure, connected, and
            effortless.
          </p>
        </div>
      </motion.div>

      {/* Right Panel (Login Form) */}
      <motion.div
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="flex-1 flex items-center justify-center p-8"
      >
        <div className="w-full max-w-md bg-white/10 backdrop-blur-lg border border-white/20 p-8 rounded-2xl shadow-lg">
          <h2 className="text-3xl font-semibold text-center mb-6 flex items-center justify-center gap-2">
            <LogIn className="w-7 h-7 text-blue-400" /> Login
          </h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md bg-white/20 border border-gray-500 pl-10 pr-3 py-2 placeholder-gray-300 text-white focus:ring-2 focus:ring-blue-500 outline-none"
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
                className="w-full rounded-md bg-white/20 border border-gray-500 pl-10 pr-3 py-2 placeholder-gray-300 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            <div className="text-right text-sm">
              <a
                href="/forgot-password"
                className="text-blue-400 hover:underline"
              >
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 rounded-md bg-blue-600 hover:bg-blue-700 py-2 transition font-semibold text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Logging in...
                </>
              ) : (
                "Login"
              )}
            </button>

            <div className="text-center text-gray-400 text-sm mt-2">or</div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 py-2 rounded-md hover:bg-gray-100 transition"
            >
              <Chrome className="w-5 h-5 text-red-500" />
              Continue with Google
            </button>

            <p className="text-center text-gray-400 text-sm mt-4">
              Don’t have an account?{" "}
              <a
                href="/register"
                className="text-blue-400 hover:underline font-medium"
              >
                Register here
              </a>
            </p>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
