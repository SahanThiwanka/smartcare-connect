"use client";

import { useState, useEffect } from "react";
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

  useEffect(() => {
    if (user) loadRecords();
  }, [user]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSave() {
    if (!user) return;
    setLoading(true);
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
    setLoading(false);
    alert("Daily health data saved!");
  }

  async function loadRecords() {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "dailyMeasures"),
      orderBy("date", "desc")
    );
    const snap = await getDocs(q);
    const data = snap.docs.map((d) => d.data() as DailyMeasure);
    setRecords(data.slice(0, 10)); // show latest 10
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold mb-4">🩺 Daily Health Measurements</h1>

      {/* Form */}
      <div className="grid gap-4 md:grid-cols-3 bg-black p-4 rounded text-white">
        {[
          { name: "pressure", label: "Blood Pressure (mmHg)" },
          { name: "cholesterol", label: "Cholesterol (mg/dL)" },
          { name: "sugar", label: "Sugar (mg/dL)" },
          { name: "spo2", label: "SpO₂ (%)" },
          { name: "exerciseTime", label: "Exercise Time (mins)" },
          { name: "temperature", label: "Temperature (°C)" },
          { name: "weight", label: "Weight (kg)" },
        ].map((f) => (
          <input
            key={f.name}
            name={f.name}
            placeholder={f.label}
            value={(form as any)[f.name] || ""}
            onChange={handleChange}
            className="rounded border p-2 text-white"
          />
        ))}

        <input
          type="date"
          name="date"
          value={form.date}
          onChange={handleChange}
          className="rounded border p-2 text-white"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={loading}
        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
      >
        {loading ? "Saving..." : "Save Measurement"}
      </button>

      {/* Chart Section */}
      {records.length > 0 && (
        <div className="space-y-8 mt-8">
          <h2 className="text-xl font-semibold">📊 Health Trends</h2>

          {/* Blood Pressure Chart */}
          <div className="bg-white p-4 rounded shadow text-black">
            <h3 className="font-medium mb-2">Blood Pressure</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={records.slice().reverse()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="pressure"
                  stroke="#1E90FF"
                  name="Pressure"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Blood Sugar Chart */}
          <div className="bg-white p-4 rounded shadow text-black">
            <h3 className="font-medium mb-2">Blood Sugar</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={records.slice().reverse()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="sugar"
                  stroke="#FF6347"
                  name="Sugar"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Weight Chart */}
          <div className="bg-white p-4 rounded shadow text-black">
            <h3 className="font-medium mb-2">Weight</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={records.slice().reverse()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="#32CD32"
                  name="Weight"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent Records */}
      <div className="mt-10">
        <h2 className="text-xl font-semibold mb-3">🗓 Recent Records</h2>
        <div className="grid gap-3">
          {records.map((r) => (
            <div
              key={r.date}
              className="border rounded p-3 bg-gray-700 shadow-sm text-sm"
            >
              <b>{r.date}</b> — Pressure: {r.pressure || "-"}, Sugar:{" "}
              {r.sugar || "-"}, Weight: {r.weight || "-"}kg
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
