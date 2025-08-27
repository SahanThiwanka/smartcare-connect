// components/Navbar.tsx
"use client";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { logout } from "@/lib/auth";

export default function Navbar() {
  const { user, role, loading } = useAuth();

  return (
    <header className="w-full border-b bg-black">
      <nav className="mx-auto flex max-w-6xl items-center justify-between p-4">
        <Link href="/" className="text-xl font-bold">
          SmartCare Connect
        </Link>

        {loading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : user ? (
          <div className="flex items-center gap-4">
            {role === "patient" && (
              <>
                <Link href="/patient/profile">Profile</Link>
                <Link href="/patient/appointments">Appointments</Link>
                <Link href="/patient/records">Records</Link>
              </>
            )}
            {role === "doctor" && (
              <>
                <Link href="/doctor/profile">Profile</Link>
                <Link href="/doctor/patients">Patients</Link>
                <Link href="/doctor/appointments">Appointments</Link>
              </>
            )}
            {role === "admin" && (
              <>
                <Link href="/admin/doctors">Approve Doctors</Link>
              </>
            )}
            <button
              onClick={() => logout()}
              className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50"
            >
              Logout
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4 text-sm">
            <Link href="/patient/register">Patient Register</Link>
            <Link href="/patient/login">Patient Login</Link>
            <span className="text-gray-300">|</span>
            <Link href="/doctor/register">Doctor Register</Link>
            <Link href="/doctor/login">Doctor Login</Link>
          </div>
        )}
      </nav>
    </header>
  );
}
