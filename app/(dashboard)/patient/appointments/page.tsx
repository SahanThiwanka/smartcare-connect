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
  Search,
  Star,
  Phone,
  Mail,
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
        return "bg-amber-500/15 text-amber-300";
      case "approved":
        return "bg-emerald-500/15 text-emerald-300";
      case "declined":
        return "bg-rose-500/15 text-rose-300";
      case "completed":
        return "bg-sky-500/15 text-sky-300";
      default:
        return "bg-white/10 text-white/70";
    }
  };

  // Doctor card component (responsive)
  const DoctorCard = ({ d }: { d: Doctor }) => {
    const isFav = favorites.includes(d.uid);
    return (
      <motion.button
        whileTap={{ scale: 0.98 }}
        className="text-left p-4 rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg hover:bg-white/20 transition"
        onClick={() => setSelectedDoctor(d)}
      >
        <div className="flex items-center gap-3 sm:gap-4">
          {d.photoURL ? (
            <Image
              src={d.photoURL}
              alt={d.name}
              width={64}
              height={64}
              className="h-14 w-14 sm:h-16 sm:w-16 rounded-full object-cover border border-white/20"
            />
          ) : (
            <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-gray-700 flex items-center justify-center text-2xl">
              👨‍⚕️
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h4 className="text-base sm:text-lg font-semibold truncate">
              {d.name}
            </h4>
            <p className="text-white/70 text-sm truncate">{d.specialty}</p>
            {d.experienceYears && (
              <p className="text-xs text-white/50">
                {d.experienceYears} years experience
              </p>
            )}
          </div>
          <span
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(d.uid);
            }}
            className={`p-2 -mr-1 rounded-full ${
              isFav ? "text-yellow-400" : "text-white/50"
            }`}
            aria-label={isFav ? "Unfavorite" : "Favorite"}
          >
            <Star className="h-5 w-5" fill={isFav ? "currentColor" : "none"} />
          </span>
        </div>
      </motion.button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 text-white py-8 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-6 sm:space-y-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6 sm:h-7 sm:w-7 text-green-400" />
            My Appointments
          </h1>
          <p className="text-white/70 mt-1 text-sm sm:text-base">
            Search, book, and manage your doctor appointments easily.
          </p>
        </motion.div>

        {/* Search Section */}
        {!selectedDoctor && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-4 sm:p-6 space-y-4"
          >
            <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
              <Search className="h-5 w-5 text-blue-400" /> Find a Doctor
            </h2>
            <input
              type="search"
              enterKeyHint="search"
              placeholder="Search by name or specialty..."
              className="w-full rounded-xl bg-black/40 border border-white/20 px-3 py-2.5 text-sm sm:text-base placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-green-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            {searchResults.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto">
                {searchResults.map((d) => (
                  <DoctorCard key={d.uid} d={d} />
                ))}
              </div>
            )}

            {favorites.length > 0 && (
              <div>
                <h3 className="text-base sm:text-lg font-semibold mt-2 sm:mt-4 mb-2 flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-400" /> Favorite Doctors
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {favorites.map((fid) => {
                    const docItem = doctorMap.get(fid);
                    if (!docItem) return null;
                    return <DoctorCard key={fid} d={docItem} />;
                  })}
                </div>
              </div>
            )}
          </motion.section>
        )}

        {/* Selected Doctor */}
        {selectedDoctor && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-4 sm:p-6 rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg space-y-4"
          >
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
              {selectedDoctor.photoURL ? (
                <Image
                  src={selectedDoctor.photoURL}
                  alt={selectedDoctor.name}
                  width={80}
                  height={80}
                  className="h-16 w-16 sm:h-20 sm:w-20 rounded-full object-cover border border-white/20"
                />
              ) : (
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-gray-700 flex items-center justify-center text-3xl">
                  👨‍⚕️
                </div>
              )}
              <div className="text-center sm:text-left">
                <h3 className="text-xl sm:text-2xl font-semibold break-words">
                  {selectedDoctor.name}
                </h3>
                <p className="text-white/70">{selectedDoctor.specialty}</p>
                {selectedDoctor.qualification && (
                  <p className="text-white/60 text-sm break-words">
                    {selectedDoctor.qualification}
                  </p>
                )}
                <div className="flex flex-wrap justify-center sm:justify-start gap-3 mt-2 text-white/70 text-sm">
                  {selectedDoctor.phone && (
                    <p className="flex items-center gap-1">
                      <Phone className="h-4 w-4" /> {selectedDoctor.phone}
                    </p>
                  )}
                  {selectedDoctor.email && (
                    <p className="flex items-center gap-1 break-all">
                      <Mail className="h-4 w-4" /> {selectedDoctor.email}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
              <button
                onClick={() => setSelectedDoctor(null)}
                className="col-span-2 sm:col-span-1 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-sm"
              >
                Change Doctor
              </button>
              <button
                onClick={() => toggleFavorite(selectedDoctor.uid)}
                className={`col-span-2 sm:col-span-1 px-4 py-2 rounded-lg text-sm font-semibold ${
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
          </motion.section>
        )}

        {/* Booking Form */}
        {selectedDoctor && (
          <motion.form
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onSubmit={onSubmit}
            className="grid gap-3 sm:gap-4 p-4 sm:p-6 rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg"
          >
            <label className="text-sm text-white/80" htmlFor="appt-date">
              Appointment date & time
            </label>
            <input
              id="appt-date"
              className="rounded-lg bg-black/40 border border-white/20 px-3 py-2.5 text-sm sm:text-base placeholder-white/50 focus:ring-2 focus:ring-green-400"
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />

            <label className="text-sm text-white/80" htmlFor="appt-reason">
              Reason
            </label>
            <textarea
              id="appt-reason"
              className="rounded-lg bg-black/40 border border-white/20 px-3 py-2.5 text-sm sm:text-base placeholder-white/50 focus:ring-2 focus:ring-green-400 min-h-[96px]"
              placeholder="Reason for appointment"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />

            {message && (
              <p className="text-sm sm:text-base text-green-400">{message}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto rounded-lg bg-green-600 hover:bg-green-500 px-4 py-2 font-semibold disabled:opacity-60"
            >
              {loading ? "Booking..." : "Book Appointment"}
            </button>
          </motion.form>
        )}

        {/* Appointments List */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4 rounded-2xl border border-white/10 bg-white/10 backdrop-blur-lg p-4 sm:p-6"
        >
          <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-blue-400" /> My Bookings
          </h2>

          {appointments.length === 0 && (
            <p className="text-white/70 text-sm sm:text-base">
              No appointments yet.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {appointments.map((a) => (
              <motion.div
                key={a.id}
                whileTap={{ scale: 0.99 }}
                className="rounded-2xl border border-white/10 bg-black/40 p-4"
              >
                <div className="space-y-1 text-sm sm:text-base">
                  <p className="break-words">
                    <b>Doctor:</b>{" "}
                    {doctorMap.get(a.doctorId)?.name || a.doctorId}
                  </p>
                  <p>
                    <b>Date:</b>{" "}
                    {a.date ? new Date(a.date).toLocaleString() : "-"}
                  </p>
                  <p className="break-words">
                    <b>Reason:</b> {a.reason}
                  </p>
                </div>

                <div className="mt-2 inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs sm:text-sm font-medium ${statusColor(a.status)}">
                  <span
                    className={`rounded-full px-2 py-0.5 ${statusColor(
                      a.status
                    )}`}
                  >
                    {a.status}
                  </span>
                </div>

                {a.status === "completed" && a.notes && (
                  <p className="mt-2 p-2 rounded-lg bg-white/10 text-xs sm:text-sm break-words">
                    <b>Doctor’s Notes:</b> {a.notes}
                  </p>
                )}

                {a.status === "completed" &&
                  a.attachments &&
                  a.attachments.length > 0 && (
                    <div className="mt-3 p-2 border border-white/10 rounded-lg bg-white/10 text-xs sm:text-sm">
                      <b>Attachments:</b>
                      <ul className="list-disc pl-5 mt-1 space-y-0.5">
                        {a.attachments.map((file) => (
                          <li key={file.fileUrl} className="break-words">
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
                    className="mt-3 w-full sm:w-auto rounded-lg bg-red-600 hover:bg-red-500 px-4 py-2 text-sm"
                  >
                    Cancel
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        </motion.section>
      </div>
    </div>
  );
}
