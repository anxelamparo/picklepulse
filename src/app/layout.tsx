import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PicklePulse — live pickleball tournaments",
  description: "Run round robins for teams and doubles with live standings, court boards and TV mode, branded for your club.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b1220" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
