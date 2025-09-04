// components/Navbar.tsx
"use client";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { logout } from "@/lib/auth";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function Navbar() {
  const { user, role, loading } = useAuth();
  const [profileCompleted, setProfileCompleted] = useState<boolean | null>(
    null
  );

  // fetch profile completion status once user is ready
  useEffect(() => {
    async function fetchProfile() {
      if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          setProfileCompleted(snap.data().profileCompleted || false);
        }
      } else {
        setProfileCompleted(null);
      }
    }
    if (!loading) fetchProfile();
  }, [user, loading]);

  return (
    <header className="w-full border-b bg-black text-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between p-4">
        <Link href="/" className="text-xl font-bold">
          SmartCare Connect
        </Link>

        {loading ? (
          <div className="text-sm text-gray-400">Loading...</div>
        ) : user ? (
          <div className="flex items-center gap-4">
            {/* ✅ Only show dashboard links if profile is complete */}
            {profileCompleted && role === "patient" && (
              <>
                <Link href="/patient/profile">Profile</Link>
                <Link href="/patient/appointments">Appointments</Link>
                <Link href="/patient/records">Records</Link>
                <Link href="/patient/history">History</Link>
              </>
            )}
            {profileCompleted && role === "doctor" && (
              <>
                <Link href="/doctor/profile">Profile</Link>
                <Link href="/doctor/patients">Patients</Link>
                <Link href="/doctor/appointments">Appointments</Link>
              </>
            )}
            {role === "admin" && (
              <>
                <Link href="/admin">Dashboard</Link>
                <Link href="/admin/doctors">Approve Doctors</Link>
              </>
            )}

            {/* If profile not completed yet */}
            {user && role !== "admin" && profileCompleted === false && (
              <Link href="/setup-profile">Complete Profile</Link>
            )}

            <button
              onClick={() => logout()}
              className="rounded-md border border-white px-3 py-1 text-sm hover:bg-gray-800"
            >
              Logout
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4 text-sm">
            <Link href="/patient/register">Patient Register</Link>
            <span className="text-gray-400">|</span>
            <Link href="/doctor/register">Doctor Register</Link>
            <span className="text-gray-400">|</span>
            <Link href="/login">Login</Link>
          </div>
        )}
      </nav>
    </header>
  );
}
