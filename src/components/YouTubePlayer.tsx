"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Room, RoomEvent, Participant } from "livekit-client";
import {
  YouTubeTrack,
  YouTubePlaybackState,
  YouTubeSyncMessage,
  YouTubeActionType,
} from "@/types/youtube";
import {
  DEFAULT_YOUTUBE_TRACKS,
  formatDuration,
  searchYouTubeVideos,
} from "@/lib/youtube";
import {
  Play,
  Pause,
  SkipForward,
  Volume2,
  VolumeX,
  Search,
  ListMusic,
  X,
  Plus,
  Trash2,
  ThumbsUp,
  Sparkles,
  Loader2,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Radio,
  Tv,
} from "lucide-react";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YouTubePlayerProps {
  room: Room | null;
  currentUser: { identity: string; name: string };
  isDrawerOpen: boolean;
  onCloseDrawer: () => void;
  onToggleDrawer: () => void;
  participants: Participant[];
}

export function YouTubePlayer({
  room,
  currentUser,
  isDrawerOpen,
  onCloseDrawer,
  onToggleDrawer,
  participants,
}: YouTubePlayerProps) {
  // Oda İçi Oynatma Durumu (LiveKit ile Senkron)
  const [playbackState, setPlaybackState] = useState<YouTubePlaybackState>({
    currentTrack: DEFAULT_YOUTUBE_TRACKS[0],
    isPlaying: false,
    positionMs: 0,
    durationMs: DEFAULT_YOUTUBE_TRACKS[0].durationMs,
    lastUpdated: Date.now(),
    djIdentity: null,
    djName: null,
    queue: [DEFAULT_YOUTUBE_TRACKS[1], DEFAULT_YOUTUBE_TRACKS[2]],
    voteSkips: [],
  });

  // Kullanıcı Ses ve Ducking Ayarları
  const [volume, setVolume] = useState<number>(80);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [audioDuckingEnabled, setAudioDuckingEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("voxa_audio_ducking");
      return saved === "true"; // Varsayılan olarak kapalı (kullanıcıyı rahatsız etmez)
    }
    return false;
  });
  const [duckingFactor] = useState<number>(0.25);
  const [isDuckingActive, setIsDuckingActive] = useState<boolean>(false);
  const [showVideoPreview, setShowVideoPreview] = useState<boolean>(false);

  const toggleAudioDucking = () => {
    setAudioDuckingEnabled((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("voxa_audio_ducking", String(next));
      }
      return next;
    });
  };

  // Arama & Sekme Yönetimi
  const [activeTab, setActiveTab] = useState<"search" | "queue" | "video">("search");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<YouTubeTrack[]>(DEFAULT_YOUTUBE_TRACKS);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // YouTube IFrame Player Örneği
  const ytPlayerRef = useRef<any>(null);
  const [isYTReady, setIsYTReady] = useState<boolean>(false);
  const playerContainerId = "voxa-youtube-iframe-player";

  // State ref (Event dinleyicilerinde taze state'e erişmek için)
  const stateRef = useRef<YouTubePlaybackState>(playbackState);
  stateRef.current = playbackState;

  // WebRTC / LiveKit geçici bağlantı hatalarını konsolu kirletmeden yakala
  useEffect(() => {
    const handleRejection = (e: PromiseRejectionEvent) => {
      if (
        e.reason?.message?.includes("PC manager is closed") ||
        e.reason?.name === "UnexpectedConnectionState" ||
        e.reason?.message?.includes("cannot negotiate on closed engine")
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", handleRejection);
    return () => window.removeEventListener("unhandledrejection", handleRejection);
  }, []);

  // 1. YouTube IFrame API Script'ini Yükle ve Player'ı Başlat
  useEffect(() => {
    if (typeof window === "undefined") return;

    let isMounted = true;

    const initPlayer = () => {
      if (!window.YT || !window.YT.Player) return;

      try {
        if (ytPlayerRef.current) {
          try {
            ytPlayerRef.current.destroy();
          } catch {}
        }

        ytPlayerRef.current = new window.YT.Player(playerContainerId, {
          height: "100%",
          width: "100%",
          videoId: stateRef.current.currentTrack?.id || DEFAULT_YOUTUBE_TRACKS[0].id,
          playerVars: {
            autoplay: 0,
            controls: 1,
            disablekb: 0,
            enablejsapi: 1,
            fs: 1,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: (event: any) => {
              if (!isMounted) return;
              setIsYTReady(true);
              const targetVol = isMuted ? 0 : volume;
              event.target.setVolume(targetVol);
            },
            onStateChange: (event: any) => {
              if (!isMounted) return;
              // 0 = YT.PlayerState.ENDED
              if (event.data === 0) {
                // Şarkı bittiğinde sıradakine geç
                handleSkipNext();
              }
            },
            onError: (err: any) => {
              console.warn("YouTube Player uyarısı (örn: embed engelli parça):", err);
            },
          },
        });
      } catch (err) {
        console.error("YouTube Player init hatası:", err);
      }
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = () => {
        initPlayer();
      };

      if (!document.getElementById("youtube-iframe-api-script")) {
        const tag = document.createElement("script");
        tag.id = "youtube-iframe-api-script";
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName("script")[0];
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      }
    }

    return () => {
      isMounted = false;
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy();
        } catch {}
      }
    };
  }, []);

  // 2. Audio Ducking (Odada biri konuşurken müziğin sesini kıs)
  useEffect(() => {
    if (!audioDuckingEnabled) {
      setIsDuckingActive(false);
      return;
    }

    const isSomeoneSpeaking = participants.some((p) => p.isSpeaking);

    if (isSomeoneSpeaking) {
      setIsDuckingActive(true);
    } else {
      const timeout = setTimeout(() => {
        setIsDuckingActive(false);
      }, 700);
      return () => clearTimeout(timeout);
    }
  }, [participants, audioDuckingEnabled]);

  // 3. YouTube Player Ses Düzeyi ve Ducking Ayarı
  useEffect(() => {
    if (!ytPlayerRef.current || !isYTReady) return;
    try {
      const effectiveVol = isMuted
        ? 0
        : isDuckingActive
        ? Math.round(volume * duckingFactor)
        : volume;
      ytPlayerRef.current.setVolume(effectiveVol);
    } catch {}
  }, [volume, isMuted, isDuckingActive, duckingFactor, isYTReady]);

  // 4. LiveKit DataChannel Mesaj Yayınlama
  const broadcastSync = useCallback(
    (action: YouTubeActionType, payload?: Partial<YouTubeSyncMessage>) => {
      if (!room || !room.localParticipant) return;
      if (room.state !== "connected") return;
      if ((room as any).isClosed) return;

      try {
        const message: YouTubeSyncMessage = {
          type: action,
          sentAt: Date.now(),
          senderIdentity: currentUser.identity,
          senderName: currentUser.name,
          ...payload,
        };
        const encoded = new TextEncoder().encode(JSON.stringify(message));
        const res = room.localParticipant.publishData(encoded, { reliable: true });
        if (res && typeof res.catch === "function") {
          res.catch(() => {});
        }
      } catch (err) {
        // Silently catch
      }
    },
    [room, currentUser]
  );

  // 5. Oynatma Yardımcısı (Yerel YouTube IFrame Kontrolü)
  const applyLocalPlay = useCallback(
    (track: YouTubeTrack | null, posMs = 0) => {
      if (!track || !ytPlayerRef.current || !isYTReady) return;

      try {
        const player = ytPlayerRef.current;
        const currentVideoUrl = player.getVideoUrl ? player.getVideoUrl() : "";

        // Eğer farklı video ise veya henüz yüklenmediyse
        if (!currentVideoUrl.includes(track.id)) {
          player.loadVideoById({
            videoId: track.id,
            startSeconds: Math.floor(posMs / 1000),
          });
        } else {
          player.seekTo(posMs / 1000, true);
          player.playVideo();
        }
      } catch (err) {
        console.warn("applyLocalPlay hatası:", err);
      }
    },
    [isYTReady]
  );

  const applyLocalPause = useCallback(() => {
    if (!ytPlayerRef.current || !isYTReady) return;
    try {
      ytPlayerRef.current.pauseVideo();
    } catch {}
  }, [isYTReady]);

  const applyLocalSeek = useCallback(
    (posMs: number) => {
      if (!ytPlayerRef.current || !isYTReady) return;
      try {
        ytPlayerRef.current.seekTo(posMs / 1000, true);
      } catch {}
    },
    [isYTReady]
  );

  // 6. DataChannel Mesaj Dinleyicisi (Odadaki diğer kullanıcılardan gelen komutlar)
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array, participant?: Participant) => {
      try {
        const text = new TextDecoder().decode(payload);
        if (!text.startsWith('{"type":"VOXA_YT_')) return;
        const msg = JSON.parse(text) as YouTubeSyncMessage;

        const networkDelayMs = Math.max(0, (Date.now() - msg.sentAt) / 2);

        switch (msg.type) {
          case "VOXA_YT_PLAY": {
            const track = msg.track || stateRef.current.currentTrack;
            const pos = (msg.positionMs || 0) + networkDelayMs;
            setPlaybackState((prev) => ({
              ...prev,
              currentTrack: track,
              isPlaying: true,
              positionMs: pos,
              durationMs: track?.durationMs || prev.durationMs,
              lastUpdated: Date.now(),
              djIdentity: msg.senderIdentity,
              djName: msg.senderName,
            }));
            applyLocalPlay(track, pos);
            break;
          }

          case "VOXA_YT_PAUSE": {
            setPlaybackState((prev) => ({
              ...prev,
              isPlaying: false,
              positionMs: msg.positionMs ?? prev.positionMs,
              lastUpdated: Date.now(),
            }));
            applyLocalPause();
            break;
          }

          case "VOXA_YT_SEEK": {
            const targetPos = (msg.positionMs || 0) + networkDelayMs;
            setPlaybackState((prev) => ({
              ...prev,
              positionMs: targetPos,
              lastUpdated: Date.now(),
            }));
            applyLocalSeek(targetPos);
            break;
          }

          case "VOXA_YT_QUEUE_ADD": {
            if (msg.track) {
              const newTrack = msg.track;
              setPlaybackState((prev) => ({
                ...prev,
                queue: [...prev.queue, newTrack],
              }));
            }
            break;
          }

          case "VOXA_YT_QUEUE_REMOVE": {
            if (msg.trackId) {
              setPlaybackState((prev) => ({
                ...prev,
                queue: prev.queue.filter((t) => t.id !== msg.trackId),
              }));
            }
            break;
          }

          case "VOXA_YT_SKIP": {
            setPlaybackState((prev) => {
              const nextQueue = [...prev.queue];
              const nextTrack = nextQueue.shift() || null;
              if (nextTrack) {
                applyLocalPlay(nextTrack, 0);
              } else {
                applyLocalPause();
              }
              return {
                ...prev,
                currentTrack: nextTrack,
                queue: nextQueue,
                positionMs: 0,
                durationMs: nextTrack?.durationMs || 0,
                isPlaying: !!nextTrack,
                voteSkips: [],
              };
            });
            break;
          }

          case "VOXA_YT_VOTE_SKIP": {
            setPlaybackState((prev) => {
              const voters = new Set(prev.voteSkips);
              voters.add(msg.senderIdentity);
              const voteArray = Array.from(voters);

              const reqVotes = Math.max(1, Math.ceil(participants.length / 2));
              if (voteArray.length >= reqVotes) {
                setTimeout(() => {
                  handleSkipNext();
                }, 300);
              }

              return {
                ...prev,
                voteSkips: voteArray,
              };
            });
            break;
          }

          case "VOXA_YT_SYNC_REQ": {
            if (
              stateRef.current.djIdentity === currentUser.identity ||
              !stateRef.current.djIdentity
            ) {
              const current = stateRef.current;
              broadcastSync("VOXA_YT_SYNC_STATE", {
                state: {
                  currentTrack: current.currentTrack,
                  isPlaying: current.isPlaying,
                  positionMs: current.positionMs,
                  durationMs: current.durationMs,
                  queue: current.queue,
                  voteSkips: current.voteSkips,
                },
              });
            }
            break;
          }

          case "VOXA_YT_SYNC_STATE": {
            if (msg.state) {
              setPlaybackState((prev) => ({
                ...prev,
                ...msg.state,
                lastUpdated: Date.now(),
              }));
              if (msg.state.currentTrack) {
                if (msg.state.isPlaying) {
                  applyLocalPlay(msg.state.currentTrack, msg.state.positionMs || 0);
                } else {
                  applyLocalSeek(msg.state.positionMs || 0);
                  applyLocalPause();
                }
              }
            }
            break;
          }
        }
      } catch {}
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);

    // Odaya girildiğinde mevcut müzik durumunu sor
    let syncTimer: any = setTimeout(() => {
      if (room && room.state === "connected" && !(room as any).isClosed) {
        broadcastSync("VOXA_YT_SYNC_REQ");
      }
    }, 800);

    return () => {
      if (syncTimer) clearTimeout(syncTimer);
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, broadcastSync, applyLocalPlay, applyLocalPause, applyLocalSeek, participants.length]);

  // 7. Süre Sayacı & İlerleme Takibi (500ms ticker)
  useEffect(() => {
    let interval: any = null;
    if (playbackState.isPlaying) {
      interval = setInterval(() => {
        // Gerçek YouTube player'dan anlık süreyi oku
        if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === "function") {
          try {
            const currentSeconds = ytPlayerRef.current.getCurrentTime();
            const currentDuration = ytPlayerRef.current.getDuration();
            if (currentSeconds && isFinite(currentSeconds)) {
              const posMs = Math.floor(currentSeconds * 1000);
              const durMs = currentDuration && isFinite(currentDuration) ? Math.floor(currentDuration * 1000) : playbackState.durationMs;

              setPlaybackState((prev) => ({
                ...prev,
                positionMs: posMs,
                durationMs: durMs > 0 ? durMs : prev.durationMs,
              }));
              return;
            }
          } catch {}
        }

        // Ticker fallback
        setPlaybackState((prev) => {
          if (!prev.isPlaying || !prev.currentTrack) return prev;
          const nextPos = prev.positionMs + 500;
          return {
            ...prev,
            positionMs: nextPos,
          };
        });
      }, 500);
    }
    return () => clearInterval(interval);
  }, [playbackState.isPlaying]);

  // 8. Kullanıcı Etkileşim Fonksiyonları
  const handlePlayPause = () => {
    if (!playbackState.currentTrack && playbackState.queue.length > 0) {
      const first = playbackState.queue[0];
      handlePlayTrack(first);
      return;
    }

    if (playbackState.isPlaying) {
      setPlaybackState((prev) => ({ ...prev, isPlaying: false }));
      applyLocalPause();
      broadcastSync("VOXA_YT_PAUSE", {
        positionMs: playbackState.positionMs,
      });
    } else {
      setPlaybackState((prev) => ({
        ...prev,
        isPlaying: true,
        djIdentity: currentUser.identity,
        djName: currentUser.name,
      }));
      applyLocalPlay(playbackState.currentTrack, playbackState.positionMs);
      broadcastSync("VOXA_YT_PLAY", {
        track: playbackState.currentTrack || undefined,
        positionMs: playbackState.positionMs,
      });
    }
  };

  const handlePlayTrack = (track: YouTubeTrack) => {
    const trackWithMeta = {
      ...track,
      addedBy: currentUser.name,
      addedAt: Date.now(),
    };

    setPlaybackState((prev) => ({
      ...prev,
      currentTrack: trackWithMeta,
      isPlaying: true,
      positionMs: 0,
      durationMs: track.durationMs,
      djIdentity: currentUser.identity,
      djName: currentUser.name,
      voteSkips: [],
    }));

    applyLocalPlay(trackWithMeta, 0);

    broadcastSync("VOXA_YT_PLAY", {
      track: trackWithMeta,
      positionMs: 0,
    });
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!playbackState.currentTrack || playbackState.durationMs <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newPos = Math.floor(percentage * playbackState.durationMs);

    setPlaybackState((prev) => ({ ...prev, positionMs: newPos }));
    applyLocalSeek(newPos);

    broadcastSync("VOXA_YT_SEEK", { positionMs: newPos });
  };

  const handleSkipNext = () => {
    const nextQueue = [...playbackState.queue];
    const nextTrack = nextQueue.shift() || null;

    setPlaybackState((prev) => ({
      ...prev,
      currentTrack: nextTrack,
      queue: nextQueue,
      positionMs: 0,
      durationMs: nextTrack?.durationMs || 0,
      isPlaying: !!nextTrack,
      voteSkips: [],
    }));

    if (nextTrack) {
      applyLocalPlay(nextTrack, 0);
    } else {
      applyLocalPause();
    }

    broadcastSync("VOXA_YT_SKIP");
  };

  const handleVoteToSkip = () => {
    const voters = new Set(playbackState.voteSkips);
    if (voters.has(currentUser.identity)) {
      voters.delete(currentUser.identity);
    } else {
      voters.add(currentUser.identity);
    }
    const voteArray = Array.from(voters);
    setPlaybackState((prev) => ({ ...prev, voteSkips: voteArray }));

    broadcastSync("VOXA_YT_VOTE_SKIP");

    const reqVotes = Math.max(1, Math.ceil(participants.length / 2));
    if (voteArray.length >= reqVotes) {
      setTimeout(() => {
        handleSkipNext();
      }, 200);
    }
  };

  const handleAddToQueue = (track: YouTubeTrack) => {
    const item: YouTubeTrack = {
      ...track,
      addedBy: currentUser.name,
      addedAt: Date.now(),
    };

    setPlaybackState((prev) => ({
      ...prev,
      queue: [...prev.queue, item],
    }));

    broadcastSync("VOXA_YT_QUEUE_ADD", { track: item });
  };

  const handleRemoveFromQueue = (trackId: string) => {
    setPlaybackState((prev) => ({
      ...prev,
      queue: prev.queue.filter((t) => t.id !== trackId),
    }));

    broadcastSync("VOXA_YT_QUEUE_REMOVE", { trackId });
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults(DEFAULT_YOUTUBE_TRACKS);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchYouTubeVideos(query);
      setSearchResults(results);
    } finally {
      setIsSearching(false);
    }
  };

  const currentTrack = playbackState.currentTrack;
  const progressPercent =
    playbackState.durationMs > 0
      ? Math.min(100, (playbackState.positionMs / playbackState.durationMs) * 100)
      : 0;

  const requiredVotes = Math.max(1, Math.ceil(participants.length / 2));
  const hasVoted = playbackState.voteSkips.includes(currentUser.identity);

  return (
    <>
      {/* Yüzen Video Önizleme Penceresi (Arama ekranı kapalı olsa bile izlenebilir) */}
      <div
        className={`fixed transition-all duration-300 z-50 ${
          showVideoPreview
            ? "bottom-24 right-6 w-80 sm:w-96 aspect-video rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-black flex flex-col group animate-in fade-in zoom-in-95 duration-200"
            : "top-[-9999px] left-[-9999px] w-1 h-1 opacity-0 pointer-events-none"
        }`}
      >
        {/* Video Başlık & Kapatma Butonu (Hover olunca görünür) */}
        {showVideoPreview && (
          <div className="absolute top-0 inset-x-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent p-2.5 z-10 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[11px] font-bold text-white truncate max-w-[240px] drop-shadow">
              {currentTrack?.title || "YouTube Videosu"}
            </span>
            <button
              onClick={() => setShowVideoPreview(false)}
              className="p-1 rounded-lg bg-black/60 hover:bg-red-600 text-white transition-colors cursor-pointer"
              title="Video Penceresini Kapat"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div id={playerContainerId} className="w-full h-full" />
      </div>

      {/* 1. ALT BARA ENTEGRE GENİŞLETİLMİŞ MİNİ OYNATICI */}
      <div className="flex items-center gap-2 sm:gap-3 bg-[#1e1f22] hover:bg-[#232529] border border-[#383a40] rounded-2xl px-3 sm:px-4 py-2 shadow-lg transition-all select-none w-full max-w-[340px] sm:max-w-[440px] md:max-w-[520px] lg:max-w-[560px]">
        {/* Thumbnail & Oynatma Efekti */}
        <div
          onClick={onToggleDrawer}
          className="relative w-10 h-10 rounded-xl overflow-hidden bg-[#2b2d31] shrink-0 border border-white/10 shadow cursor-pointer group"
          title="YouTube Müzik Panelini Aç"
        >
          {currentTrack?.thumbnail ? (
            <img
              src={currentTrack.thumbnail}
              alt={currentTrack.title}
              className={`w-full h-full object-cover transition-transform duration-700 ${
                playbackState.isPlaying ? "scale-105" : "grayscale"
              }`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-red-500">
              <Radio className={`w-5 h-5 ${playbackState.isPlaying ? "animate-pulse" : ""}`} />
            </div>
          )}
          {playbackState.isPlaying && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-0.5">
              <span className="w-0.5 h-2.5 bg-red-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-0.5 h-3.5 bg-red-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-0.5 h-2 bg-red-500 rounded-full animate-bounce" />
            </div>
          )}
        </div>

        {/* Video / Şarkı Bilgisi & İlerleme Çubuğu */}
        <div className="min-w-0 flex-1 flex flex-col justify-center cursor-pointer" onClick={onToggleDrawer}>
          <div className="flex items-center justify-between gap-1">
            <span className="text-[12px] font-bold text-white truncate max-w-[120px] sm:max-w-[170px]" title={currentTrack?.title}>
              {currentTrack?.title || "Şarkı Seçilmedi"}
            </span>
            <span className="text-[10px] font-mono text-[#a1a1aa] shrink-0">
              {formatDuration(playbackState.positionMs)} / {formatDuration(playbackState.durationMs)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-1 text-[10px] text-[#949ba4]">
            <span className="truncate max-w-[130px] sm:max-w-[180px]">
              {currentTrack?.channelTitle || "YouTube"}
            </span>
            {isDuckingActive && audioDuckingEnabled && (
              <span className="text-[9px] text-amber-400 font-semibold flex items-center gap-0.5 shrink-0 animate-pulse">
                <Mic className="w-2.5 h-2.5" /> Kısıldı
              </span>
            )}
          </div>
          {/* İlerleme Çubuğu */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleSeek(e);
            }}
            className="w-full h-1 bg-[#404249] hover:h-1.5 rounded-full cursor-pointer relative overflow-hidden mt-1 transition-all"
            title="Süre sarma"
          >
            <div
              className="h-full bg-red-500 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Oynatma Kontrolleri */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Oynat / Durdur */}
          <button
            onClick={handlePlayPause}
            className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center transition-transform shadow cursor-pointer active:scale-95"
            title={playbackState.isPlaying ? "Durdur" : "Oynat"}
          >
            {playbackState.isPlaying ? (
              <Pause className="w-4 h-4 fill-white" />
            ) : (
              <Play className="w-4 h-4 fill-white ml-0.5" />
            )}
          </button>

          {/* Sonraki Parça */}
          <button
            onClick={handleSkipNext}
            className="p-1.5 text-[#949ba4] hover:text-white transition-colors cursor-pointer"
            title="Sonraki Parçaya Geç"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Oylamayla Geçme (Vote to Skip) */}
          <button
            onClick={handleVoteToSkip}
            className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5 transition-all border ${
              hasVoted
                ? "bg-red-600 text-white border-red-500"
                : "bg-white/5 hover:bg-white/10 text-[#949ba4] border-white/5"
            }`}
            title="Şarkıyı geçmek için oy ver (%50 çoğunluk)"
          >
            <ThumbsUp className="w-2.5 h-2.5" />
            <span>{playbackState.voteSkips.length}/{requiredVotes}</span>
          </button>
        </div>

        {/* Doğrudan Ses Düzeyi Kaydırıcısı (Mini Oynatıcı Üzerinde) */}
        <div className="hidden sm:flex items-center gap-1.5 shrink-0 pl-1.5 border-l border-white/10">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="text-[#949ba4] hover:text-white transition-colors p-1 cursor-pointer"
            title={isMuted ? "Sesi Aç" : "Sesi Kapat"}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-red-500" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="100"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              setVolume(parseInt(e.target.value, 10));
              if (isMuted) setIsMuted(false);
            }}
            className="w-16 md:w-20 h-1.5 bg-[#404249] rounded-lg appearance-none cursor-pointer accent-red-500"
            title={`Müzik Sesi: %${isMuted ? 0 : volume}`}
          />
          <span className="text-[10px] font-mono text-[#a1a1aa] w-6 text-right">
            %{isMuted ? 0 : volume}
          </span>
        </div>

        {/* Konuşurken Sesi Kısma (Audio Ducking) Aç/Kapa Hızlı Butonu */}
        <button
          onClick={toggleAudioDucking}
          className={`p-1.5 rounded-xl transition-all cursor-pointer hidden md:flex items-center shrink-0 ${
            audioDuckingEnabled
              ? "text-amber-400 bg-amber-400/15"
              : "text-[#71717a] hover:text-[#a1a1aa] hover:bg-white/5"
          }`}
          title={
            audioDuckingEnabled
              ? "Konuşurken Otomatik Ses Kısma: AÇIK (Kapatmak için tıkla)"
              : "Konuşurken Otomatik Ses Kısma: KAPALI (Açmak için tıkla)"
          }
        >
          {audioDuckingEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
        </button>

        {/* Yüzen Video Penceresini Aç/Kapat Butonu */}
        <button
          onClick={() => setShowVideoPreview(!showVideoPreview)}
          className={`p-1.5 rounded-xl transition-all cursor-pointer hidden sm:flex items-center shrink-0 ${
            showVideoPreview
              ? "text-red-500 bg-red-500/15"
              : "text-[#71717a] hover:text-white hover:bg-white/5"
          }`}
          title={showVideoPreview ? "Video Penceresini Gizle" : "Video Penceresini Göster"}
        >
          {showVideoPreview ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
        </button>

        {/* Çekmeceyi Aç Butonu */}
        <button
          onClick={onToggleDrawer}
          className={`p-1.5 sm:p-2 rounded-xl transition-all cursor-pointer shrink-0 ${
            isDrawerOpen ? "bg-red-600 text-white" : "text-[#949ba4] hover:text-white hover:bg-white/5"
          }`}
          title="Şarkı Arama ve Kuyruk Paneli"
        >
          <ListMusic className="w-4 h-4" />
        </button>
      </div>

      {/* 2. TAM DETAYLI YOUTUBE JAM PANELİ (DRAWER / MODAL) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-[#121212] border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-2xl h-[85vh] sm:h-[640px] flex flex-col shadow-2xl overflow-hidden text-white">
            {/* Modal Başlığı (Sade ve Minimalist) */}
            <div className="px-6 py-4 bg-[#18181b] border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500">
                  <Tv className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white tracking-wide">
                  YouTube Jam
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {/* Konuşurken Sesi Kısma Ayarı Butonu */}
                <button
                  onClick={toggleAudioDucking}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    audioDuckingEnabled
                      ? "bg-amber-400/15 text-amber-300 border-amber-400/30"
                      : "bg-white/5 hover:bg-white/10 text-[#a1a1aa] border-white/5"
                  }`}
                  title="Odada biri konuşurken müziğin sesini otomatik kıs"
                >
                  {audioDuckingEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">
                    {audioDuckingEnabled ? "Konuşma Kısması Açık" : "Konuşma Kısması Kapalı"}
                  </span>
                </button>

                {/* Video Önizleme Aç/Kapa Butonu */}
                <button
                  onClick={() => setShowVideoPreview(!showVideoPreview)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    showVideoPreview
                      ? "bg-red-600/20 text-red-400 border-red-500/30"
                      : "bg-white/5 hover:bg-white/10 text-[#a1a1aa] border-white/5"
                  }`}
                  title={showVideoPreview ? "Videoyu Gizle" : "Videoyu Göster"}
                >
                  {showVideoPreview ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{showVideoPreview ? "Video Açık" : "Video Kapalı"}</span>
                </button>

                <button
                  onClick={onCloseDrawer}
                  className="p-1.5 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Sekme Butonları */}
            <div className="px-6 pt-3 bg-[#18181b] border-b border-white/5 flex gap-4 text-xs font-semibold">
              <button
                onClick={() => setActiveTab("search")}
                className={`pb-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                  activeTab === "search"
                    ? "border-red-500 text-white font-bold"
                    : "border-transparent text-[#a1a1aa] hover:text-white"
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>Şarkı & Video Ara</span>
              </button>

              <button
                onClick={() => setActiveTab("queue")}
                className={`pb-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                  activeTab === "queue"
                    ? "border-red-500 text-white font-bold"
                    : "border-transparent text-[#a1a1aa] hover:text-white"
                }`}
              >
                <ListMusic className="w-3.5 h-3.5" />
                <span>Ortak Kuyruk ({playbackState.queue.length})</span>
              </button>
            </div>

            {/* SEKME 1: YOUTUBE ŞARKI VE VİDEO ARAMA */}
            {activeTab === "search" && (
              <div className="flex-1 flex flex-col p-6 overflow-hidden">
                {/* Arama Inputu */}
                <div className="relative mb-4">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#71717a]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="YouTube'da şarkı, sanatçı veya video ara..."
                    className="w-full bg-[#1e1e24] border border-white/10 rounded-2xl pl-10 pr-10 py-3 text-xs text-white placeholder-[#71717a] focus:outline-none focus:border-red-500 transition-colors"
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500 animate-spin" />
                  )}
                  {searchQuery && !isSearching && (
                    <button
                      onClick={() => handleSearch("")}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Arama Sonuçları Listesi */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {searchResults.map((track) => (
                    <div
                      key={track.id}
                      className="p-3 bg-[#18181b]/60 hover:bg-[#1e1e24] border border-white/5 rounded-2xl flex items-center justify-between gap-3 group transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={track.thumbnail}
                          alt={track.title}
                          className="w-12 h-10 rounded-lg object-cover bg-black/40 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate group-hover:text-red-400 transition-colors">
                            {track.title}
                          </p>
                          <p className="text-[11px] text-[#a1a1aa] truncate">
                            {track.channelTitle}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-[#71717a] font-mono mr-1">
                          {track.durationFormatted || formatDuration(track.durationMs)}
                        </span>

                        <button
                          onClick={() => handlePlayTrack(track)}
                          className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow active:scale-95 cursor-pointer"
                          title="Hemen Odada Çal"
                        >
                          <Play className="w-3 h-3 fill-white" />
                          <span>Çal</span>
                        </button>

                        <button
                          onClick={() => handleAddToQueue(track)}
                          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/5 transition-all active:scale-95 cursor-pointer"
                          title="Sıraya Ekle"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SEKME 2: ORTAK KUYRUK */}
            {activeTab === "queue" && (
              <div className="flex-1 flex flex-col p-6 overflow-hidden">
                {/* Şu An Çalıyor Bilgisi */}
                <div className="p-4 bg-[#18181b] border border-white/10 rounded-2xl mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={currentTrack?.thumbnail}
                      alt=""
                      className="w-12 h-10 rounded-lg object-cover"
                    />
                    <div className="min-w-0">
                      <span className="text-[10px] font-extrabold uppercase text-red-500">
                        Şu An Çalıyor
                      </span>
                      <h4 className="text-xs font-bold text-white truncate">{currentTrack?.title}</h4>
                      <p className="text-[11px] text-[#a1a1aa] truncate">{currentTrack?.channelTitle}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-mono text-[#a1a1aa]">
                      DJ: {playbackState.djName || "Oda"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-[#a1a1aa] uppercase tracking-wider">
                    Sırada Bekleyenler ({playbackState.queue.length})
                  </h4>
                  {playbackState.queue.length > 0 && (
                    <button
                      onClick={() => setPlaybackState((prev) => ({ ...prev, queue: [] }))}
                      className="text-[11px] text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                    >
                      Kuyruğu Temizle
                    </button>
                  )}
                </div>

                {playbackState.queue.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-[#71717a]">
                    <ListMusic className="w-12 h-12 stroke-[1.5] mb-2 opacity-40" />
                    <p className="text-xs font-semibold text-[#a1a1aa]">Kuyrukta şarkı bulunmuyor</p>
                    <p className="text-[11px] mt-1">"Şarkı & Video Ara" sekmesinden yeni parçalar ekleyebilirsiniz.</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {playbackState.queue.map((track, idx) => (
                      <div
                        key={`${track.id}-${idx}`}
                        className="p-2.5 bg-[#18181b]/50 hover:bg-[#1e1e24] border border-white/5 rounded-xl flex items-center justify-between gap-3 group transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-bold text-[#71717a] w-4 text-center">
                            {idx + 1}
                          </span>
                          <img
                            src={track.thumbnail}
                            alt=""
                            className="w-10 h-8 rounded-lg object-cover"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{track.title}</p>
                            <p className="text-[11px] text-[#a1a1aa] truncate">
                              {track.channelTitle} {track.addedBy && `• Ekleyen: ${track.addedBy}`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] text-[#71717a] font-mono">
                            {track.durationFormatted || formatDuration(track.durationMs)}
                          </span>
                          <button
                            onClick={() => handleRemoveFromQueue(track.id)}
                            className="p-1.5 text-[#71717a] hover:text-red-400 transition-colors cursor-pointer"
                            title="Kuyruktan Kaldır"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

