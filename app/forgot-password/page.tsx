"use client";

import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Password reset link sent! Please check your email.");
    } catch (err) {
      setError("Failed to send password reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <form
        onSubmit={handleReset}
        className="w-full max-w-sm rounded border bg-gray-600 p-6 shadow"
      >
        <h1 className="mb-4 text-xl font-semibold text-white">
          Forgot Password
        </h1>

        <p className="text-gray-300 text-sm mb-4">
          Enter your registered email address, and we’ll send you a link to
          reset your password.
        </p>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-3 w-full rounded border p-2"
          required
        />

        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
        {message && <p className="text-green-500 text-sm mb-2">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-black px-4 py-2 text-white hover:bg-gray-800"
        >
          {loading ? "Sending..." : "Send Reset Link"}
        </button>

        <div className="mt-4 text-center">
          <a href="/login" className="text-sm text-blue-300 hover:underline">
            Back to Login
          </a>
        </div>
      </form>
    </div>
  );
}
