"use client";
import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, HeartPulse } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { logout } from "@/lib/auth";

export default function Navbar() {
  const { user, role, profileCompleted, approved, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-lg bg-black/40 border-b border-white/10 text-white">
      <nav className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 font-extrabold text-xl tracking-tight"
        >
          <HeartPulse className="w-6 h-6 text-blue-400 animate-pulse" />
          SmartCare
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium">
          {loading ? (
            <div className="text-gray-400">Loading...</div>
          ) : user ? (
            <>
              {/* PATIENT */}
              {role === "patient" && (
                <>
                  {!profileCompleted ? (
                    <Link href="/setup-profile" className="hover:text-blue-400">
                      Complete Profile
                    </Link>
                  ) : (
                    <>
                      <NavLink href="/patient/dashboard">Dashboard</NavLink>
                      <NavLink href="/patient/profile">Profile</NavLink>
                      <NavLink href="/patient/daily-measure">
                        Daily Measure
                      </NavLink>
                      <NavLink href="/patient/appointments">
                        Appointments
                      </NavLink>
                      <NavLink href="/patient/records">Records</NavLink>
                      <NavLink href="/patient/history">History</NavLink>
                    </>
                  )}
                </>
              )}

              {/* DOCTOR */}
              {role === "doctor" && (
                <>
                  {!profileCompleted ? (
                    <Link
                      href="/setup-profile"
                      className="hover:text-green-400"
                    >
                      Complete Profile
                    </Link>
                  ) : approved === false ? (
                    <span className="text-yellow-400">Awaiting Approval</span>
                  ) : (
                    <>
                      <NavLink href="/doctor/dashboard">Dashboard</NavLink>
                      <NavLink href="/doctor/profile">Profile</NavLink>
                      <NavLink href="/doctor/patients">Patients</NavLink>
                      <NavLink href="/doctor/appointments">
                        Appointments
                      </NavLink>
                    </>
                  )}
                </>
              )}

              {/* ADMIN */}
              {role === "admin" && (
                <>
                  <NavLink href="/admin">Dashboard</NavLink>
                  <NavLink href="/admin/doctors">Approve Doctors</NavLink>
                  <NavLink href="/admin/users">User Management</NavLink>
                </>
              )}

              <button
                onClick={logout}
                className="rounded-md border border-white/20 hover:border-white/40 px-3 py-1.5 hover:bg-white/10 transition"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink href="/patient/register">Patient Register</NavLink>
              <NavLink href="/doctor/register">Doctor Register</NavLink>
              <NavLink href="/login">Login</NavLink>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={toggleMenu}
          className="md:hidden p-2 rounded hover:bg-white/10 transition"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/* Mobile Dropdown Menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="md:hidden bg-black/90 border-t border-white/10 px-6 py-4 flex flex-col gap-3 text-sm"
          >
            {loading ? (
              <div className="text-gray-400">Loading...</div>
            ) : user ? (
              <>
                {role === "patient" && (
                  <>
                    {!profileCompleted ? (
                      <Link href="/setup-profile">Complete Profile</Link>
                    ) : (
                      <>
                        <Link href="/patient/dashboard">Dashboard</Link>
                        <Link href="/patient/profile">Profile</Link>
                        <Link href="/patient/daily-measure">Daily Measure</Link>
                        <Link href="/patient/appointments">Appointments</Link>
                        <Link href="/patient/records">Records</Link>
                        <Link href="/patient/history">History</Link>
                      </>
                    )}
                  </>
                )}

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

                {role === "admin" && (
                  <>
                    <Link href="/admin">Dashboard</Link>
                    <Link href="/admin/doctors">Approve Doctors</Link>
                    <Link href="/admin/users">User Management</Link>
                  </>
                )}

                <button
                  onClick={logout}
                  className="mt-2 rounded-md border border-white/20 px-3 py-1.5 hover:bg-white/10 transition"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/patient/register">Patient Register</Link>
                <Link href="/doctor/register">Doctor Register</Link>
                <Link href="/login">Login</Link>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

// 🔹 Reusable NavLink with underline animation
function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div whileHover={{ scale: 1.05 }} className="relative group">
      <Link href={href} className="hover:text-blue-400 transition">
        {children}
      </Link>
      <span className="absolute bottom-0 left-0 w-0 group-hover:w-full h-0.5 bg-blue-400 transition-all duration-300" />
    </motion.div>
  );
}
