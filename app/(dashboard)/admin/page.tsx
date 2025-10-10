"use client";
import { useEffect, useState } from "react";
import {
  subscribeAdminStats,
  subscribeAppointmentTrends,
  subscribeUserGrowth,
} from "@/lib/adminStats";
import ProtectedLayout from "@/components/ProtectedLayout";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import {
  Users,
  Stethoscope,
  ClipboardList,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { motion } from "framer-motion";
import CountUp from "react-countup";

interface AdminStats {
  totalPatients: number;
  totalDoctors: number;
  approvedDoctors: number;
  pendingDoctors: number;
  pendingApps: number;
  approvedApps: number;
  completedApps: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [appointmentData, setAppointmentData] = useState<any[]>([]);
  const [userGrowthData, setUserGrowthData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubStats = subscribeAdminStats((data) => {
      setStats(data);
      setLoading(false);
    });
    const unsubTrends = subscribeAppointmentTrends(setAppointmentData);
    const unsubUsers = subscribeUserGrowth(setUserGrowthData);
    return () => {
      unsubStats();
      unsubTrends();
      unsubUsers();
    };
  }, []);

  const StatCard = ({
    title,
    value,
    icon: Icon,
    color,
  }: {
    title: string;
    value: number;
    icon: any;
    color: string;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white shadow-lg backdrop-blur-md"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-xl ${color} bg-opacity-20`}>
          <Icon className="h-6 w-6" />
        </div>
        <span className="text-2xl font-bold">
          <CountUp end={value || 0} duration={1.5} separator="," />
        </span>
      </div>
      <h3 className="text-sm text-white/70">{title}</h3>
    </motion.div>
  );

  const SkeletonCard = () => (
    <div className="animate-pulse rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="flex justify-between mb-4">
        <div className="h-6 w-6 bg-gray-700 rounded"></div>
        <div className="h-6 w-16 bg-gray-700 rounded"></div>
      </div>
      <div className="h-3 w-24 bg-gray-700 rounded"></div>
    </div>
  );

  const safeAppointmentData = appointmentData.length
    ? appointmentData
    : [{ month: "N/A", pending: 0, approved: 0, completed: 0 }];

  const safeUserGrowthData = userGrowthData.length
    ? userGrowthData
    : [{ month: "N/A", doctors: 0, patients: 0 }];

  return (
    <ProtectedLayout allowedRoles={["admin"]}>
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white py-10 px-6">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold mb-8 text-center"
        >
          🩺 SmartCare Admin Analytics Dashboard
        </motion.h1>

        {loading && (
          <p className="text-center text-gray-400 animate-pulse">
            Loading live analytics...
          </p>
        )}

        {stats ? (
          <div className="max-w-6xl mx-auto space-y-12">
            {/* Stat Cards */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <StatCard
                title="Total Patients"
                value={stats.totalPatients}
                icon={Users}
                color="text-blue-400"
              />
              <StatCard
                title="Total Doctors"
                value={stats.totalDoctors}
                icon={Stethoscope}
                color="text-green-400"
              />
              <StatCard
                title="Approved Doctors"
                value={stats.approvedDoctors}
                icon={CheckCircle2}
                color="text-emerald-400"
              />
              <StatCard
                title="Pending Doctors"
                value={stats.pendingDoctors}
                icon={Clock}
                color="text-yellow-400"
              />
              <StatCard
                title="Pending Appointments"
                value={stats.pendingApps}
                icon={ClipboardList}
                color="text-yellow-300"
              />
              <StatCard
                title="Completed Appointments"
                value={stats.completedApps}
                icon={CheckCircle2}
                color="text-emerald-400"
              />
            </div>

            {/* Charts Section */}
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Appointments Overview */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur-md">
                <h2 className="text-lg font-semibold mb-4">
                  📊 Appointments Overview
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={safeAppointmentData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis dataKey="month" stroke="#bbb" />
                    <YAxis stroke="#bbb" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#111",
                        border: "1px solid #333",
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="pending"
                      stroke="#facc15"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="approved"
                      stroke="#60a5fa"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="completed"
                      stroke="#34d399"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* User Growth */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg backdrop-blur-md">
                <h2 className="text-lg font-semibold mb-4">📈 User Growth</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={safeUserGrowthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis dataKey="month" stroke="#bbb" />
                    <YAxis stroke="#bbb" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#111",
                        border: "1px solid #333",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="doctors" fill="#60a5fa" name="Doctors" />
                    <Bar dataKey="patients" fill="#34d399" name="Patients" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto mt-8">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
