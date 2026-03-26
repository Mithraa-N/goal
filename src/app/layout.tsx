import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GolfDraw — Charity Golf Subscription Platform",
  description:
    "Join GolfDraw to compete in monthly prize draws, track your golf scores, and support your favourite charities — all in one premium platform.",
  keywords: "golf, charity, prize draw, subscription, score tracker",
  openGraph: {
    title: "GolfDraw — Where Golf Meets Giving",
    description:
      "Monthly prize draws. Real golf scores. Genuine charity impact.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col gradient-mesh">{children}</body>
    </html>
  );
}
