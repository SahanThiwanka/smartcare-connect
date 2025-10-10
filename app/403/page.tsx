"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-md text-center p-8 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md shadow-2xl space-y-6"
      >
        <div className="flex justify-center">
          <ShieldAlert className="w-12 h-12 text-red-500 animate-pulse" />
        </div>

        <h1 className="text-3xl font-bold text-red-400">403 – Unauthorized</h1>

        <p className="text-gray-300 text-sm leading-relaxed">
          You don’t have permission to access this page.  
          Please log in with an authorized account or return to the home page.
        </p>

        <div className="pt-4">
          <Link
            href="/"
            className="inline-block rounded-lg bg-blue-500 hover:bg-blue-600 px-5 py-2.5 font-medium text-white transition"
          >
            Go Home
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
