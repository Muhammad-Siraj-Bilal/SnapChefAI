import type { Metadata } from "next";
import { Outfit, Inter } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["400", "500", "600", "700", "800"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "SnapChef AI — Turn Any Food Photo into a Perfect Recipe",
  description:
    "SnapChef AI is a multimodal AI cooking assistant that converts food and ingredient photos into personalized recipes. Supports allergy filters, budget mode, health goals, and cuisine twists.",
  keywords: [
    "AI recipe generator",
    "food photo to recipe",
    "cooking assistant AI",
    "ingredient to recipe",
    "fridge to meal",
    "SnapChef AI",
  ],
  openGraph: {
    title: "SnapChef AI",
    description: "Turn any food photo into a personalized recipe with AI.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${outfit.variable} ${inter.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
