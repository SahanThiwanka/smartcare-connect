"use client";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center flex-1 px-6 py-20 text-center">
        <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">
          Welcome to <span className="text-blue-400">SmartCare Connect</span>
        </h1>
        <p className="mt-6 text-lg md:text-xl text-gray-300 max-w-2xl">
          A smarter way to connect patients and doctors — book appointments,
          share health records, and get personalized care securely.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <Link
            href="/patient/register"
            className="px-6 py-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium shadow-lg transition"
          >
            Register as Patient
          </Link>
          <Link
            href="/doctor/register"
            className="px-6 py-3 rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium shadow-lg transition"
          >
            Register as Doctor
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 rounded-lg border border-gray-400 hover:bg-gray-700 text-white font-medium shadow-lg transition"
          >
            Login
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-6 max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">
          Why Choose SmartCare?
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-gray-900 p-6 rounded-xl shadow hover:shadow-lg transition">
            <h3 className="text-lg font-semibold mb-2 text-blue-400">
              🧑‍⚕️ For Patients
            </h3>
            <p className="text-sm text-gray-400">
              Book appointments, manage medical records, and track your health
              journey anytime, anywhere.
            </p>
          </div>
          <div className="bg-gray-900 p-6 rounded-xl shadow hover:shadow-lg transition">
            <h3 className="text-lg font-semibold mb-2 text-green-400">
              👩‍⚕️ For Doctors
            </h3>
            <p className="text-sm text-gray-400">
              Manage patients, review health data, and provide better care with
              real-time access to records.
            </p>
          </div>
          <div className="bg-gray-900 p-6 rounded-xl shadow hover:shadow-lg transition">
            <h3 className="text-lg font-semibold mb-2 text-yellow-400">
              🔐 Secure & Private
            </h3>
            <p className="text-sm text-gray-400">
              Data is encrypted and shared only between patients and doctors —
              your privacy is our priority.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 px-6 bg-gray-900">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">
          How It Works
        </h2>
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <div className="bg-black p-6 rounded-xl shadow space-y-3">
            <h3 className="text-lg font-semibold text-blue-400">
              For Patients
            </h3>
            <ol className="list-decimal list-inside text-gray-300 space-y-2">
              <li>Register and complete your profile.</li>
              <li>Search and book an appointment with a doctor.</li>
              <li>Upload and manage your health records.</li>
              <li>Get personalized care and doctor’s notes.</li>
            </ol>
          </div>
          <div className="bg-black p-6 rounded-xl shadow space-y-3">
            <h3 className="text-lg font-semibold text-green-400">
              For Doctors
            </h3>
            <ol className="list-decimal list-inside text-gray-300 space-y-2">
              <li>Register and get approved by admin.</li>
              <li>Manage patient appointments easily.</li>
              <li>Access patients’ health records securely.</li>
              <li>Provide notes, treatments, and follow-ups.</li>
            </ol>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 px-6 max-w-5xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">
          What People Say
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-900 p-6 rounded-xl shadow">
            <p className="text-gray-300 italic">
              “SmartCare made booking a doctor so easy! I uploaded my records
              and my doctor had everything ready before my visit.”
            </p>
            <p className="text-sm text-gray-400 mt-3">– Sarah, Patient</p>
          </div>
          <div className="bg-gray-900 p-6 rounded-xl shadow">
            <p className="text-gray-300 italic">
              “This system saves me hours every week. I can review patient
              history and focus more on providing care.”
            </p>
            <p className="text-sm text-gray-400 mt-3">– Dr. James, Physician</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-6 text-center text-gray-400 text-sm">
        <p>
          © {new Date().getFullYear()} SmartCare Connect. All rights reserved.
        </p>
        <div className="mt-2 flex justify-center gap-4">
          <Link href="/login" className="hover:text-white">
            Login
          </Link>
          <Link href="/patient/register" className="hover:text-white">
            Patient Register
          </Link>
          <Link href="/doctor/register" className="hover:text-white">
            Doctor Register
          </Link>
        </div>
      </footer>
    </div>
  );
}
