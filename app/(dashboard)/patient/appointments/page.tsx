"use client";

import { useEffect, useState, useMemo, FormEvent } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import {
  createAppointment,
  getAppointmentsByPatient,
  cancelAppointment,
  Appointment,
} from "@/lib/appointments";
import { getApprovedDoctors, Doctor } from "@/lib/doctors";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import Image from "next/image";
import {
  CalendarDays,
  User,
  Search,
  Star,
  Clock,
  Stethoscope,
  Mail,
  Phone,
  ClipboardList,
} from "lucide-react";

export default function PatientAppointmentsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Load appointments & favorites
  useEffect(() => {
    if (!user) return;
    (async () => {
      const apps = await getAppointmentsByPatient(user.uid);
      setAppointments(apps);

      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const data = snap.data() as { favorites?: string[] };
        setFavorites(data.favorites || []);
      }
    })();
  }, [user]);

  // Load approved doctors
  useEffect(() => {
    (async () => {
      const docs = await getApprovedDoctors();
      setDoctors(docs);
    })();
  }, []);

  // Map doctors by UID
  const doctorMap = useMemo(() => {
    const m = new Map<string, Doctor>();
    doctors.forEach((d) => m.set(d.uid, d));
    return m;
  }, [doctors]);

  // Search doctors
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    const lower = searchTerm.toLowerCase();
    const results = doctors.filter(
      (d) =>
        d.name.toLowerCase().includes(lower) ||
        d.specialty.toLowerCase().includes(lower)
    );
    setSearchResults(results);
  }, [searchTerm, doctors]);

  // Toggle favorite doctor
  const toggleFavorite = async (doctorId: string) => {
    if (!user) return;
    const newFavs = favorites.includes(doctorId)
      ? favorites.filter((id) => id !== doctorId)
      : [...favorites, doctorId];
    setFavorites(newFavs);
    await updateDoc(doc(db, "users", user.uid), { favorites: newFavs });
  };

  const refreshAppointments = async () => {
    if (!user) return;
    const apps = await getAppointmentsByPatient(user.uid);
    setAppointments(apps);
  };

  // Submit new appointment
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!selectedDoctor || !date || !reason.trim()) {
      setMessage("⚠️ Please select a doctor, date, and reason.");
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      await createAppointment({
        patientId: user.uid,
        doctorId: selectedDoctor.uid,
        date,
        reason,
        status: "pending",
        createdAt: Date.now(),
      });
      setSelectedDoctor(null);
      setDate("");
      setReason("");
      await refreshAppointments();
      setMessage("✅ Appointment booked successfully!");
    } catch (err) {
      console.error(err);
      setMessage("❌ Failed to book appointment.");
    } finally {
      setLoading(false);
    }
  };

  // Cancel appointment
  const handleCancel = async (id: string) => {
    if (!confirm("Cancel this appointment?")) return;
    await cancelAppointment(id);
    await refreshAppointments();
  };

  const statusColor = (status: Appointment["status"]) => {
    switch (status) {
      case "pending":
        return "text-yellow-400";
      case "approved":
        return "text-green-400";
      case "declined":
        return "text-red-400";
      case "completed":
        return "text-blue-400";
      default:
        return "text-gray-400";
    }
  };

  // Doctor card component
  const DoctorCard = ({ d }: { d: Doctor }) => {
    const isFav = favorites.includes(d.uid);
    return (
      <motion.div
        whileHover={{ scale: 1.03 }}
        className="p-4 rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg hover:bg-white/20 transition cursor-pointer"
        onClick={() => setSelectedDoctor(d)}
      >
        <div className="flex items-center gap-4">
          {d.photoURL ? (
            <Image
              src={d.photoURL}
              alt={d.name}
              width={64}
              height={64}
              className="rounded-full object-cover border border-white/20"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-2xl">
              👨‍⚕️
            </div>
          )}
          <div className="flex-1">
            <h4 className="text-lg font-semibold">{d.name}</h4>
            <p className="text-white/70 text-sm">{d.specialty}</p>
            {d.experienceYears && (
              <p className="text-xs text-white/50">
                {d.experienceYears} years experience
              </p>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(d.uid);
            }}
            className={`text-xl ${
              isFav ? "text-yellow-400" : "text-white/40"
            } hover:scale-110`}
          >
            <Star fill={isFav ? "currentColor" : "none"} />
          </button>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 text-white py-10 px-6">
      <div className="max-w-5xl mx-auto space-y-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CalendarDays className="h-7 w-7 text-green-400" />
            My Appointments
          </h1>
          <p className="text-white/70 mt-1">
            Search, book, and manage your doctor appointments easily.
          </p>
        </motion.div>

        {/* Search Section */}
        {!selectedDoctor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-6 space-y-4"
          >
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Search className="h-5 w-5 text-blue-400" /> Find a Doctor
            </h2>
            <input
              type="text"
              placeholder="Search by name or specialty..."
              className="w-full rounded-lg bg-black/40 border border-white/20 p-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-green-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            {searchResults.length > 0 && (
              <div className="grid gap-3 max-h-80 overflow-y-auto">
                {searchResults.map((d) => (
                  <DoctorCard key={d.uid} d={d} />
                ))}
              </div>
            )}

            {favorites.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mt-4 mb-2 flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-400" /> Favorite Doctors
                </h3>
                <div className="grid gap-3">
                  {favorites.map((fid) => {
                    const doc = doctorMap.get(fid);
                    if (!doc) return null;
                    return <DoctorCard key={fid} d={doc} />;
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Selected Doctor */}
        {selectedDoctor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-6 rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg space-y-4"
          >
            <div className="flex items-center gap-4">
              {selectedDoctor.photoURL ? (
                <Image
                  src={selectedDoctor.photoURL}
                  alt={selectedDoctor.name}
                  width={80}
                  height={80}
                  className="rounded-full object-cover border border-white/20"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center text-3xl">
                  👨‍⚕️
                </div>
              )}
              <div>
                <h3 className="text-2xl font-semibold">
                  {selectedDoctor.name}
                </h3>
                <p className="text-white/70">{selectedDoctor.specialty}</p>
                {selectedDoctor.qualification && (
                  <p className="text-white/60 text-sm">
                    {selectedDoctor.qualification}
                  </p>
                )}
                <div className="flex gap-3 mt-2 text-white/60 text-sm">
                  {selectedDoctor.phone && (
                    <p className="flex items-center gap-1">
                      <Phone className="h-4 w-4" /> {selectedDoctor.phone}
                    </p>
                  )}
                  {selectedDoctor.email && (
                    <p className="flex items-center gap-1">
                      <Mail className="h-4 w-4" /> {selectedDoctor.email}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedDoctor(null)}
                className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm"
              >
                Change Doctor
              </button>
              <button
                onClick={() => toggleFavorite(selectedDoctor.uid)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  favorites.includes(selectedDoctor.uid)
                    ? "bg-yellow-400 text-black"
                    : "bg-gray-600 text-white hover:bg-gray-500"
                }`}
              >
                {favorites.includes(selectedDoctor.uid)
                  ? "★ Unfavorite"
                  : "☆ Favorite"}
              </button>
            </div>
          </motion.div>
        )}

        {/* Booking Form */}
        {selectedDoctor && (
          <motion.form
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onSubmit={onSubmit}
            className="grid gap-4 p-6 rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg"
          >
            <input
              className="rounded-lg bg-black/40 border border-white/20 p-3 text-white placeholder-white/50 focus:ring-2 focus:ring-green-400"
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />

            <textarea
              className="rounded-lg bg-black/40 border border-white/20 p-3 text-white placeholder-white/50 focus:ring-2 focus:ring-green-400"
              placeholder="Reason for appointment"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />

            {message && <p className="text-sm text-green-400">{message}</p>}

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-green-600 hover:bg-green-500 px-4 py-2 font-semibold"
            >
              {loading ? "Booking..." : "Book Appointment"}
            </button>
          </motion.form>
        )}

        {/* Appointments List */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4 rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-6"
        >
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-blue-400" /> My Bookings
          </h2>

          {appointments.length === 0 && (
            <p className="text-white/70">No appointments yet.</p>
          )}

          {appointments.map((a) => (
            <motion.div
              key={a.id}
              whileHover={{ scale: 1.02 }}
              className="rounded-xl border border-white/10 bg-black/40 p-4"
            >
              <p>
                <b>Doctor:</b> {doctorMap.get(a.doctorId)?.name || a.doctorId}
              </p>
              <p>
                <b>Date:</b> {a.date ? new Date(a.date).toLocaleString() : "-"}
              </p>
              <p>
                <b>Reason:</b> {a.reason}
              </p>
              <p className={statusColor(a.status)}>
                <b>Status:</b> {a.status}
              </p>

              {a.status === "completed" && a.notes && (
                <p className="mt-2 p-2 rounded-lg bg-white/10 text-sm">
                  <b>Doctor’s Notes:</b> {a.notes}
                </p>
              )}

              {a.status === "completed" &&
                a.attachments &&
                a.attachments.length > 0 && (
                  <div className="mt-3 p-2 border border-white/10 rounded-lg bg-white/10 text-sm">
                    <b>Attachments:</b>
                    <ul className="list-disc pl-6 mt-1">
                      {a.attachments.map((file) => (
                        <li key={file.fileUrl}>
                          <a
                            href={file.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline"
                          >
                            {file.fileName}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {a.status === "pending" && (
                <button
                  onClick={() => handleCancel(a.id!)}
                  className="mt-3 rounded-lg bg-red-600 hover:bg-red-500 px-4 py-1 text-sm"
                >
                  Cancel
                </button>
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
