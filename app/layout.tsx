import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Culture Bot — WPP Media",
  description: "UK-focused cultural moments for planners and strategists"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
