"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import {
  doc,
  setDoc,
  getDocs,
  collection,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type DailyMeasure = {
  date: string;
  pressure?: string;
  cholesterol?: string;
  sugar?: string;
  spo2?: string;
  exerciseTime?: string;
  temperature?: string;
  weight?: string;
};

export default function DailyMeasurePage() {
  const { user } = useAuth();
  const [form, setForm] = useState<DailyMeasure>({
    date: new Date().toISOString().split("T")[0],
  });
  const [records, setRecords] = useState<DailyMeasure[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const inputFields = useMemo(
    () => [
      { name: "pressure", label: "Blood Pressure (mmHg)" },
      { name: "cholesterol", label: "Cholesterol (mg/dL)" },
      { name: "sugar", label: "Sugar (mg/dL)" },
      { name: "spo2", label: "SpO₂ (%)" },
      { name: "exerciseTime", label: "Exercise Time (mins)" },
      { name: "temperature", label: "Temperature (°C)" },
      { name: "weight", label: "Weight (kg)" },
    ],
    []
  );

  const loadRecords = useCallback(async () => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "dailyMeasures"),
      orderBy("date", "desc")
    );
    const snap = await getDocs(q);
    const data = snap.docs.map((d) => d.data() as DailyMeasure);
    setRecords(data.slice(0, 10));
  }, [user]);

  useEffect(() => {
    if (user) loadRecords();
  }, [user, loadRecords]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    setMsg(null);
    try {
      const ref = doc(
        db,
        "users",
        user.uid,
        "dailyMeasures",
        form.date || new Date().toISOString().split("T")[0]
      );
      await setDoc(ref, {
        ...form,
        createdAt: Timestamp.now(),
      });
      await loadRecords();
      setMsg("✅ Saved successfully!");
    } catch (err) {
      console.error(err);
      setMsg("❌ Failed to save, please try again.");
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(null), 4000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 text-white py-10 px-5">
      <div className="max-w-5xl mx-auto space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold">🩺 Daily Health Measurements</h1>
          <p className="text-white/70 mt-1">
            Track your daily vitals and visualize health trends.
          </p>
        </motion.div>

        {/* Form Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-6"
        >
          <div className="grid gap-4 md:grid-cols-3">
            {inputFields.map((f) => (
              <input
                key={f.name}
                name={f.name}
                placeholder={f.label}
                value={form[f.name as keyof DailyMeasure] || ""}
                onChange={handleChange}
                className="rounded-xl border border-white/10 bg-black/40 p-2 focus:ring-2 focus:ring-green-400/50"
              />
            ))}

            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              className="rounded-xl border border-white/10 bg-black/40 p-2 focus:ring-2 focus:ring-green-400/50"
            />
          </div>

          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={handleSave}
              disabled={loading}
              className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-xl font-semibold"
            >
              {loading ? "Saving..." : "Save Measurement"}
            </button>

            {msg && (
              <span
                className={`text-sm ${
                  msg.startsWith("✅") ? "text-green-400" : "text-red-400"
                }`}
              >
                {msg}
              </span>
            )}
          </div>
        </motion.div>

        {/* Charts */}
        {records.length > 0 && (
          <div className="space-y-8">
            <h2 className="text-xl font-semibold">📊 Health Trends</h2>

            {[
              { key: "pressure", label: "Blood Pressure", color: "#60A5FA" },
              { key: "sugar", label: "Blood Sugar", color: "#FB7185" },
              { key: "weight", label: "Weight", color: "#34D399" },
            ].map((chart) => (
              <motion.div
                key={chart.key}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-4"
              >
                <h3 className="font-medium mb-2 text-white/90">
                  {chart.label}
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={records.slice().reverse()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis dataKey="date" stroke="#aaa" />
                    <YAxis stroke="#aaa" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#222",
                        border: "1px solid #555",
                        color: "white",
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey={chart.key}
                      stroke={chart.color}
                      name={chart.label}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </motion.div>
            ))}
          </div>
        )}

        {/* Recent Records */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h2 className="text-xl font-semibold mb-3">🗓 Recent Records</h2>
          <div className="grid gap-3">
            {records.map((r) => (
              <div
                key={r.date}
                className="rounded-xl border border-white/10 bg-black/30 backdrop-blur-sm p-3 text-sm hover:bg-white/5 transition"
              >
                <b>{r.date}</b> — Pressure: {r.pressure || "-"}, Sugar:{" "}
                {r.sugar || "-"}, Weight: {r.weight || "-"}kg
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
