"use client";

import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, Loader2, KeyRound } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("✅ Password reset link sent! Please check your inbox.");
      setEmail("");
    } catch (err) {
      console.error("Password reset error:", err);
      toast.error("❌ Failed to send reset email. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white">
      <Toaster position="top-center" />

      {/* Left illustration section */}
      <motion.div
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="hidden md:flex flex-1 flex-col items-center justify-center p-12 bg-gradient-to-tr from-purple-700 via-indigo-600 to-blue-700"
      >
        <div className="text-center space-y-6">
          <KeyRound className="w-20 h-20 mx-auto text-white" />
          <h1 className="text-4xl font-bold">Reset Your Password</h1>
          <p className="text-gray-200 text-lg">
            Forgot your password? Don’t worry. We’ll help you get back into your
            account safely.
          </p>
        </div>
      </motion.div>

      {/* Right form section */}
      <motion.div
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="flex-1 flex items-center justify-center p-8"
      >
        <div className="w-full max-w-md bg-white/10 backdrop-blur-lg border border-white/20 p-8 rounded-2xl shadow-lg">
          <h2 className="text-3xl font-semibold text-center mb-6">
            Forgot Password
          </h2>

          <form onSubmit={handleReset} className="space-y-5">
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
              <input
                type="email"
                placeholder="Enter your registered email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md bg-white/20 border border-gray-500 pl-10 pr-3 py-2 placeholder-gray-300 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 rounded-md bg-blue-600 hover:bg-blue-700 py-2 transition font-semibold text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Sending...
                </>
              ) : (
                "Send Reset Link"
              )}
            </button>
          </form>

          <div className="text-center mt-6">
            <a
              href="/login"
              className="inline-flex items-center gap-2 text-blue-400 hover:underline text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
