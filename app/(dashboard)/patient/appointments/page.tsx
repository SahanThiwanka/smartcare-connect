"use client";
import { useEffect, useState, useMemo, FormEvent } from "react";
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

  // 🔹 Load appointments & favorites
  useEffect(() => {
    if (!user) return;
    (async () => {
      const apps = await getAppointmentsByPatient(user.uid);
      setAppointments(apps);

      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const data = snap.data() as any;
        setFavorites(data.favorites || []);
      }
    })();
  }, [user]);

  // 🔹 Load approved doctors
  useEffect(() => {
    (async () => {
      const docs = await getApprovedDoctors();
      setDoctors(docs);
    })();
  }, []);

  // 🔹 Map doctors by UID
  const doctorMap = useMemo(() => {
    const m = new Map<string, Doctor>();
    doctors.forEach((d) => m.set(d.uid, d));
    return m;
  }, [doctors]);

  // 🔹 Search doctors
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

  // 🔹 Toggle favorite doctor
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

  // 🔹 Submit new appointment
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

  // 🔹 Cancel appointment
  const handleCancel = async (id: string) => {
    if (!confirm("Cancel this appointment?")) return;
    await cancelAppointment(id);
    await refreshAppointments();
  };

  // 🔹 Status color
  const statusColor = (status: Appointment["status"]) => {
    switch (status) {
      case "pending":
        return "text-yellow-500";
      case "approved":
        return "text-green-500";
      case "declined":
        return "text-red-500";
      case "completed":
        return "text-blue-500";
      default:
        return "text-gray-500";
    }
  };

  // 🔹 Doctor card component
  const DoctorCard = ({ d }: { d: Doctor }) => {
    const isFav = favorites.includes(d.uid);
    return (
      <div
        key={d.uid}
        className="border rounded-lg bg-white hover:bg-gray-50 shadow-sm p-4 transition cursor-pointer"
        onClick={() => setSelectedDoctor(d)}
      >
        <div className="flex items-center gap-4">
          {d.photoURL ? (
            <img
              src={d.photoURL}
              alt={d.name}
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-xl">
              👨‍⚕️
            </div>
          )}
          <div className="flex-1">
            <h4 className="text-lg font-semibold text-black">{d.name}</h4>
            <p className="text-sm text-gray-700">{d.specialty}</p>
            {d.experienceYears && (
              <p className="text-sm text-gray-500">
                {d.experienceYears} years exp.
              </p>
            )}
            {d.qualification && (
              <p className="text-sm text-gray-500">{d.qualification}</p>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(d.uid);
            }}
            className={`text-xl ${
              isFav ? "text-yellow-500" : "text-gray-400"
            } hover:scale-110`}
          >
            ★
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <h2 className="text-2xl font-semibold">My Appointments</h2>

      {/* ---------- Doctor Search ---------- */}
      {!selectedDoctor && (
        <div className="p-4 border rounded bg-gray-500 space-y-3">
          <h3 className="font-semibold text-lg">Find a Doctor</h3>
          <input
            type="text"
            placeholder="Search by name or specialty..."
            className="w-full rounded border p-2 text-black"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="grid gap-3 max-h-80 overflow-y-auto">
              {searchResults.map((d) => (
                <DoctorCard key={d.uid} d={d} />
              ))}
            </div>
          )}

          {/* Favorites */}
          {favorites.length > 0 && (
            <div>
              <h4 className="font-semibold mt-4 mb-2">⭐ Favorite Doctors</h4>
              <div className="grid gap-2">
                {favorites.map((fid) => {
                  const doc = doctorMap.get(fid);
                  if (!doc) return null;
                  return <DoctorCard key={fid} d={doc} />;
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------- Selected Doctor ---------- */}
      {selectedDoctor && (
        <div className="p-5 rounded-lg border bg-black text-white space-y-4">
          <div className="flex items-center gap-4">
            {selectedDoctor.photoURL ? (
              <img
                src={selectedDoctor.photoURL}
                alt={selectedDoctor.name}
                className="w-20 h-20 rounded-full object-cover border border-gray-700"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center text-3xl">
                👨‍⚕️
              </div>
            )}
            <div>
              <h3 className="text-2xl font-semibold">{selectedDoctor.name}</h3>
              <p className="text-gray-300">{selectedDoctor.specialty}</p>
              {selectedDoctor.qualification && (
                <p className="text-gray-400">
                  Qualification: {selectedDoctor.qualification}
                </p>
              )}
              {selectedDoctor.experienceYears && (
                <p className="text-gray-400">
                  Experience: {selectedDoctor.experienceYears} years
                </p>
              )}
              {selectedDoctor.phone && (
                <p className="text-gray-400">📞 {selectedDoctor.phone}</p>
              )}
              {selectedDoctor.email && (
                <p className="text-gray-400">✉️ {selectedDoctor.email}</p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setSelectedDoctor(null)}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm"
            >
              Change Doctor
            </button>
            <button
              onClick={() => toggleFavorite(selectedDoctor.uid)}
              className={`px-4 py-2 rounded text-sm ${
                favorites.includes(selectedDoctor.uid)
                  ? "bg-yellow-500 text-black"
                  : "bg-gray-500 text-white"
              }`}
            >
              {favorites.includes(selectedDoctor.uid)
                ? "★ Unfavorite"
                : "☆ Favorite"}
            </button>
          </div>
        </div>
      )}

      {/* ---------- Booking Form ---------- */}
      {selectedDoctor && (
        <form
          onSubmit={onSubmit}
          className="grid gap-3 p-4 border rounded bg-gray-500"
        >
          <input
            className="rounded border p-2 text-black"
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          <textarea
            className="rounded border p-2 text-black"
            placeholder="Reason for appointment"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />

          {message && <p className="text-sm text-blue-600">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            {loading ? "Booking..." : "Book Appointment"}
          </button>
        </form>
      )}

      {/* ---------- Appointments ---------- */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">My Bookings</h3>
        {appointments.length === 0 && <p>No appointments yet.</p>}

        {appointments.map((a) => (
          <div key={a.id} className="rounded border p-4 bg-black text-white">
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
              <p className="mt-2 p-2 rounded bg-gray-700 text-sm">
                <b>Doctor’s Notes:</b> {a.notes}
              </p>
            )}

            {a.status === "completed" &&
              a.attachments &&
              a.attachments.length > 0 && (
                <div className="mt-3 p-2 border rounded bg-gray-800 text-sm">
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
                className="mt-2 rounded bg-red-500 px-3 py-1 text-white text-sm"
              >
                Cancel
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
