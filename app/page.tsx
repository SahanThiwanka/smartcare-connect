"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Stethoscope,
  ShieldCheck,
  Users,
  HeartPulse,
  Smartphone,
  Download,
  X,
} from "lucide-react";

export default function HomePage() {
  // ✅ Serve from public/apk
  const apkUrl = "/apk/smartcare-connect.apk";

  // 🔒 Hydration-safe client-only values
  const [apkFullUrl, setApkFullUrl] = useState<string>(apkUrl);
  const [year, setYear] = useState<string>("");
  useEffect(() => {
    try {
      setApkFullUrl(new URL(apkUrl, window.location.origin).toString());
    } catch {
      setApkFullUrl(apkUrl);
    }
    setYear(String(new Date().getFullYear()));
  }, [apkUrl]);

  // 📱 Sticky mobile install bar (dismissible)
  const [showInstallBar, setShowInstallBar] = useState(false);
  useEffect(() => {
    const dismissed = localStorage.getItem("apkInstallBarDismissed") === "1";
    if (!dismissed && window.matchMedia("(max-width: 767px)").matches) {
      setShowInstallBar(true);
    }
  }, []);
  const dismissBar = () => {
    localStorage.setItem("apkInstallBarDismissed", "1");
    setShowInstallBar(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-950 via-black to-gray-900 text-white overflow-hidden">
      {/* ===== Hero Section ===== */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-24 relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-5xl md:text-7xl font-extrabold leading-tight">
            Welcome to{" "}
            <span className="bg-gradient-to-r from-blue-400 via-teal-400 to-green-400 bg-clip-text text-transparent">
              SmartCare Connect
            </span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">
            Connecting doctors and patients with smart, secure, and seamless
            healthcare experiences.
          </p>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          className="flex flex-col sm:flex-row gap-4 mt-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        >
          <Link
            href="/patient/register"
            className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-lg transition"
          >
            Register as Patient
          </Link>
          <Link
            href="/doctor/register"
            className="px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-lg transition"
          >
            Register as Doctor
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 rounded-lg border border-gray-500 hover:bg-gray-800 text-white font-medium shadow-lg transition"
          >
            Login
          </Link>
        </motion.div>

        {/* Background Glow Animation */}
        <div className="absolute -z-10 w-[800px] h-[800px] rounded-full bg-gradient-to-tr from-blue-500/20 to-purple-500/10 blur-3xl animate-pulse" />
      </section>

      {/* ===== Features Section ===== */}
      <section className="py-20 px-6 max-w-6xl mx-auto text-center">
        <motion.h2
          className="text-3xl md:text-4xl font-bold mb-12"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          Why Choose <span className="text-blue-400">SmartCare?</span>
        </motion.h2>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: <Users className="w-10 h-10 text-blue-400 mb-4" />,
              title: "For Patients",
              desc: "Book appointments, manage health records, and connect with verified doctors anytime, anywhere.",
            },
            {
              icon: <Stethoscope className="w-10 h-10 text-green-400 mb-4" />,
              title: "For Doctors",
              desc: "Manage patient appointments, access medical data securely, and deliver care efficiently.",
            },
            {
              icon: <ShieldCheck className="w-10 h-10 text-yellow-400 mb-4" />,
              title: "Secure & Private",
              desc: "Your health data is encrypted, confidential, and shared only with your authorized doctor.",
            },
          ].map((feature, i) => (
            <motion.div
              key={i}
              whileHover={{ scale: 1.05 }}
              className="bg-white/10 backdrop-blur-lg border border-white/10 p-8 rounded-2xl shadow-md hover:shadow-xl transition"
            >
              {feature.icon}
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-gray-300 text-sm">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ===== Mobile App Download (full section) ===== */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-5 gap-6 items-center rounded-2xl border border-white/10 bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-emerald-500/10 p-6">
          <div className="md:col-span-3 text-center md:text-left">
            <h3 className="text-2xl md:text-3xl font-bold flex items-center justify-center md:justify-start gap-2">
              <Smartphone className="h-7 w-7 text-teal-300" /> Download our
              Mobile App
            </h3>
            <p className="mt-2 text-gray-300">
              Get the best SmartCare experience on Android. Fast booking, smart
              reminders, and offline records access.
            </p>
            <div className="mt-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-start">
              <a
                href={apkUrl}
                download
                type="application/vnd.android.package-archive"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-teal-500 text-black font-semibold hover:bg-teal-400 shadow-lg"
              >
                <Download className="h-5 w-5" /> Download Android APK
              </a>
              <p className="text-xs text-gray-400" suppressHydrationWarning>
                Direct link: <code className="font-mono">{apkFullUrl}</code>
              </p>
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
              <p className="text-sm text-gray-300">Scan on your phone</p>
              {/* If you want a real QR, I can add a tiny SVG generator */}
              <p className="mt-2 break-all text-xs text-gray-400" suppressHydrationWarning>
                {apkFullUrl}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== How It Works ===== */}
      <section className="py-20 px-6 bg-gray-900/60 backdrop-blur-lg">
        <h2 className="text-3xl font-bold text-center mb-12">
          How It <span className="text-green-400">Works</span>
        </h2>
        <div className="grid md:grid-cols-2 gap-10 max-w-5xl mx-auto">
          <div className="bg-black/50 p-6 rounded-xl shadow space-y-3 border border-white/10">
            <h3 className="text-lg font-semibold text-blue-400">
              For Patients
            </h3>
            <ol className="list-decimal list-inside text-gray-300 space-y-2 text-sm">
              <li>Register and create your health profile.</li>
              <li>Find the right doctor by specialty or reviews.</li>
              <li>Book appointments and get reminders.</li>
              <li>Access your digital health records anywhere.</li>
            </ol>
          </div>
          <div className="bg-black/50 p-6 rounded-xl shadow space-y-3 border border-white/10">
            <h3 className="text-lg font-semibold text-green-400">
              For Doctors
            </h3>
            <ol className="list-decimal list-inside text-gray-300 space-y-2 text-sm">
              <li>Sign up and verify your medical credentials.</li>
              <li>Manage patient appointments effortlessly.</li>
              <li>Access and update patient records securely.</li>
              <li>Focus more on patient care, less on paperwork.</li>
            </ol>
          </div>
        </div>
      </section>

      {/* ===== Testimonials ===== */}
      <section className="py-20 px-6 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">
          What People <span className="text-pink-400">Say</span>
        </h2>
        <div className="grid md:grid-cols-2 gap-8">
          {[
            {
              text: "“SmartCare made booking a doctor so easy! My doctor already had my reports before I arrived — seamless experience.”",
              name: "Sarah, Patient",
            },
            {
              text: "“This platform saves me hours weekly. I can focus on my patients while SmartCare handles the logistics.”",
              name: "Dr. James, Physician",
            },
          ].map((t, i) => (
            <motion.div
              key={i}
              whileHover={{ scale: 1.03 }}
              className="bg-white/10 backdrop-blur-md border border-white/10 p-6 rounded-xl shadow"
            >
              <p className="text-gray-200 italic">“{t.text}”</p>
              <p className="text-sm text-gray-400 mt-3">– {t.name}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ===== Call to Action ===== */}
      <section className="py-20 px-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-center">
        <HeartPulse className="w-12 h-12 mx-auto mb-4 text-white animate-pulse" />
        <h2 className="text-3xl md:text-4xl font-bold mb-6">
          Ready to experience smarter healthcare?
        </h2>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/patient/register"
            className="px-8 py-3 bg-white text-blue-700 font-semibold rounded-lg hover:bg-gray-100 transition"
          >
            Get Started as Patient
          </Link>
          <Link
            href="/doctor/register"
            className="px-8 py-3 bg-white/20 border border-white text-white font-semibold rounded-lg hover:bg-white/30 transition"
          >
            Join as Doctor
          </Link>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="bg-black/80 py-6 text-center text-gray-400 text-sm border-t border-white/10">
        <p suppressHydrationWarning>
          © {year} SmartCare Connect — All Rights Reserved.
        </p>
        <div className="mt-3 flex justify-center gap-6 text-gray-500">
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

      {/* ===== Sticky Mobile Install Bar (md:hidden) ===== */}
      {showInstallBar && (
        <motion.aside
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="fixed bottom-3 left-3 right-3 z-50 md:hidden"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 backdrop-blur-md p-3 shadow-xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/20">
              <Smartphone className="h-6 w-6 text-teal-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Get the SmartCare Android app</p>
              <p className="text-xs text-gray-300 truncate">Faster booking • Smart reminders</p>
            </div>
            <a
              href={apkUrl}
              download
              type="application/vnd.android.package-archive"
              className="inline-flex items-center gap-2 rounded-lg bg-teal-500 text-black font-semibold px-3 py-2 hover:bg-teal-400"
            >
              <Download className="h-4 w-4" /> Get APK
            </a>
            <button
              onClick={dismissBar}
              aria-label="Dismiss"
              className="rounded-lg p-1 hover:bg-white/10"
            >
              <X className="h-5 w-5 text-white/70" />
            </button>
          </div>
        </motion.aside>
      )}
    </div>
  );
}
