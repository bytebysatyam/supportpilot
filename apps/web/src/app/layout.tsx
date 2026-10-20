import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SupportPilot",
  description:
    "A shared workspace for support requests, conversations, ownership, and response deadlines.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
