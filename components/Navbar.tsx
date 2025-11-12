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
                    <NavLink href="/setup-profile">Complete Profile</NavLink>
                  ) : (
                    <>
                      <NavLink href="/patient/dashboard">Dashboard</NavLink>
                      <NavLink href="/patient/profile">Profile</NavLink>
                      <NavLink href="/patient/daily-measure">Daily Measure</NavLink>
                      <NavLink href="/patient/appointments">Appointments</NavLink>
                      <NavLink href="/patient/records">Records</NavLink>
                      <NavLink href="/patient/history">History</NavLink>
                      <NavLink href="/patient/copilot">Copilot</NavLink>
                      {/* Optional: Caregiver access pages for patients */}
                      <NavLink href="/patient/caregiver">Caregivers</NavLink>
                    </>
                  )}
                </>
              )}

              {/* DOCTOR */}
              {role === "doctor" && (
                <>
                  {!profileCompleted ? (
                    <NavLink href="/setup-profile">Complete Profile</NavLink>
                  ) : approved === false ? (
                    <span className="text-yellow-400">Awaiting Approval</span>
                  ) : (
                    <>
                      <NavLink href="/doctor/dashboard">Dashboard</NavLink>
                      <NavLink href="/doctor/profile">Profile</NavLink>
                      <NavLink href="/doctor/patients">Patients</NavLink>
                      <NavLink href="/doctor/appointments">Appointments</NavLink>
                    </>
                  )}
                </>
              )}

              {/* CAREGIVER */}
              {role === "caregiver" && (
                <>
                  {!profileCompleted ? (
                    <NavLink href="/setup-profile">Complete Profile</NavLink>
                  ) : (
                    <>
                      <NavLink href="/caregiver/dashboard">Dashboard</NavLink>
                      <NavLink href="/caregiver/profile">Profile</NavLink>
                      {/* Patients who have granted access / pending requests */}
                      <NavLink href="/caregiver/requests">Requests</NavLink>
                      <NavLink href="/caregiver/patients">My Patients</NavLink>
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
              <NavLink href="/caregiver/register">Caregiver Register</NavLink>
              <NavLink href="/login">Login</NavLink>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={toggleMenu}
          className="md:hidden p-2 rounded hover:bg-white/10 transition"
          aria-label="Toggle menu"
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
                      <MobileLink href="/setup-profile">Complete Profile</MobileLink>
                    ) : (
                      <>
                        <MobileLink href="/patient/dashboard">Dashboard</MobileLink>
                        <MobileLink href="/patient/profile">Profile</MobileLink>
                        <MobileLink href="/patient/daily-measure">Daily Measure</MobileLink>
                        <MobileLink href="/patient/appointments">Appointments</MobileLink>
                        <MobileLink href="/patient/records">Records</MobileLink>
                        <MobileLink href="/patient/history">History</MobileLink>
                        <MobileLink href="/patient/copilot">Copilot</MobileLink>
                        <MobileLink href="/patient/caregiver">Caregivers</MobileLink>
                      </>
                    )}
                  </>
                )}

                {role === "doctor" && (
                  <>
                    {!profileCompleted ? (
                      <MobileLink href="/setup-profile">Complete Profile</MobileLink>
                    ) : approved === false ? (
                      <span className="text-yellow-400">Awaiting Approval</span>
                    ) : (
                      <>
                        <MobileLink href="/doctor/dashboard">Dashboard</MobileLink>
                        <MobileLink href="/doctor/profile">Profile</MobileLink>
                        <MobileLink href="/doctor/patients">Patients</MobileLink>
                        <MobileLink href="/doctor/appointments">Appointments</MobileLink>
                      </>
                    )}
                  </>
                )}

                {role === "caregiver" && (
                  <>
                    {!profileCompleted ? (
                      <MobileLink href="/setup-profile">Complete Profile</MobileLink>
                    ) : (
                      <>
                        <MobileLink href="/caregiver/dashboard">Dashboard</MobileLink>
                        <MobileLink href="/caregiver/profile">Profile</MobileLink>
                        <MobileLink href="/caregiver/requests">Requests</MobileLink>
                        <MobileLink href="/caregiver/patients">My Patients</MobileLink>
                      </>
                    )}
                  </>
                )}

                {role === "admin" && (
                  <>
                    <MobileLink href="/admin">Dashboard</MobileLink>
                    <MobileLink href="/admin/doctors">Approve Doctors</MobileLink>
                    <MobileLink href="/admin/users">User Management</MobileLink>
                  </>
                )}

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className="mt-2 rounded-md border border-white/20 px-3 py-1.5 hover:bg-white/10 transition text-left"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <MobileLink href="/patient/register">Patient Register</MobileLink>
                <MobileLink href="/doctor/register">Doctor Register</MobileLink>
                <MobileLink href="/caregiver/register">Caregiver Register</MobileLink>
                <MobileLink href="/login">Login</MobileLink>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/* ============ Small link helpers ============ */

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <motion.div whileHover={{ scale: 1.05 }} className="relative group">
      <Link href={href} className="hover:text-blue-400 transition">
        {children}
      </Link>
      <span className="absolute bottom-0 left-0 w-0 group-hover:w-full h-0.5 bg-blue-400 transition-all duration-300" />
    </motion.div>
  );
}

function MobileLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-2 py-2 hover:bg-white/10 transition"
      onClick={() => {
        // No-op here; parent closes the menu on logout only.
      }}
    >
      {children}
    </Link>
  );
}
