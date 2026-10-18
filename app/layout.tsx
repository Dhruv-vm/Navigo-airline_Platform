import type { Metadata, Viewport } from "next"
import "./globals.css"
import NaviBotWrapper from "@/components/NaviBotWrapper"

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
}

export const metadata: Metadata = {
  title: {
    default: "Navigo — Smart Flight Booking & DigiYatra Biometric Portal",
    template: "%s | Navigo",
  },
  description:
    "Experience next-generation aviation with Navigo. Dynamic flight pricing, interactive 3D seat pods, DigiYatra biometric facial check-in, and instant cryptographic boarding passes.",
  keywords: [
    "Navigo",
    "flights",
    "flight booking",
    "DigiYatra",
    "smart airport",
    "biometric check-in",
    "boarding pass",
    "airline tickets",
  ],
  authors: [{ name: "Navigo Aviation Systems" }],
  openGraph: {
    title: "Navigo — Smart Flight Booking & Biometric Boarding",
    description:
      "Book flights with real-time dynamic pricing, select premium seat pods, and fast-track airport security with DigiYatra biometric check-in.",
    type: "website",
    locale: "en_IN",
    siteName: "Navigo",
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#020617] text-white overflow-x-hidden overflow-y-auto">
        {children}
        <NaviBotWrapper />
      </body>
    </html>
  )
}