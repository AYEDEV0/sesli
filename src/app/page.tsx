"use client";

import React, { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Radio,
  User,
  DoorOpen,
  Sparkles,
  ArrowRight,
  Laptop,
  Download,
  History,
  Camera,
  Check,
  X,
  Upload,
  Smile,
} from "lucide-react";
import {
  PRESET_AVATARS,
  getStoredAvatar,
  storeAvatar,
  clearStoredAvatar,
  compressAndCropAvatar,
} from "@/lib/avatars";

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [username, setUsername] = useState<string>("");
  const [roomName, setRoomName] = useState<string>("");
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [recentRooms, setRecentRooms] = useState<string[]>([]);
  const [error, setError] = useState<string>("");
  const [isElectronApp, setIsElectronApp] = useState<boolean>(false);

  // Avatar Yönetimi
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [avatarModalOpen, setAvatarModalOpen] = useState<boolean>(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if ((window as any).electronAPI) {
        setIsElectronApp(true);
      }

      // Beni Hatırla: Kayıtlı kullanıcı adını ve avatarı yükle
      const savedUser = localStorage.getItem("voxa_username");
      const savedRemember = localStorage.getItem("voxa_remember_me");
      if (savedUser) {
        setUsername(savedUser);
      }
      if (savedRemember !== null) {
        setRememberMe(savedRemember === "true");
      }

      // Kayıtlı avatarı hatırla
      const savedAvatar = getStoredAvatar();
      if (savedAvatar) {
        setUserAvatar(savedAvatar);
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

  // Özel avatar yükleme
  const handleCustomAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const cropped = await compressAndCropAvatar(file);
      setUserAvatar(cropped);
      storeAvatar(cropped);
      setAvatarModalOpen(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    } catch (err: any) {
      alert(err.message || "Avatar yüklenirken bir hata oluştu.");
    }
  };

  const handleSelectPresetAvatar = (url: string) => {
    setUserAvatar(url);
    storeAvatar(url);
    setAvatarModalOpen(false);
  };

  const handleRemoveAvatar = () => {
    setUserAvatar(null);
    clearStoredAvatar();
    setAvatarModalOpen(false);
  };

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

      // Avatarı kaydet
      if (userAvatar) {
        storeAvatar(userAvatar);
      }

      // Son Kullanılan Odaları Güncelle (En fazla 3 oda)
      try {
        const updated = [
          trimmedRoomName,
          ...recentRooms.filter((r) => r !== trimmedRoomName),
        ].slice(0, 3);
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
          <p className="text-xs text-[#949ba4] mt-1 font-medium">
            Yüksek Kaliteli Sesli İletişim & Ekran Paylaşımı
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-3 rounded-lg bg-[#f23f43]/15 border border-[#f23f43]/40 text-[#f23f43] text-sm text-center font-medium">
            {error}
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Kullanıcı Adı ve Avatar Seçici */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#949ba4] mb-2">
              Kullanıcı Adı & Profil Avatarı
            </label>
            <div className="flex items-center gap-3">
              {/* Avatar Önizleme Dairesi / Değiştir Butonu */}
              <button
                type="button"
                onClick={() => setAvatarModalOpen(true)}
                className="relative w-12 h-12 rounded-xl bg-[#1e1f22] border-2 border-[#5865f2]/40 hover:border-[#5865f2] transition-all flex items-center justify-center group flex-shrink-0 overflow-hidden cursor-pointer shadow-md"
                title="Profil Avatarını Değiştir"
              >
                {userAvatar ? (
                  <img
                    src={userAvatar}
                    alt="Avatar"
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <div className="w-full h-full bg-[#5865f2] flex items-center justify-center text-white font-bold text-sm">
                    {username.trim() ? username.slice(0, 2).toUpperCase() : <User className="w-5 h-5" />}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-4 h-4 text-white" />
                </div>
              </button>

              {/* Kullanıcı Adı Inputu */}
              <div className="relative flex-1">
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
                Kullanıcı adımı ve avatarımı hatırla
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

      {/* AVATAR SEÇİM VE YÜKLEME MODALI */}
      {avatarModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#2b2d31] border border-[#383a40] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-[#1e1f22] border-b border-[#313338] flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Smile className="w-4 h-4 text-[#5865f2]" />
                <span>Avatarını Seç veya Yükle</span>
              </div>
              <button
                type="button"
                onClick={() => setAvatarModalOpen(false)}
                className="p-1 rounded-lg text-[#949ba4] hover:text-white hover:bg-[#313338]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              {/* Bilgisayardan Fotoğraf Yükle Butonu */}
              <div>
                <input
                  type="file"
                  ref={avatarInputRef}
                  accept="image/*"
                  onChange={handleCustomAvatarUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="w-full py-3 px-4 bg-[#1e1f22] hover:bg-[#35373c] border border-dashed border-[#5865f2] rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm group"
                >
                  <Upload className="w-4 h-4 text-[#5865f2] group-hover:scale-110 transition-transform" />
                  <span>Bilgisayardan Fotoğraf Yükle</span>
                </button>
                <p className="text-[10px] text-[#949ba4] text-center mt-1">
                  PNG, JPG veya WebP (Otomatik olarak kare kırpılır ve hatırlanır)
                </p>
              </div>

              <div className="text-[11px] font-bold text-[#949ba4] uppercase tracking-wider">
                Hazır Avatarlar
              </div>

              {/* Hazır Avatar Izgarası */}
              <div className="grid grid-cols-3 gap-3">
                {PRESET_AVATARS.map((av) => (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => handleSelectPresetAvatar(av.url)}
                    className={`relative p-2 rounded-xl bg-[#1e1f22] border transition-all hover:scale-105 flex flex-col items-center gap-1.5 cursor-pointer ${
                      userAvatar === av.url
                        ? "border-[#5865f2] ring-2 ring-[#5865f2]/40"
                        : "border-[#313338] hover:border-gray-500"
                    }`}
                  >
                    <img src={av.url} alt={av.name} className="w-12 h-12 rounded-lg" />
                    <span className="text-[10px] text-[#949ba4] font-medium truncate w-full text-center">
                      {av.name}
                    </span>
                    {userAvatar === av.url && (
                      <span className="absolute top-1 right-1 w-4 h-4 bg-[#5865f2] rounded-full flex items-center justify-center shadow">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Avatarı Sıfırla / Kaldır */}
              {userAvatar && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="w-full py-2 text-xs text-[#f23f43] hover:underline font-medium text-center"
                >
                  Avatarı Kaldır (Varsayılan Harfe Dön)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
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
