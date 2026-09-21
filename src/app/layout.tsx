import type { Metadata } from "next";
import "@livekit/components-styles";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sesli - Discord Kalitesinde Sesli Sohbet ve Ekran Paylaşımı",
  description: "Next.js 14 ve LiveKit ile güçlendirilmiş yüksek kaliteli ses ve ekran paylaşımı uygulaması.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className="dark">
      <body className="bg-discord-bg text-discord-text antialiased selection:bg-discord-accent selection:text-white">
        {children}
      </body>
    </html>
  );
}
