"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

// 🔹 Helper: translate Firebase errors to friendly messages
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
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 🔹 Email/Password Login
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      const res = await signInWithEmailAndPassword(auth, email, password);

      if (!res.user.emailVerified) {
        setError("Your email is not verified.");
        setInfo("Click below to resend the verification email.");
        setLoading(false);
        return;
      }

      const snap = await getDoc(doc(db, "users", res.user.uid));
      if (!snap.exists()) {
        setError(
          "No account found. Please register first as Patient or Doctor."
        );
        setLoading(false);
        return;
      }

      const data = snap.data();
      if (!data.profileCompleted) {
        router.push("/setup-profile");
      } else if (data.role === "patient") {
        router.push("/patient/profile");
      } else if (data.role === "doctor") {
        router.push("/doctor/profile");
      } else if (data.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/");
      }
    } catch (err: unknown) {
      if (err instanceof Error && "code" in err) {
        setError(getErrorMessage((err as { code: string }).code));
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  }

  // 🔹 Google Login (no registration allowed here)
  async function handleGoogleLogin() {
    setError(null);
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      const user = res.user;

      const snap = await getDoc(doc(db, "users", user.uid));
      if (!snap.exists()) {
        await auth.signOut(); // cleanup
        setError(
          "No account found. Please register first as Patient or Doctor."
        );
        setLoading(false);
        return;
      }

      const data = snap.data();
      if (!data.profileCompleted) {
        router.push("/setup-profile");
      } else if (data.role === "patient") {
        router.push("/patient/profile");
      } else if (data.role === "doctor") {
        router.push("/doctor/profile");
      } else if (data.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/");
      }
    } catch (err: unknown) {
      if (err instanceof Error && "code" in err) {
        setError(getErrorMessage((err as { code: string }).code));
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function resendVerification() {
    if (!auth.currentUser) {
      setError("You need to log in first.");
      return;
    }
    try {
      await sendEmailVerification(auth.currentUser);
      setInfo("Verification email resent. Please check your inbox.");
    } catch (err: unknown) {
      if (err instanceof Error && "code" in err) {
        setError(getErrorMessage((err as { code: string }).code));
      } else {
        setError("An unexpected error occurred.");
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm rounded border bg-gray-600 p-6 shadow"
      >
        <h1 className="mb-4 text-xl font-semibold text-white">Login</h1>

        <input
          type="email"
          placeholder="Email"
          className="mb-3 w-full rounded border p-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="mb-3 w-full rounded border p-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        {info && <p className="mb-2 text-sm text-green-600">{info}</p>}

        {/* 🔹 Forgot Password Link */}
        <div className="text-right mb-3">
          <a
            href="/forgot-password"
            className="text-sm text-blue-300 hover:underline"
          >
            Forgot your password?
          </a>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mb-3 w-full rounded bg-black px-4 py-2 text-white"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <div className="mt-6 flex flex-col gap-3">
          <div className="text-center text-gray-200">or</div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded-md"
          >
            {loading ? "Checking..." : "Continue with Google"}
          </button>
        </div>

        {error?.includes("not verified") && (
          <button
            type="button"
            onClick={resendVerification}
            className="mt-3 w-full rounded border px-4 py-2 text-sm text-black hover:bg-gray-100"
          >
            Resend Verification Email
          </button>
        )}
      </form>
    </div>
  );
}
