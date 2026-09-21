"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  useTracks,
  useParticipants,
  useLocalParticipant,
  useRoomContext,
  useChat,
  TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { Track, AudioPresets } from "livekit-client";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  Copy,
  Check,
  Users,
  Radio,
  Maximize,
  Minimize,
  Maximize2,
  Volume2,
  Shield,
  Loader2,
  MessageSquare,
  Send,
  X,
  Settings,
  Sparkles,
} from "lucide-react";
import { useKrispNoiseFilter } from "@livekit/components-react/krisp";


interface RoomContentProps {
  roomName: string;
  username: string;
}

function CustomRoomUI({ roomName, username }: RoomContentProps) {
  const router = useRouter();
  const room = useRoomContext();
  const participants = useParticipants();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } =
    useLocalParticipant();

  // Chat Integration
  const { chatMessages, send: sendChatMessage } = useChat();

  const [copied, setCopied] = useState<boolean>(false);
  const [selectedTrack, setSelectedTrack] = useState<TrackReferenceOrPlaceholder | null>(null);
  const [chatOpen, setChatOpen] = useState<boolean>(true);
  const [chatInput, setChatInput] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);

  // LiveKit Krisp AI Gürültü Engelleme Filtresi Hook'u
  const { isNoiseFilterEnabled, setNoiseFilterEnabled, isNoiseFilterPending } =
    useKrispNoiseFilter();

  const initialAutoEnableRef = useRef<boolean>(false);

  // Odaya girildiğinde ve mikrofon hazır olduğunda gürültü engelleme varsayılan AÇIK başlasın
  useEffect(() => {
    if (!initialAutoEnableRef.current && isMicrophoneEnabled && !isNoiseFilterPending) {
      initialAutoEnableRef.current = true;
      setNoiseFilterEnabled(true).catch((err) => {
        console.warn("Krisp AI Gürültü filtresi varsayılan olarak aktifleştirilirken uyarı:", err);
      });
    }
  }, [isMicrophoneEnabled, isNoiseFilterPending, setNoiseFilterEnabled]);

  const stageRef = useRef<HTMLDivElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auto scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatOpen]);

  // Fullscreen Listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);


  // Toggle Fullscreen on Stage
  const toggleFullscreen = () => {
    if (!stageRef.current) return;

    if (!document.fullscreenElement) {
      stageRef.current.requestFullscreen().catch((err) => {
        console.error("Tam ekran moduna geçilemedi:", err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.error("Tam ekrandan çıkılamadı:", err);
      });
    }
  };

  // Get camera and screen share tracks
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], {
    onlySubscribed: false,
  });

  // Automatically locate active screen share track
  const screenShareTrack = tracks.find(
    (t) => t.source === Track.Source.ScreenShare && t.publication?.isSubscribed !== false
  );

  // Focus mode track: explicit selection OR auto-focus active screen share
  const activeFocusTrack = selectedTrack || screenShareTrack || null;

  // Copy Invite Link to Clipboard
  const handleCopyInvite = useCallback(() => {
    if (typeof window === "undefined") return;
    const inviteUrl = `${window.location.origin}?room=${encodeURIComponent(roomName)}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }, [roomName]);

  // Audio / Video Controls
  const toggleMic = async () => {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (err) {
      console.error("Mikrofon değiştirilemedi:", err);
    }
  };

  const toggleCamera = async () => {
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch (err) {
      console.error("Kamera değiştirilemedi:", err);
    }
  };

  const toggleScreenShare = async () => {
    try {
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
    } catch (err) {
      console.error("Ekran paylaşımı değiştirilemedi:", err);
    }
  };

  const handleDisconnect = () => {
    room?.disconnect();
    router.push("/");
  };

  // Send Chat Message
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    try {
      await sendChatMessage(chatInput.trim());
      setChatInput("");
    } catch (err) {
      console.error("Mesaj gönderilemedi:", err);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#1e1f22] text-[#f2f3f5] overflow-hidden select-none">
      {/* ÜST DAVET VE ODA BARI */}
      <header className="h-16 bg-[#2b2d31] border-b border-[#1e1f22] px-6 flex items-center justify-between z-20 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#5865f2] rounded-xl flex items-center justify-center shadow">
            <Radio className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide">
              #{roomName}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Active Participants Badge */}
          <div className="flex items-center gap-2 bg-[#1e1f22] px-3.5 py-1.5 rounded-lg border border-[#313338] text-xs font-semibold text-[#949ba4]">
            <Users className="w-4 h-4 text-[#5865f2]" />
            <span>{participants.length} Katılımcı</span>
          </div>

          {/* Toggle Chat Button */}
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
              chatOpen
                ? "bg-[#5865f2] text-white border-[#5865f2]"
                : "bg-[#1e1f22] hover:bg-[#35373c] text-[#949ba4] border-[#313338]"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Sohbet</span>
            {chatMessages.length > 0 && (
              <span className="bg-[#f23f43] text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                {chatMessages.length}
              </span>
            )}
          </button>

          {/* Copy Invite Link Button */}
          <button
            onClick={handleCopyInvite}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow ${
              copied
                ? "bg-[#23a55a] text-white"
                : "bg-[#5865f2] hover:bg-[#4752c4] text-white active:scale-95"
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                <span>Kopyalandı!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Davet Linkini Kopyala</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* ORTA ALAN: ANA SAHNE, KATILIMCI GRID VE CANLI SOHBET */}
      <main className="flex-1 flex overflow-hidden p-4 gap-4 bg-[#1e1f22] relative">
        {/* Stage / Primary Focused View */}
        <div
          ref={stageRef}
          className="flex-1 bg-[#313338] border border-[#2b2d31] rounded-2xl overflow-hidden relative flex flex-col items-center justify-center shadow-xl group"
        >
          {activeFocusTrack && activeFocusTrack.publication ? (
            <div className="w-full h-full relative bg-black flex items-center justify-center">
              <VideoTrack
                trackRef={activeFocusTrack}
                className="w-full h-full object-contain"
              />

              {/* Focus Badge Info */}
              <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-xs text-white flex items-center gap-2">
                {activeFocusTrack.source === Track.Source.ScreenShare ? (
                  <>
                    <Monitor className="w-4 h-4 text-[#5865f2]" />
                    <span>
                      {activeFocusTrack.participant.identity} kullanıcısının ekranı
                    </span>
                  </>
                ) : (
                  <>
                    <VideoIcon className="w-4 h-4 text-[#23a55a]" />
                    <span>{activeFocusTrack.participant.identity} kamerasında</span>
                  </>
                )}
              </div>

              {/* Top Right Action Buttons (Tam Ekran & Reset Focus) */}
              <div className="absolute top-4 right-4 flex items-center gap-2">
                {/* Tam Ekran Yap Butonu */}
                <button
                  onClick={toggleFullscreen}
                  className="bg-black/60 hover:bg-black/80 backdrop-blur-md p-2 rounded-lg text-xs text-white transition-all border border-white/10 flex items-center gap-1.5 shadow"
                  title={isFullscreen ? "Tam Ekrandan Çık" : "Yayını Tam Ekran Yap"}
                >
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  <span className="hidden md:inline font-medium text-xs">
                    {isFullscreen ? "Küçült" : "Tam Ekran Yap"}
                  </span>
                </button>

                {/* Reset Focus Button */}
                {selectedTrack && (
                  <button
                    onClick={() => setSelectedTrack(null)}
                    className="bg-black/60 hover:bg-black/80 backdrop-blur-md p-2 rounded-lg text-xs text-white transition-all border border-white/10"
                    title="Odaktan Çık"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Empty or Audio-Only Stage View */
            <div className="flex flex-col items-center justify-center text-center p-8">
              <div className="w-24 h-24 bg-[#2b2d31] rounded-full flex items-center justify-center border border-[#404249] mb-4 shadow-inner">
                <Volume2 className="w-12 h-12 text-[#5865f2] animate-bounce" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                Sesli Odadasınız
              </h3>
              <p className="text-sm text-[#949ba4] max-w-sm mb-6">
                Biri ekran paylaşımı açtığında veya kamera çalıştırdığında yayın burada canlı olarak görüntülenecek.
              </p>

              {/* General Fullscreen Button even without video track */}
              <button
                onClick={toggleFullscreen}
                className="px-4 py-2 bg-[#2b2d31] hover:bg-[#35373c] border border-[#404249] rounded-xl text-xs font-semibold text-white flex items-center gap-2 transition-all"
              >
                {isFullscreen ? <Minimize className="w-4 h-4 text-[#5865f2]" /> : <Maximize className="w-4 h-4 text-[#5865f2]" />}
                <span>{isFullscreen ? "Tam Ekrandan Çık" : "Yayını Tam Ekran Yap"}</span>
              </button>
            </div>
          )}
        </div>

        {/* KATILIMCI GRID (Sağ Yan Panel) */}
        <div className="w-72 bg-[#2b2d31] border border-[#313338] rounded-2xl p-3 flex flex-col gap-3 overflow-y-auto">
          <div className="text-xs font-bold uppercase tracking-wider text-[#949ba4] px-2 pt-1 flex items-center justify-between">
            <span>Katılımcılar ({participants.length})</span>
            <Shield className="w-3.5 h-3.5 text-[#5865f2]" />
          </div>

          <div className="flex flex-col gap-2.5">
            {participants.map((p) => {
              const pTrack = tracks.find(
                (t) => t.participant.identity === p.identity && t.publication?.isSubscribed !== false
              );

              const isSpeaking = p.isSpeaking;

              return (
                <div
                  key={p.identity}
                  onClick={() => pTrack && setSelectedTrack(pTrack)}
                  className={`p-3 rounded-xl bg-[#313338] border transition-all flex items-center justify-between cursor-pointer hover:border-[#5865f2] ${
                    isSpeaking ? "ring-2 ring-[#23a55a] border-transparent" : "border-[#1e1f22]"
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="relative">
                      <div className="w-10 h-10 bg-[#5865f2] rounded-xl flex items-center justify-center text-white font-bold text-sm shadow">
                        {p.identity.slice(0, 2).toUpperCase()}
                      </div>
                      {isSpeaking && (
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#23a55a] rounded-full border-2 border-[#313338] flex items-center justify-center">
                          <Volume2 className="w-2.5 h-2.5 text-white" />
                        </span>
                      )}
                    </div>

                    <div className="truncate">
                      <p className="text-sm font-semibold text-white truncate">
                        {p.identity} {p.isLocal && "(Siz)"}
                      </p>
                      <p className="text-xs text-[#949ba4] flex items-center gap-1">
                        {p.isSpeaking ? (
                          <span className="text-[#23a55a]">Konuşuyor...</span>
                        ) : (
                          <span>Sessiz</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[#949ba4]">
                    {!p.isMicrophoneEnabled && <MicOff className="w-4 h-4 text-[#f23f43]" />}
                    {p.isScreenShareEnabled && <Monitor className="w-4 h-4 text-[#5865f2] animate-pulse" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CANLI MESAJLAŞMA PANELİ (Chat Drawer) */}
        {chatOpen && (
          <div className="w-80 bg-[#2b2d31] border border-[#313338] rounded-2xl flex flex-col overflow-hidden shadow-2xl transition-all">
            {/* Chat Header */}
            <div className="h-12 bg-[#313338] px-4 flex items-center justify-between border-b border-[#1e1f22]">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#5865f2]" />
                <h3 className="text-sm font-bold text-white">Oda Sohbeti</h3>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="text-[#949ba4] hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat Messages Area */}
            <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-[#2b2d31]">
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-[#949ba4] p-4">
                  <MessageSquare className="w-8 h-8 text-[#5865f2]/40 mb-2" />
                  <p className="text-xs font-semibold">Henüz mesaj yok</p>
                  <p className="text-[11px] text-[#949ba4]/70 mt-1">
                    İlk mesajı siz göndererek sohbeti başlatın.
                  </p>
                </div>
              ) : (
                chatMessages.map((msg, idx) => {
                  const senderName = msg.from?.identity || "Anonim";
                  const isMe = senderName === username;
                  const formattedTime = new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={idx}
                      className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[11px] font-bold text-white">
                          {senderName}
                        </span>
                        <span className="text-[10px] text-[#949ba4]">{formattedTime}</span>
                      </div>
                      <div
                        className={`p-2.5 rounded-xl text-xs max-w-[90%] break-words ${
                          isMe
                            ? "bg-[#5865f2] text-white rounded-tr-none"
                            : "bg-[#313338] text-[#f2f3f5] rounded-tl-none border border-[#1e1f22]"
                        }`}
                      >
                        {msg.message}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Chat Input Form */}
            <form
              onSubmit={handleSendChat}
              className="p-3 bg-[#313338] border-t border-[#1e1f22] flex items-center gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Mesaj yazın..."
                className="flex-1 bg-[#1e1f22] border border-[#2b2d31] focus:border-[#5865f2] px-3 py-2 rounded-xl text-xs text-white placeholder-[#949ba4] outline-none transition-all"
              />
              <button
                type="submit"
                className="p-2 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded-xl transition-all cursor-pointer shadow disabled:opacity-50"
                disabled={!chatInput.trim()}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </main>

      {/* ALT KONTROL BARI */}
      <footer className="h-20 bg-[#2b2d31] border-t border-[#1e1f22] px-6 flex items-center justify-between z-20">
        {/* Left identity info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#5865f2] rounded-xl flex items-center justify-center text-white font-bold">
            {username.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-bold text-white">{username}</p>
            <p className="text-xs text-[#23a55a]">Bağlandı</p>
          </div>
        </div>

        {/* Center Control Buttons */}
        <div className="flex items-center gap-3">
          {/* Microphone Toggle */}
          <button
            onClick={toggleMic}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow ${
              isMicrophoneEnabled
                ? "bg-[#313338] hover:bg-[#35373c] text-white border border-[#404249]"
                : "bg-[#f23f43] hover:bg-[#d8363a] text-white"
            }`}
            title={isMicrophoneEnabled ? "Mikrofonu Kapat" : "Mikrofonu Aç"}
          >
            {isMicrophoneEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>

          {/* Camera Toggle */}
          <button
            onClick={toggleCamera}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow ${
              isCameraEnabled
                ? "bg-[#5865f2] hover:bg-[#4752c4] text-white"
                : "bg-[#313338] hover:bg-[#35373c] text-white border border-[#404249]"
            }`}
            title={isCameraEnabled ? "Kamerayı Kapat" : "Kamerayı Aç"}
          >
            {isCameraEnabled ? <VideoIcon className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          {/* Screen Share Toggle */}
          <button
            onClick={toggleScreenShare}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow ${
              isScreenShareEnabled
                ? "bg-[#5865f2] hover:bg-[#4752c4] text-white"
                : "bg-[#313338] hover:bg-[#35373c] text-white border border-[#404249]"
            }`}
            title={isScreenShareEnabled ? "Ekran Paylaşımını Durdur" : "Ekran Paylaş"}
          >
            {isScreenShareEnabled ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow ${
              isFullscreen
                ? "bg-[#5865f2] hover:bg-[#4752c4] text-white"
                : "bg-[#313338] hover:bg-[#35373c] text-white border border-[#404249]"
            }`}
            title={isFullscreen ? "Tam Ekrandan Çık" : "Yayını Tam Ekran Yap"}
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow relative ${
              settingsOpen
                ? "bg-[#5865f2] hover:bg-[#4752c4] text-white"
                : "bg-[#313338] hover:bg-[#35373c] text-white border border-[#404249]"
            }`}
            title="Ses ve Görüşme Ayarları"
          >
            <Settings className="w-5 h-5" />
            {isNoiseFilterEnabled && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#23a55a] rounded-full border-2 border-[#2b2d31] flex items-center justify-center">
                <Sparkles className="w-2 h-2 text-white" />
              </span>
            )}
          </button>

          {/* Disconnect Button */}
          <button
            onClick={handleDisconnect}
            className="w-12 h-12 rounded-2xl bg-[#f23f43] hover:bg-[#d8363a] text-white flex items-center justify-center transition-all cursor-pointer shadow"
            title="Odadan Ayrıl"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>

        {/* Right empty spacer for clean symmetry */}
        <div className="hidden sm:block w-32" />
      </footer>

      {/* SES VE GÖRÜŞME AYARLARI MODAL */}
      {settingsOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#2b2d31] border border-[#383a40] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#1e1f22] border-b border-[#313338] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#5865f2]/20 rounded-xl flex items-center justify-center text-[#5865f2]">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-wide">Ses ve Görüşme Ayarları</h2>
                  <p className="text-xs text-[#949ba4]">Mikrofon ve filtre ayarlarınızı yapılandırın</p>
                </div>
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                className="p-1.5 rounded-xl text-[#949ba4] hover:text-white hover:bg-[#313338] transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-5">
              {/* Krisp AI Noise Filter Option */}
              <div className="bg-[#1e1f22] p-4 rounded-xl border border-[#313338] flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2.5 rounded-xl mt-0.5 transition-colors ${
                      isNoiseFilterEnabled
                        ? "bg-[#5865f2]/20 text-[#5865f2]"
                        : "bg-[#313338] text-[#949ba4]"
                    }`}
                  >
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">Yapay Zekâ Gürültü Filtresi</span>
                      <span className="bg-[#5865f2]/20 text-[#5865f2] text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-[#5865f2]/30">
                        Krisp AI
                      </span>
                    </div>
                    <p className="text-xs text-[#949ba4] mt-1 leading-relaxed">
                      Arka plandaki gürültüleri, klavye seslerini ve yankıyı otomatik olarak engeller.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={isNoiseFilterEnabled}
                    disabled={isNoiseFilterPending}
                    onChange={(e) => setNoiseFilterEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-[#313338] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5865f2] peer-disabled:opacity-50"></div>
                </label>
              </div>

              {/* Status Badge */}
              <div className="flex items-center justify-between px-3 py-2 bg-[#1e1f22]/50 rounded-lg text-xs">
                <span className="text-[#949ba4]">Filtre Durumu:</span>
                <span
                  className={`font-semibold ${
                    isNoiseFilterPending
                      ? "text-yellow-400"
                      : isNoiseFilterEnabled
                      ? "text-[#23a55a]"
                      : "text-[#f23f43]"
                  }`}
                >
                  {isNoiseFilterPending
                    ? "Değiştiriliyor..."
                    : isNoiseFilterEnabled
                    ? "✓ Aktif (Gürültü Engelleniyor)"
                    : "✗ Kapalı"}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-[#1e1f22] border-t border-[#313338] flex justify-end">
              <button
                onClick={() => setSettingsOpen(false)}
                className="px-5 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-bold rounded-xl transition-all shadow cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RoomContainer() {
  const params = useParams();
  const searchParams = useSearchParams();

  const roomName = (params?.roomName as string) || "";
  const username = searchParams.get("username") || "Misafir";

  const [token, setToken] = useState<string>("");
  const [wsUrl, setWsUrl] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchToken() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(
          `/api/token?room=${encodeURIComponent(roomName)}&username=${encodeURIComponent(username)}`
        );
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Token alma başarısız oldu.");
        }

        if (isMounted) {
          setToken(data.token);
          setWsUrl(data.wsUrl || process.env.NEXT_PUBLIC_LIVEKIT_URL || "");
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : "Bağlantı hatası oluştu.";
          setError(msg);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (roomName && username) {
      fetchToken();
    }

    return () => {
      isMounted = false;
    };
  }, [roomName, username]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1e1f22] flex flex-col items-center justify-center text-white gap-4">
        <Loader2 className="w-12 h-12 text-[#5865f2] animate-spin" />
        <h2 className="text-lg font-bold">Odaya Bağlanılıyor...</h2>
        <p className="text-sm text-[#949ba4]">
          #{roomName} odası için LiveKit token alınıyor.
        </p>
      </div>
    );
  }

  if (error || !token) {
    return (
      <div className="min-h-screen bg-[#1e1f22] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#313338] border border-[#f23f43]/40 p-6 rounded-2xl text-center shadow-2xl">
          <h2 className="text-xl font-bold text-[#f23f43] mb-2">Bağlantı Hatası</h2>
          <p className="text-sm text-[#949ba4] mb-6">{error || "Token üretilemedi."}</p>
          <a
            href="/"
            className="inline-block px-5 py-2.5 bg-[#5865f2] hover:bg-[#4752c4] text-white text-sm font-semibold rounded-xl transition-all"
          >
            Ana Sayfaya Dön
          </a>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      video={false}
      audio={{
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }}
      options={{
        publishDefaults: {
          audioPreset: AudioPresets.musicHighQuality,
        },
      }}
      token={token}
      serverUrl={wsUrl}
      data-lk-theme="default"
      className="h-screen w-screen"
    >
      <CustomRoomUI roomName={roomName} username={username} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

export default function RoomPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#1e1f22] flex items-center justify-center text-white">
          <Loader2 className="w-10 h-10 text-[#5865f2] animate-spin" />
        </div>
      }
    >
      <RoomContainer />
    </Suspense>
  );
}
