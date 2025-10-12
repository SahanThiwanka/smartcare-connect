"use client";

import ProtectedLayout from "@/components/ProtectedLayout";
import { motion } from "framer-motion";
import { Stethoscope } from "lucide-react";

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedLayout allowedRoles={["doctor"]}>
      <div className="min-h-screen bg-gradient-to-br from-blue-950 via-gray-900 to-gray-800 text-white">
        <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Stethoscope className="w-8 h-8 text-blue-400" />
            <h1 className="text-3xl font-bold tracking-tight">
              Doctor Dashboard
            </h1>
          </div>
          <p className="text-white/60">
            Manage your patients, appointments, and clinical records.
          </p>

          {/* Animated Page Content */}
          <motion.div
            key={typeof window !== "undefined" ? window.location.pathname : "page"}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4 }}
            className="mt-6"
          >
            {children}
          </motion.div>
        </div>
      </div>
    </ProtectedLayout>
  );
}
