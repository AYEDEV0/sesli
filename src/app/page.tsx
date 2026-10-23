"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Radio, User, DoorOpen, Sparkles, ArrowRight, Laptop, Download, History } from "lucide-react";

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [username, setUsername] = useState<string>("");
  const [roomName, setRoomName] = useState<string>("");
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [recentRooms, setRecentRooms] = useState<string[]>([]);
  const [error, setError] = useState<string>("");
  const [isElectronApp, setIsElectronApp] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if ((window as any).electronAPI) {
        setIsElectronApp(true);
      }

      // Beni Hatırla: Kayıtlı kullanıcı adını yükle
      const savedUser = localStorage.getItem("voxa_username");
      const savedRemember = localStorage.getItem("voxa_remember_me");
      if (savedUser) {
        setUsername(savedUser);
      }
      if (savedRemember !== null) {
        setRememberMe(savedRemember === "true");
      }

      // Son ziyaret edilen odaları yükle
      try {
        const savedRooms = localStorage.getItem("voxa_recent_rooms");
        if (savedRooms) {
          const parsed = JSON.parse(savedRooms);
          if (Array.isArray(parsed)) {
            setRecentRooms(parsed.slice(0, 3));
          }
        }
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    const roomParam = searchParams.get("room");
    if (roomParam) {
      setRoomName(roomParam);
    }
  }, [searchParams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedUsername = username.trim();
    const trimmedRoomName = roomName.trim().toLowerCase();

    if (!trimmedUsername) {
      setError("Lütfen geçerli bir kullanıcı adı girin.");
      return;
    }

    if (!trimmedRoomName) {
      setError("Lütfen katılmak istediğiniz oda ismini girin.");
      return;
    }

    // Beni Hatırla Ayarlarını Kaydet
    if (typeof window !== "undefined") {
      if (rememberMe) {
        localStorage.setItem("voxa_username", trimmedUsername);
        localStorage.setItem("voxa_remember_me", "true");
      } else {
        localStorage.removeItem("voxa_username");
        localStorage.setItem("voxa_remember_me", "false");
      }

      // Son Kullanılan Odaları Güncelle (En fazla 3 oda)
      try {
        const updated = [trimmedRoomName, ...recentRooms.filter((r) => r !== trimmedRoomName)].slice(0, 3);
        localStorage.setItem("voxa_recent_rooms", JSON.stringify(updated));
      } catch {
        // ignore
      }
    }

    // URL slug güvenliği için encode
    const formattedRoom = encodeURIComponent(trimmedRoomName);
    const formattedUser = encodeURIComponent(trimmedUsername);

    router.push(`/${formattedRoom}?username=${formattedUser}`);
  };

  return (
    <div className="min-h-screen w-full bg-[#1e1f22] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Discord Style Subtle Background Glow Effects */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#5865f2]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#5865f2]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Card */}
      <div className="w-full max-w-md bg-[#313338] border border-[#2b2d31] rounded-2xl p-8 shadow-2xl relative z-10 backdrop-blur-sm">
        {/* Header Branding */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 bg-[#5865f2] rounded-2xl flex items-center justify-center shadow-lg shadow-[#5865f2]/30 mb-4 transition-transform hover:scale-105">
            <Radio className="w-9 h-9 text-white animate-pulse" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Voxa <Sparkles className="w-6 h-6 text-[#5865f2]" />
          </h1>
          <p className="text-xs text-[#949ba4] mt-1 font-medium">Yüksek Kaliteli Sesli İletişim & Ekran Paylaşımı</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-3 rounded-lg bg-[#f23f43]/15 border border-[#f23f43]/40 text-[#f23f43] text-sm text-center font-medium">
            {error}
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#949ba4] mb-2">
              Kullanıcı Adı
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#949ba4]">
                <User className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Örn: Mehmet Ali"
                className="w-full pl-11 pr-4 py-3 bg-[#1e1f22] border border-[#2b2d31] focus:border-[#5865f2] rounded-xl text-white placeholder-[#949ba4] outline-none transition-all focus:ring-2 focus:ring-[#5865f2]/30"
                maxLength={30}
                required
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#949ba4]">
                Oda İsmi
              </label>
              {recentRooms.length > 0 && (
                <span className="text-[10px] text-[#949ba4] flex items-center gap-1 font-medium">
                  <History className="w-3 h-3 text-[#5865f2]" /> Son Odalar
                </span>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#949ba4]">
                <DoorOpen className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Örn: sohbet-odasi-1"
                className="w-full pl-11 pr-4 py-3 bg-[#1e1f22] border border-[#2b2d31] focus:border-[#5865f2] rounded-xl text-white placeholder-[#949ba4] outline-none transition-all focus:ring-2 focus:ring-[#5865f2]/30"
                maxLength={40}
                required
              />
            </div>

            {/* Son Odalar Hızlı Seçim Butonları */}
            {recentRooms.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {recentRooms.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRoomName(r)}
                    className="text-[11px] px-2.5 py-1 bg-[#1e1f22] hover:bg-[#5865f2]/20 hover:text-[#5865f2] text-[#949ba4] border border-[#2b2d31] rounded-lg transition-all cursor-pointer truncate max-w-[120px]"
                  >
                    #{r}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Beni Hatırla Seçeneği */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded bg-[#1e1f22] border-[#2b2d31] text-[#5865f2] focus:ring-[#5865f2]/40 focus:ring-2 accent-[#5865f2] cursor-pointer"
              />
              <span className="text-xs text-[#949ba4] group-hover:text-white transition-colors font-medium">
                Kullanıcı adımı hatırla
              </span>
            </label>
          </div>

          <button
            type="submit"
            className="w-full mt-2 py-3.5 px-4 bg-[#5865f2] hover:bg-[#4752c4] active:scale-[0.99] text-white font-semibold rounded-xl shadow-lg shadow-[#5865f2]/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>Odaya Katıl</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>

        {/* Masaüstü Uygulamasını İndir Alanı */}
        {!isElectronApp && (
          <div className="mt-6 pt-5 border-t border-[#2b2d31]">
            <a
              href="/api/download/desktop"
              className="w-full py-3 px-4 bg-[#1e1f22] hover:bg-[#2b2d31] border border-[#313338] hover:border-[#5865f2]/50 text-xs font-semibold text-[#949ba4] hover:text-white rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm group"
            >
              <Laptop className="w-4 h-4 text-[#5865f2]" />
              <span>Voxa Masaüstü Uygulamasını İndir (v1.0.3)</span>
              <Download className="w-4 h-4 text-[#949ba4] group-hover:text-white transition-colors ml-auto" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#1e1f22] flex items-center justify-center text-white font-medium">
          Yükleniyor...
        </div>
      }
    >
      <JoinForm />
    </Suspense>
  );
}
