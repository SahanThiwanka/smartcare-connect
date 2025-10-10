"use client";

import ProtectedLayout from "@/components/ProtectedLayout";
import { motion } from "framer-motion";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedLayout allowedRoles={["admin"]}>
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white py-10 px-6">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-3xl font-bold mb-8 text-center"
        >
           Admin Control Center
        </motion.h1>
        <div className="max-w-6xl mx-auto">{children}</div>
      </div>
    </ProtectedLayout>
  );
}
