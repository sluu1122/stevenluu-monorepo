import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Steven Luu | Software Engineer",
  description:
    "Portfolio of Steven Luu — Frontend-focused Software Engineer with 19 years of experience building responsive, scalable web applications.",
  openGraph: {
    type: "website",
    url: "https://stevenluu.com",
    siteName: "Steven Luu",
    title: "Steven Luu | Software Engineer",
    description:
      "Portfolio of Steven Luu — Frontend-focused Software Engineer with 19 years of experience building responsive, scalable web applications.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Steven Luu | Software Engineer",
    description:
      "Portfolio of Steven Luu — Frontend-focused Software Engineer with 19 years of experience building responsive, scalable web applications.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
