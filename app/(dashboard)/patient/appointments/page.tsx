"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  Clock3,
  Heart,
  HeartOff,
  Search,
  Stethoscope,
  UploadCloud,
  X,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

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

/* ----------------------------- helpers & types ---------------------------- */

type UserDoc = { favorites?: string[] };

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function statusChip(status: Appointment["status"]): {
  label: string;
  cn: string;
} {
  switch (status) {
    case "pending":
      return {
        label: "Pending",
        cn: "bg-yellow-500/15 text-yellow-300 border-yellow-400/30",
      };
    case "approved":
      return {
        label: "Approved",
        cn: "bg-blue-500/15 text-blue-300 border-blue-400/30",
      };
    case "declined":
      return {
        label: "Declined",
        cn: "bg-red-500/15 text-red-300 border-red-400/30",
      };
    case "completed":
      return {
        label: "Completed",
        cn: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
      };
    default:
      return {
        label: status,
        cn: "bg-gray-500/15 text-gray-300 border-gray-400/30",
      };
  }
}

function isFuture(d?: string | number | Date | null) {
  if (!d) return false;
  const t = new Date(d).getTime();
  return Number.isFinite(t) && t > Date.now();
}

function prettyDate(d?: string | number | Date | null) {
  if (!d) return "-";
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return "-";
  return t.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

/* --------------------------------- page ---------------------------------- */

export default function PatientAppointmentsPage() {
  const { user } = useAuth();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [bookMsg, setBookMsg] = useState<string | null>(null);

  /* ------------------------------ load data ------------------------------ */

  useEffect(() => {
    if (!user) return;
    (async () => {
      const apps = await getAppointmentsByPatient(user.uid);
      // newest first
      apps.sort(
        (a, b) =>
          (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0)
      );
      setAppointments(apps);

      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const data = snap.data() as UserDoc;
        setFavorites(data.favorites || []);
      }
    })();
  }, [user]);

  useEffect(() => {
    (async () => {
      const docs = await getApprovedDoctors();
      setDoctors(docs);
    })();
  }, []);

  const doctorMap = useMemo(() => {
    const m = new Map<string, Doctor>();
    doctors.forEach((d) => m.set(d.uid, d));
    return m;
  }, [doctors]);

  const filteredDoctors = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return [];
    return doctors.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.specialty || "").toLowerCase().includes(q) ||
        (d.qualification || "").toLowerCase().includes(q)
    );
  }, [searchTerm, doctors]);

  /* ---------------------------- actions & events ---------------------------- */

  async function toggleFavorite(doctorId: string) {
    if (!user) return;
    const newFavs = favorites.includes(doctorId)
      ? favorites.filter((x) => x !== doctorId)
      : [...favorites, doctorId];
    setFavorites(newFavs);
    await updateDoc(doc(db, "users", user.uid), { favorites: newFavs });
  }

  async function refreshAppointments() {
    if (!user) return;
    const apps = await getAppointmentsByPatient(user.uid);
    apps.sort(
      (a, b) =>
        (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0)
    );
    setAppointments(apps);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!selectedDoctor || !date || !reason.trim()) {
      setBookMsg(
        "Please select a doctor, pick a date/time, and provide a reason."
      );
      return;
    }
    setLoading(true);
    setBookMsg(null);
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
      setBookMsg(
        "Appointment requested successfully! You’ll be notified after approval."
      );
    } catch (err) {
      console.error(err);
      setBookMsg("Failed to request appointment. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(id: string) {
    if (!confirm("Cancel this appointment?")) return;
    await cancelAppointment(id);
    await refreshAppointments();
  }

  /* --------------------------- derived UI sections -------------------------- */

  const upcoming = useMemo(() => {
    return appointments
      .filter((a) => isFuture(a.date) && a.status !== "declined")
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 2);
  }, [appointments]);

  /* --------------------------------- cards --------------------------------- */

  const Glass = ({
    children,
    className = "",
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div
      className={classNames(
        "rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-md shadow-xl",
        className
      )}
    >
      {children}
    </div>
  );

  const SectionTitle = ({
    icon: Icon,
    children,
  }: {
    icon: React.ElementType;
    children: React.ReactNode;
  }) => (
    <div className="flex items-center gap-2 text-white/90">
      <Icon className="h-5 w-5 text-white/70" />
      <h3 className="text-lg font-semibold">{children}</h3>
    </div>
  );

  const DoctorCard = ({ d }: { d: Doctor }) => {
    const fav = favorites.includes(d.uid);
    return (
      <motion.div
        whileHover={{ y: -2 }}
        className="group text-left rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition p-4 cursor-pointer"
        onClick={() => setSelectedDoctor(d)}
      >
        <div className="flex items-center gap-4">
          {d.photoURL ? (
            <Image
              src={d.photoURL}
              alt={d.name}
              width={64}
              height={64}
              className="h-16 w-16 rounded-full object-cover border border-white/10"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-2xl">
              👨‍⚕️
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold">{d.name}</p>
              {fav && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-400/30">
                  Favorite
                </span>
              )}
            </div>
            <p className="text-sm text-white/70">{d.specialty || "—"}</p>
            <p className="text-xs text-white/50">
              {(d.qualification && `• ${d.qualification}`) ||
                (d.experienceYears && `• ${d.experienceYears} years`) ||
                ""}
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(d.uid);
            }}
            className="p-2 rounded-lg border border-white/10 hover:bg-white/10"
            aria-label={fav ? "Remove from favorites" : "Add to favorites"}
            title={fav ? "Remove from favorites" : "Add to favorites"}
          >
            {fav ? (
              <Heart className="h-4 w-4 text-yellow-300" />
            ) : (
              <HeartOff className="h-4 w-4 text-white/60" />
            )}
          </button>
        </div>
      </motion.div>
    );
  };

  /* ---------------------------------- UI ---------------------------------- */

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 text-white py-10 px-5">
      <div className="mx-auto w-full max-w-6xl space-y-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold">Appointments</h1>
          <p className="text-white/70 mt-1">
            Find doctors, book visits, and track your bookings.
          </p>
        </motion.div>

        {/* Upcoming spotlight */}
        <AnimatePresence>
          {upcoming.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="grid md:grid-cols-2 gap-4"
            >
              {upcoming.map((a) => {
                const d = doctorMap.get(a.doctorId);
                const chip = statusChip(a.status);
                return (
                  <Glass key={a.id} className="p-4">
                    <div className="flex items-center gap-4">
                      {d?.photoURL ? (
                        <Image
                          src={d.photoURL}
                          alt={d.name}
                          width={64}
                          height={64}
                          className="h-16 w-16 rounded-full object-cover border border-white/10"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-2xl">
                          👨‍⚕️
                        </div>
                      )}

                      <div className="flex-1">
                        <p className="font-semibold leading-tight">
                          {d?.name || a.doctorId}
                        </p>
                        <p className="text-sm text-white/70">
                          {d?.specialty || "—"}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border bg-white/5">
                            <Clock3 className="h-3.5 w-3.5" />
                            {prettyDate(a.date)}
                          </span>
                          <span
                            className={classNames(
                              "text-xs px-2 py-1 rounded-full border",
                              chip.cn
                            )}
                          >
                            {chip.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Glass>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* LEFT: Doctor Finder + Selected Doctor + Booking Form */}
          <div className="space-y-8">
            {/* Finder */}
            {!selectedDoctor && (
              <Glass className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <SectionTitle icon={Search}>Find a Doctor</SectionTitle>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search name, specialty, or qualification…"
                      className="w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-3 py-2 placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                    />
                  </div>
                </div>

                {/* Search results */}
                <AnimatePresence initial={false} mode="popLayout">
                  {filteredDoctors.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 grid gap-3 max-h-80 overflow-y-auto"
                    >
                      {filteredDoctors.map((d) => (
                        <DoctorCard key={d.uid} d={d} />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Favorites */}
                {favorites.length > 0 && (
                  <div className="mt-6">
                    <SectionTitle icon={Heart}>
                      Your Favorite Doctors
                    </SectionTitle>
                    <div className="mt-3 grid gap-3">
                      {favorites
                        .map((fid) => doctorMap.get(fid))
                        .filter(Boolean)
                        .map((d) => (
                          <DoctorCard key={(d as Doctor).uid} d={d as Doctor} />
                        ))}
                    </div>
                  </div>
                )}

                {/* Suggestions if no input */}
                {!searchTerm && favorites.length === 0 && (
                  <div className="mt-4 text-sm text-white/60">
                    Tip: Try “cardio”, “dentist”, or “pediatrics” to discover
                    specialists.
                  </div>
                )}
              </Glass>
            )}

            {/* Selected doctor */}
            {selectedDoctor && (
              <Glass className="p-5">
                <div className="flex items-start gap-4">
                  {selectedDoctor.photoURL ? (
                    <Image
                      src={selectedDoctor.photoURL}
                      alt={selectedDoctor.name}
                      width={80}
                      height={80}
                      className="h-20 w-20 rounded-full object-cover border border-white/10"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-3xl">
                      👨‍⚕️
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xl font-semibold">
                        {selectedDoctor.name}
                      </h4>
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border bg-white/5">
                        <Stethoscope className="h-3.5 w-3.5" />
                        {selectedDoctor.specialty || "—"}
                      </span>
                    </div>
                    <p className="text-sm text-white/70">
                      {(selectedDoctor.qualification &&
                        `• ${selectedDoctor.qualification}`) ||
                        (selectedDoctor.experienceYears &&
                          `• ${selectedDoctor.experienceYears} years`) ||
                        " "}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedDoctor(null)}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
                      >
                        <X className="h-4 w-4" />
                        Change doctor
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleFavorite(selectedDoctor.uid)}
                        className={classNames(
                          "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm",
                          favorites.includes(selectedDoctor.uid)
                            ? "bg-yellow-500/20 text-yellow-300 border border-yellow-400/30"
                            : "border border-white/10 bg-white/5 hover:bg-white/10"
                        )}
                      >
                        <Heart className="h-4 w-4" />
                        {favorites.includes(selectedDoctor.uid)
                          ? "Favorited"
                          : "Add to favorites"}
                      </button>
                    </div>
                  </div>
                </div>
              </Glass>
            )}

            {/* Booking form */}
            {selectedDoctor && (
              <Glass className="p-5">
                <SectionTitle icon={CalendarDays}>
                  Request Appointment
                </SectionTitle>

                <form onSubmit={onSubmit} className="mt-4 grid gap-3">
                  <input
                    type="datetime-local"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                  />

                  <textarea
                    placeholder="Reason for appointment (symptoms, notes, etc.)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={4}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                  />

                  {bookMsg && (
                    <div
                      className={classNames(
                        "rounded-lg border px-3 py-2 text-sm",
                        bookMsg.startsWith("Failed") ||
                          bookMsg.startsWith("Please")
                          ? "border-red-400/30 bg-red-500/10 text-red-200"
                          : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                      )}
                    >
                      {bookMsg}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 font-semibold"
                    >
                      <UploadCloud className="h-4 w-4" />
                      {loading ? "Requesting…" : "Request Appointment"}
                    </button>
                    <span className="text-xs text-white/60">
                      You’ll get an approval notification once the doctor
                      confirms.
                    </span>
                  </div>
                </form>
              </Glass>
            )}
          </div>

          {/* RIGHT: My Bookings */}
          <div className="space-y-6">
            <Glass className="p-5">
              <SectionTitle icon={Clock3}>My Bookings</SectionTitle>

              {appointments.length === 0 ? (
                <div className="mt-4 text-white/70 text-sm">
                  You have no appointments yet.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {appointments.map((a) => {
                    const d = doctorMap.get(a.doctorId);
                    const chip = statusChip(a.status);
                    return (
                      <motion.div
                        key={a.id}
                        whileHover={{ y: -2 }}
                        className="rounded-xl border border-white/10 bg-white/5 p-4"
                      >
                        <div className="flex items-start gap-4">
                          {d?.photoURL ? (
                            <Image
                              src={d.photoURL}
                              alt={d.name}
                              width={56}
                              height={56}
                              className="h-14 w-14 rounded-full object-cover border border-white/10"
                            />
                          ) : (
                            <div className="h-14 w-14 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-xl">
                              👨‍⚕️
                            </div>
                          )}

                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold">
                                {d?.name || a.doctorId}
                              </p>
                              <span className="text-xs text-white/60">
                                {d?.specialty || "—"}
                              </span>
                              <span
                                className={classNames(
                                  "text-xs px-2 py-1 rounded-full border",
                                  chip.cn
                                )}
                              >
                                {chip.label}
                              </span>
                            </div>
                            <div className="mt-1 text-sm text-white/80">
                              <div className="inline-flex items-center gap-1">
                                <CalendarDays className="h-4 w-4" />
                                {prettyDate(a.date)}
                              </div>
                            </div>

                            {a.reason && (
                              <p className="mt-2 text-sm text-white/80">
                                <span className="text-white/60">Reason:</span>{" "}
                                {a.reason}
                              </p>
                            )}

                            {a.status === "completed" && a.notes && (
                              <div className="mt-2 rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-2 text-sm text-emerald-200">
                                <div className="inline-flex items-center gap-1 font-medium">
                                  <CheckCircle2 className="h-4 w-4" />
                                  Doctor Notes
                                </div>
                                <div className="mt-1">{a.notes}</div>
                              </div>
                            )}

                            {a.status === "completed" &&
                              a.attachments &&
                              a.attachments.length > 0 && (
                                <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-2 text-sm">
                                  <div className="inline-flex items-center gap-1 font-medium">
                                    <AlertTriangle className="h-4 w-4" />
                                    Attachments
                                  </div>
                                  <ul className="mt-1 list-disc pl-5 text-white/80">
                                    {a.attachments.map((file) => (
                                      <li key={file.fileUrl}>
                                        <a
                                          href={file.fileUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-blue-300 hover:underline"
                                        >
                                          {file.fileName}
                                        </a>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                          </div>
                        </div>

                        {/* actions */}
                        {a.status === "pending" && (
                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={() => a.id && handleCancel(a.id)}
                              className="inline-flex items-center gap-2 rounded-lg bg-red-600 hover:bg-red-500 px-3 py-1.5 text-sm font-medium"
                            >
                              <X className="h-4 w-4" />
                              Cancel request
                            </button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </Glass>
          </div>
        </div>
      </div>
    </div>
  );
}
