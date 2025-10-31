import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SmartCare Connect",
  manifest: '/manifest.webmanifest',
  description: "A secure platform connecting patients and doctors.",
  keywords: [
    "SmartCare",
    "Healthcare",
    "Doctors",
    "Patients",
    "Appointments",
    "Medical Records",
  ],
  openGraph: {
    title: "SmartCare Connect",
    description:
      "Seamlessly connect patients and doctors — book, consult, and manage health securely.",
    url: "https://smartcare-connect.com",
    siteName: "SmartCare Connect",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "SmartCare Connect Dashboard Preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og/cover.png"],
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ]
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-white selection:bg-blue-500/30 selection:text-white`}
      >
        {/* Sticky Navbar */}
        <header className="sticky top-0 z-50 backdrop-blur-lg bg-black/40 border-b border-white/10">
          <Navbar />
        </header>

        {/* Page Content */}
        <main className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900 text-white">
  {children}
</main>


        {/* Footer */}
        <footer className="bg-black/80 border-t border-white/10 text-center py-6 text-gray-400 text-sm">
          © {new Date().getFullYear()} SmartCare Connect. All rights reserved.
        </footer>
      </body>
    </html>
  );
}
