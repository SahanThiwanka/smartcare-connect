"use client";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { logout } from "@/lib/auth";

export default function Navbar() {
  const { user, role, profileCompleted, approved, loading } = useAuth();

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
            {/* Patient */}
            {role === "patient" && (
              <>
                {!profileCompleted ? (
                  <Link href="/setup-profile">Complete Profile</Link>
                ) : (
                  <>
                    <Link href="/patient/dashboard">Dashboard</Link>
                    <Link href="/patient/profile">Profile</Link>
                    <Link href="/patient/daily-measure">Daily-measure</Link>
                    <Link href="/patient/appointments">Appointments</Link>
                    <Link href="/patient/records">Records</Link>
                    <Link href="/patient/history">History</Link>
                  </>
                )}
              </>
            )}

            {/* Doctor */}
            {role === "doctor" && (
              <>
                {!profileCompleted ? (
                  <Link href="/setup-profile">Complete Profile</Link>
                ) : approved === false ? (
                  <span className="text-yellow-400">Awaiting Approval</span>
                ) : (
                  <>
                    <Link href="/doctor/dashboard">Dashboard</Link>
                    <Link href="/doctor/profile">Profile</Link>
                    <Link href="/doctor/patients">Patients</Link>
                    <Link href="/doctor/appointments">Appointments</Link>
                  </>
                )}
              </>
            )}

            {/* Admin */}
            {role === "admin" && (
              <>
                <Link href="/admin">Dashboard</Link>
                <Link href="/admin/doctors">Approve Doctors</Link>
                <Link href="/admin/users">User Management</Link>
              </>
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
