"use client";
import { motion } from "framer-motion";
import Link from "next/link";

export default function AwaitingApprovalPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="text-center space-y-6 p-8 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md shadow-2xl max-w-md"
      >
        <h1 className="text-3xl font-bold text-blue-400">
          Awaiting Approval
        </h1>

        <p className="text-gray-300 text-sm leading-relaxed">
          Your doctor account is currently under review.  
          Once the admin verifies your profile, you’ll receive an email
          notification and be able to access your dashboard.
        </p>

        <div className="pt-4">
          <Link
            href="/login"
            className="inline-block rounded-lg bg-blue-500 hover:bg-blue-600 px-5 py-2.5 font-medium text-white transition"
          >
            Back to Login
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
