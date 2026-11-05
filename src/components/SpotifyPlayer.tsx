"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Room, RoomEvent, Participant } from "livekit-client";
import {
  SpotifyTrack,
  SpotifyPlaybackState,
  SpotifySyncMessage,
  SpotifyAudioMode,
  SpotifyActionType,
} from "@/types/spotify";
import {
  CURATED_TRACKS,
  formatDuration,
  searchSpotifyTracks,
  getStoredSpotifyToken,
  storeSpotifyToken,
  clearStoredSpotifyToken,
  createSpotifyAuthUrl,
  DEFAULT_SPOTIFY_CLIENT_ID,
} from "@/lib/spotify";
import {
  Music,
  Play,
  Pause,
  SkipForward,
  Volume2,
  VolumeX,
  Search,
  ListMusic,
  Settings,
  X,
  Plus,
  Trash2,
  ThumbsUp,
  Headphones,
  Radio,
  ExternalLink,
  Sparkles,
  Loader2,
  Check,
  Disc,
  Mic,
} from "lucide-react";

interface SpotifyPlayerProps {
  room: Room | null;
  currentUser: { identity: string; name: string };
  isDrawerOpen: boolean;
  onCloseDrawer: () => void;
  onToggleDrawer: () => void;
  participants: Participant[];
}

export function SpotifyPlayer({
  room,
  currentUser,
  isDrawerOpen,
  onCloseDrawer,
  onToggleDrawer,
  participants,
}: SpotifyPlayerProps) {
  // Oynatma Durumu (Room State)
  const [playbackState, setPlaybackState] = useState<SpotifyPlaybackState>({
    currentTrack: CURATED_TRACKS[0],
    isPlaying: false,
    positionMs: 0,
    durationMs: CURATED_TRACKS[0].durationMs,
    lastUpdated: Date.now(),
    djIdentity: null,
    djName: null,
    queue: [CURATED_TRACKS[1], CURATED_TRACKS[2]],
    voteSkips: [],
    audioMode: "hybrid_auto",
  });

  // Bireysel Dinleyici Ayarları
  const [volume, setVolume] = useState<number>(80);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [audioDuckingEnabled, setAudioDuckingEnabled] = useState<boolean>(true);
  const [duckingFactor, setDuckingFactor] = useState<number>(0.25);
  const [isDuckingActive, setIsDuckingActive] = useState<boolean>(false);

  // Arama & Sekme Yönetimi
  const [activeTab, setActiveTab] = useState<"search" | "queue" | "settings">("search");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>(CURATED_TRACKS);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Spotify Hesap ve Web Playback SDK Durumu
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [spotifyDeviceId, setSpotifyDeviceId] = useState<string | null>(null);
  const [isSpotifyPremium, setIsSpotifyPremium] = useState<boolean>(false);
  const spotifyPlayerRef = useRef<any>(null);

  // Ses Oynatıcı HTMLAudioElement Ref (CORS'suz doğrudan güvenli oynatıcı)
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // State ref for event handlers
  const stateRef = useRef<SpotifyPlaybackState>(playbackState);
  stateRef.current = playbackState;

  // WebRTC / LiveKit geçici bağlantı kapanma hatalarını (PC manager is closed) sessizce yakala
  useEffect(() => {
    const handleRejection = (e: PromiseRejectionEvent) => {
      if (
        e.reason?.message?.includes("PC manager is closed") ||
        e.reason?.name === "UnexpectedConnectionState"
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", handleRejection);
    return () => window.removeEventListener("unhandledrejection", handleRejection);
  }, []);

  // 1. Token ve Popup Callback Dinleyicisi (Kullanıcı Odadayken Kesintisiz Bağlantı)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = getStoredSpotifyToken();
      setSpotifyToken(token);

      const handleAuthCallback = async (event: MessageEvent) => {
        if (event.data?.type === "VOXA_SPOTIFY_AUTH_CALLBACK") {
          const { code, error } = event.data;
          if (error) {
            alert("Spotify giriş hatası: " + error);
            return;
          }
          if (code) {
            try {
              const verifier = sessionStorage.getItem("voxa_spotify_code_verifier") || "";
              const redirectUri = `${window.location.origin.replace(/\/$/, "")}/api/spotify/callback`;
              const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || DEFAULT_SPOTIFY_CLIENT_ID;
              const res = await fetch("/api/spotify/token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code, codeVerifier: verifier, redirectUri, clientId }),
              });
              const data = await res.json();
              if (data.access_token) {
                storeSpotifyToken(data.access_token, data.expires_in || 3600, data.refresh_token);
                setSpotifyToken(data.access_token);
              }
            } catch (err) {
              console.error("Spotify token alma hatası:", err);
            }
          }
        }
      };

      window.addEventListener("message", handleAuthCallback);
      return () => window.removeEventListener("message", handleAuthCallback);
    }
  }, []);

  // 2. Spotify Web Playback SDK Entegrasyonu (Tam Şarkı Baştan Sona Çalma)
  useEffect(() => {
    if (!spotifyToken || typeof window === "undefined") return;

    let playerInstance: any = null;

    const setupPlayer = () => {
      if (!(window as any).Spotify) return;

      const player = new (window as any).Spotify.Player({
        name: "Voxa Web Jam",
        getOAuthToken: (cb: (t: string) => void) => {
          cb(spotifyToken);
        },
        volume: isMuted ? 0 : isDuckingActive ? (volume / 100) * duckingFactor : volume / 100,
      });

      player.addListener("ready", ({ device_id }: { device_id: string }) => {
        setSpotifyDeviceId(device_id);
        setIsSpotifyPremium(true);
      });

      player.addListener("not_ready", () => {
        setSpotifyDeviceId(null);
      });

      player.addListener("account_error", ({ message }: { message: string }) => {
        console.warn("Spotify hesap türü hatası:", message);
        setIsSpotifyPremium(false);
      });

      player.addListener("authentication_error", () => {
        clearStoredSpotifyToken();
        setSpotifyToken(null);
        setSpotifyDeviceId(null);
      });

      player.connect();
      playerInstance = player;
      spotifyPlayerRef.current = player;
    };

    if ((window as any).Spotify) {
      setupPlayer();
    } else {
      (window as any).onSpotifyWebPlaybackSDKReady = () => {
        setupPlayer();
      };
      if (!document.getElementById("spotify-player-sdk")) {
        const script = document.createElement("script");
        script.id = "spotify-player-sdk";
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;
        document.body.appendChild(script);
      }
    }

    return () => {
      if (playerInstance) {
        try {
          playerInstance.disconnect();
        } catch {}
      }
    };
  }, [spotifyToken, isMuted, isDuckingActive, volume, duckingFactor]);

  // 3. Audio Ducking (Biri Konuştuğunda Müziği Otomatik Kısma)
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

  // 4. Doğrudan Ses Seviyesi ve Ducking Ayarı (Hem HTML5 hem Spotify SDK)
  useEffect(() => {
    const targetVolume = isMuted ? 0 : isDuckingActive ? (volume / 100) * duckingFactor : volume / 100;
    const clampedVolume = Math.max(0, Math.min(1, targetVolume));

    if (audioRef.current) {
      try {
        audioRef.current.volume = clampedVolume;
      } catch {}
    }

    if (spotifyPlayerRef.current) {
      try {
        spotifyPlayerRef.current.setVolume(clampedVolume);
      } catch {}
    }
  }, [volume, isMuted, isDuckingActive, duckingFactor]);

  // 5. Ses Çalma Yardımcıları (Spotify Premium tam şarkı veya HTML5 demo)
  const playTrackAudio = useCallback(
    async (track: SpotifyTrack | null, positionMs = 0) => {
      if (!track) return;

      // A. Spotify Web Playback SDK ile Tam Şarkı Çalma
      if (spotifyDeviceId && spotifyToken) {
        try {
          if (audioRef.current) audioRef.current.pause();

          const trackUri =
            track.uri ||
            (track.id && !track.id.startsWith("sample-") && !track.id.startsWith("track-")
              ? `spotify:track:${track.id}`
              : undefined);

          if (trackUri) {
            await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${spotifyToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                uris: [trackUri],
                position_ms: positionMs,
              }),
            });
            return;
          }
        } catch (err) {
          console.warn("Spotify SDK ile çalma hatası:", err);
        }
      }

      // B. Yedek: HTML5 Audio Demo Oynatıcısı
      if (audioRef.current && track.previewUrl) {
        const audio = audioRef.current;
        if (audio.src !== track.previewUrl) {
          audio.src = track.previewUrl;
        }
        audio.currentTime = positionMs / 1000;
        audio.play().catch(() => {});
      }
    },
    [spotifyDeviceId, spotifyToken]
  );

  const pauseTrackAudio = useCallback(async () => {
    if (spotifyDeviceId && spotifyToken) {
      try {
        await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${spotifyDeviceId}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${spotifyToken}` },
        });
      } catch {}
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, [spotifyDeviceId, spotifyToken]);

  const seekTrackAudio = useCallback(
    async (positionMs: number) => {
      if (spotifyDeviceId && spotifyToken) {
        try {
          await fetch(
            `https://api.spotify.com/v1/me/player/seek?position_ms=${positionMs}&device_id=${spotifyDeviceId}`,
            {
              method: "PUT",
              headers: { Authorization: `Bearer ${spotifyToken}` },
            }
          );
        } catch {}
      }
      if (audioRef.current) {
        audioRef.current.currentTime = positionMs / 1000;
      }
    },
    [spotifyDeviceId, spotifyToken]
  );

  // 4. Güvenli DataChannel Mesaj Yayınlama (PC manager closed hatalarını kökten önler)
  const broadcastSync = useCallback(
    (action: SpotifyActionType, payload?: Partial<SpotifySyncMessage>) => {
      if (!room || !room.localParticipant) return;
      // LiveKit bağlantısı henüz tam kurulmamışsa veya oda kapanmışsa yollama
      if (room.state !== "connected") return;
      if ((room as any).isClosed) return;

      try {
        const message: SpotifySyncMessage = {
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
        // Silently catch any connection teardown issues
      }
    },
    [room, currentUser]
  );

  // 5. DataChannel Mesaj Dinleyicisi (Gelen Komutları İşleme)
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array, participant?: Participant) => {
      try {
        const text = new TextDecoder().decode(payload);
        if (!text.startsWith('{"type":"VOXA_SPOTIFY_')) return;
        const msg = JSON.parse(text) as SpotifySyncMessage;

        const networkDelayMs = Math.max(0, (Date.now() - msg.sentAt) / 2);

        switch (msg.type) {
          case "VOXA_SPOTIFY_PLAY": {
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

            if (audioRef.current) {
              const audio = audioRef.current;
              if (track?.previewUrl && audio.src !== track.previewUrl) {
                audio.src = track.previewUrl;
              }
              audio.currentTime = pos / 1000;
              audio.play().catch(() => {});
            }
            break;
          }

          case "VOXA_SPOTIFY_PAUSE": {
            setPlaybackState((prev) => ({
              ...prev,
              isPlaying: false,
              positionMs: msg.positionMs ?? prev.positionMs,
              lastUpdated: Date.now(),
            }));
            if (audioRef.current) {
              audioRef.current.pause();
            }
            break;
          }

          case "VOXA_SPOTIFY_SEEK": {
            const targetPos = (msg.positionMs || 0) + networkDelayMs;
            setPlaybackState((prev) => ({
              ...prev,
              positionMs: targetPos,
              lastUpdated: Date.now(),
            }));
            if (audioRef.current) {
              audioRef.current.currentTime = targetPos / 1000;
            }
            break;
          }

          case "VOXA_SPOTIFY_QUEUE_ADD": {
            if (msg.track) {
              const newTrack = msg.track;
              setPlaybackState((prev) => ({
                ...prev,
                queue: [...prev.queue, newTrack],
              }));
            }
            break;
          }

          case "VOXA_SPOTIFY_QUEUE_REMOVE": {
            if (msg.trackId) {
              setPlaybackState((prev) => ({
                ...prev,
                queue: prev.queue.filter((t) => t.id !== msg.trackId),
              }));
            }
            break;
          }

          case "VOXA_SPOTIFY_SKIP": {
            setPlaybackState((prev) => {
              const nextQueue = [...prev.queue];
              const nextTrack = nextQueue.shift() || null;
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

          case "VOXA_SPOTIFY_VOTE_SKIP": {
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

          case "VOXA_SPOTIFY_SYNC_REQ": {
            if (
              stateRef.current.djIdentity === currentUser.identity ||
              !stateRef.current.djIdentity
            ) {
              const current = stateRef.current;
              broadcastSync("VOXA_SPOTIFY_SYNC_STATE", {
                state: {
                  currentTrack: current.currentTrack,
                  isPlaying: current.isPlaying,
                  positionMs: current.positionMs,
                  durationMs: current.durationMs,
                  queue: current.queue,
                  voteSkips: current.voteSkips,
                  audioMode: current.audioMode,
                },
              });
            }
            break;
          }

          case "VOXA_SPOTIFY_SYNC_STATE": {
            if (msg.state) {
              setPlaybackState((prev) => ({
                ...prev,
                ...msg.state,
                lastUpdated: Date.now(),
              }));
              if (msg.state.currentTrack && audioRef.current) {
                const audio = audioRef.current;
                if (msg.state.currentTrack.previewUrl) {
                  audio.src = msg.state.currentTrack.previewUrl;
                  audio.currentTime = (msg.state.positionMs || 0) / 1000;
                  if (msg.state.isPlaying) {
                    audio.play().catch(() => {});
                  }
                }
              }
            }
            break;
          }

          case "VOXA_SPOTIFY_MODE_CHANGE": {
            if (msg.audioMode) {
              setPlaybackState((prev) => ({
                ...prev,
                audioMode: msg.audioMode!,
              }));
            }
            break;
          }
        }
      } catch {}
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);

    // İlk senkronizasyon isteği: WebRTC veri kanalının hazır olması için hafif bir gecikmeyle (600ms) gönder
    let syncTimer: any = null;
    const reqSync = () => {
      syncTimer = setTimeout(() => {
        if (room && room.state === "connected" && !(room as any).isClosed) {
          broadcastSync("VOXA_SPOTIFY_SYNC_REQ");
        }
      }, 600);
    };

    if (room.state === "connected") {
      reqSync();
    } else {
      room.once(RoomEvent.Connected, reqSync);
    }

    return () => {
      if (syncTimer) clearTimeout(syncTimer);
      room.off(RoomEvent.DataReceived, handleDataReceived);
      room.off(RoomEvent.Connected, reqSync);
    };
  }, [room, broadcastSync]);

  // 6. Zaman İlerleme Çubuğu ve Şarkı Bitimi Takibi (500ms Ticker)
  useEffect(() => {
    let interval: any = null;
    if (playbackState.isPlaying) {
      interval = setInterval(() => {
        setPlaybackState((prev) => {
          if (!prev.isPlaying || !prev.currentTrack) return prev;
          const nextPos = prev.positionMs + 500;

          if (nextPos >= prev.durationMs) {
            if (prev.djIdentity === currentUser.identity || !prev.djIdentity) {
              setTimeout(() => {
                handleSkipNext();
              }, 100);
            }
            return {
              ...prev,
              positionMs: prev.durationMs,
              isPlaying: false,
            };
          }

          return {
            ...prev,
            positionMs: nextPos,
          };
        });
      }, 500);
    }
    return () => clearInterval(interval);
  }, [playbackState.isPlaying, currentUser.identity]);

  // 7. Kullanıcı Etkileşim Fonksiyonları
  const handlePlayPause = () => {
    if (!playbackState.currentTrack && playbackState.queue.length > 0) {
      const first = playbackState.queue[0];
      handlePlayTrack(first);
      return;
    }

    if (playbackState.isPlaying) {
      setPlaybackState((prev) => ({ ...prev, isPlaying: false }));
      if (audioRef.current) audioRef.current.pause();
      broadcastSync("VOXA_SPOTIFY_PAUSE", {
        positionMs: playbackState.positionMs,
      });
    } else {
      setPlaybackState((prev) => ({
        ...prev,
        isPlaying: true,
        djIdentity: currentUser.identity,
        djName: currentUser.name,
      }));
      if (audioRef.current) {
        if (playbackState.currentTrack?.previewUrl && audioRef.current.src !== playbackState.currentTrack.previewUrl) {
          audioRef.current.src = playbackState.currentTrack.previewUrl;
        }
        audioRef.current.currentTime = playbackState.positionMs / 1000;
        audioRef.current.play().catch(() => {});
      }
      broadcastSync("VOXA_SPOTIFY_PLAY", {
        track: playbackState.currentTrack || undefined,
        positionMs: playbackState.positionMs,
      });
    }
  };

  const handlePlayTrack = (track: SpotifyTrack) => {
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

    if (audioRef.current) {
      if (track.previewUrl) {
        audioRef.current.src = track.previewUrl;
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    }

    broadcastSync("VOXA_SPOTIFY_PLAY", {
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
    if (audioRef.current) {
      audioRef.current.currentTime = newPos / 1000;
    }

    broadcastSync("VOXA_SPOTIFY_SEEK", { positionMs: newPos });
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

    if (nextTrack && audioRef.current) {
      if (nextTrack.previewUrl) {
        audioRef.current.src = nextTrack.previewUrl;
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    } else if (audioRef.current) {
      audioRef.current.pause();
    }

    broadcastSync("VOXA_SPOTIFY_SKIP");
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

    broadcastSync("VOXA_SPOTIFY_VOTE_SKIP");

    const reqVotes = Math.max(1, Math.ceil(participants.length / 2));
    if (voteArray.length >= reqVotes) {
      setTimeout(() => {
        handleSkipNext();
      }, 200);
    }
  };

  const handleAddToQueue = (track: SpotifyTrack) => {
    const item: SpotifyTrack = {
      ...track,
      addedBy: currentUser.name,
      addedAt: Date.now(),
    };

    setPlaybackState((prev) => ({
      ...prev,
      queue: [...prev.queue, item],
    }));

    broadcastSync("VOXA_SPOTIFY_QUEUE_ADD", { track: item });
  };

  const handleRemoveFromQueue = (trackId: string) => {
    setPlaybackState((prev) => ({
      ...prev,
      queue: prev.queue.filter((t) => t.id !== trackId),
    }));

    broadcastSync("VOXA_SPOTIFY_QUEUE_REMOVE", { trackId });
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults(CURATED_TRACKS);
      return;
    }
    setIsSearching(true);
    try {
      const results = await searchSpotifyTracks(query);
      setSearchResults(results);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAudioModeChange = (mode: SpotifyAudioMode) => {
    setPlaybackState((prev) => ({ ...prev, audioMode: mode }));
    broadcastSync("VOXA_SPOTIFY_MODE_CHANGE", { audioMode: mode });
  };

  const handleConnectSpotify = async () => {
    const clientId = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || DEFAULT_SPOTIFY_CLIENT_ID;
    // Redirect URI her zaman sabit olmalı - Spotify Dashboard'a tam eşleşen adres girilmeli
    const redirectUri = typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}${window.location.port ? ":" + window.location.port : ""}/api/spotify/callback`
      : "http://localhost:3000/api/spotify/callback";
    const authUrl = await createSpotifyAuthUrl(clientId, redirectUri);
    window.open(authUrl, "_blank", "width=500,height=700");
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
      {/* Gizli Doğrudan Müzik Oynatıcı Ses Elementi (CORS Garantili) */}
      <audio
        ref={audioRef}
        playsInline
        preload="auto"
        onEnded={handleSkipNext}
        onLoadedMetadata={() => {
          // Gerçek ses dosyası süresini al ve durationMs'yi güncelle (iTunes önizleme = ~30 saniye)
          if (audioRef.current && audioRef.current.duration && isFinite(audioRef.current.duration)) {
            const realDurationMs = Math.floor(audioRef.current.duration * 1000);
            setPlaybackState((prev) => ({
              ...prev,
              durationMs: realDurationMs,
            }));
          }
        }}
        style={{ display: "none" }}
      />

      {/* 1. ALT BARA ENTEGRE MİNİ OYNATICI (Genişletilmiş ve Doğrudan Ses Düzeyi Ayarlı) */}
      <div className="flex items-center gap-2 sm:gap-3 bg-[#1e1f22] hover:bg-[#232529] border border-[#383a40] rounded-2xl px-3 sm:px-4 py-2 shadow-lg transition-all select-none w-full max-w-[340px] sm:max-w-[440px] md:max-w-[500px] lg:max-w-[540px]">
        {/* Albüm Kapağı & Animasyon */}
        <div
          onClick={onToggleDrawer}
          className="relative w-10 h-10 rounded-xl overflow-hidden bg-[#2b2d31] shrink-0 border border-white/10 shadow cursor-pointer group"
          title="Spotify Jam Panelini Aç"
        >
          {currentTrack?.albumArt ? (
            <img
              src={currentTrack.albumArt}
              alt={currentTrack.name}
              className={`w-full h-full object-cover transition-transform duration-700 ${
                playbackState.isPlaying ? "scale-105" : "grayscale"
              }`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#1db954]">
              <Disc className={`w-5 h-5 ${playbackState.isPlaying ? "animate-spin" : ""}`} />
            </div>
          )}
          {playbackState.isPlaying && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-0.5">
              <span className="w-0.5 h-2.5 bg-[#1db954] rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-0.5 h-3.5 bg-[#1db954] rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-0.5 h-2 bg-[#1db954] rounded-full animate-bounce" />
            </div>
          )}
        </div>

        {/* Şarkı Bilgisi & İlerleme Çubuğu */}
        <div className="min-w-0 flex-1 flex flex-col justify-center cursor-pointer" onClick={onToggleDrawer}>
          <div className="flex items-center justify-between gap-1">
            <span className="text-[12px] font-bold text-white truncate max-w-[120px] sm:max-w-[170px]">
              {currentTrack?.name || "Şarkı Seçilmedi"}
            </span>
            <span className="text-[10px] font-mono text-[#a1a1aa] shrink-0">
              {formatDuration(playbackState.positionMs)} / {formatDuration(playbackState.durationMs)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-1 text-[10px] text-[#949ba4]">
            <span className="truncate max-w-[130px] sm:max-w-[180px]">
              {currentTrack?.artists || "Kuyruğa parça ekleyin"}
            </span>
            {isDuckingActive && (
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
            title="Süre ilerlet"
          >
            <div
              className="h-full bg-[#1db954] rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Oynatma Kontrolleri */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Oynat / Durdur */}
          <button
            onClick={handlePlayPause}
            className="w-8 h-8 rounded-full bg-[#1db954] hover:bg-[#1ed760] text-black flex items-center justify-center transition-all shadow cursor-pointer active:scale-95"
            title={playbackState.isPlaying ? "Durdur" : "Oynat"}
          >
            {playbackState.isPlaying ? (
              <Pause className="w-4 h-4 fill-black" />
            ) : (
              <Play className="w-4 h-4 fill-black ml-0.5" />
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
                ? "bg-[#1db954] text-black border-[#1db954]"
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
            className="text-[#949ba4] hover:text-white transition-colors p-1"
            title={isMuted ? "Sesi Aç" : "Sesi Kapat"}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-[#1db954]" />
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
            className="w-16 md:w-20 h-1.5 bg-[#404249] rounded-lg appearance-none cursor-pointer accent-[#1db954]"
            title={`Müzik Sesi: %${isMuted ? 0 : volume}`}
          />
          <span className="text-[10px] font-mono text-[#a1a1aa] w-6 text-right">
            %{isMuted ? 0 : volume}
          </span>
        </div>

        {/* Çekmeceyi Aç */}
        <button
          onClick={onToggleDrawer}
          className={`p-1.5 sm:p-2 rounded-xl transition-all cursor-pointer shrink-0 ${
            isDrawerOpen ? "bg-[#1db954] text-black" : "text-[#949ba4] hover:text-white hover:bg-white/5"
          }`}
          title="Kuyruk ve Şarkı Arama"
        >
          <ListMusic className="w-4 h-4" />
        </button>
      </div>

      {/* 2. TAM DETAYLI ARAMA, KUYRUK VE AYARLAR PANELİ (DRAWER / MODAL) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-[#121212] border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-xl h-[85vh] sm:h-[620px] flex flex-col shadow-2xl overflow-hidden text-white">
            {/* Başlık Alanı */}
            <div className="px-6 py-4 bg-[#18181b] border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#1db954]/20 border border-[#1db954]/40 flex items-center justify-center text-[#1db954]">
                  <Music className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    Voxa Spotify Jam
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-[#1db954]/20 text-[#1db954] border border-[#1db954]/30">
                      Akıllı Hibrit
                    </span>
                  </h3>
                  <p className="text-[11px] text-[#a1a1aa]">
                    Odadaki herkesle senkronize müzik dinleyin ve sıraya şarkı ekleyin
                  </p>
                </div>
              </div>
              <button
                onClick={onCloseDrawer}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#a1a1aa] hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sekme Butonları */}
            <div className="px-6 pt-3 pb-2 bg-[#18181b]/50 border-b border-white/5 flex gap-2">
              <button
                onClick={() => setActiveTab("search")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                  activeTab === "search"
                    ? "bg-[#1db954] text-black border-[#1db954] shadow"
                    : "bg-white/5 hover:bg-white/10 text-[#a1a1aa] border-white/5"
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>Şarkı Ara</span>
              </button>

              <button
                onClick={() => setActiveTab("queue")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer border relative ${
                  activeTab === "queue"
                    ? "bg-[#1db954] text-black border-[#1db954] shadow"
                    : "bg-white/5 hover:bg-white/10 text-[#a1a1aa] border-white/5"
                }`}
              >
                <ListMusic className="w-3.5 h-3.5" />
                <span>Ortak Kuyruk</span>
                {playbackState.queue.length > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    activeTab === "queue" ? "bg-black text-white" : "bg-[#1db954] text-black"
                  }`}>
                    {playbackState.queue.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("settings")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                  activeTab === "settings"
                    ? "bg-[#1db954] text-black border-[#1db954] shadow"
                    : "bg-white/5 hover:bg-white/10 text-[#a1a1aa] border-white/5"
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Ayarlar & Mod</span>
              </button>
            </div>

            {/* SEKME 1: ŞARKI ARAMA */}
            {activeTab === "search" && (
              <div className="flex-1 flex flex-col p-6 overflow-hidden">
                {/* Arama Girişi */}
                <div className="relative mb-4">
                  <Search className="w-4 h-4 text-[#a1a1aa] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Şarkı veya sanatçı adı yazın (Örn: Tarkan, Ezhel, The Weeknd)..."
                    className="w-full bg-[#1e1e24] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-[#71717a] focus:outline-none focus:border-[#1db954] transition-all"
                  />
                  {isSearching && (
                    <Loader2 className="w-4 h-4 text-[#1db954] absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin" />
                  )}
                </div>

                {/* Hızlı Öneri Etiketleri */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-2 no-scrollbar">
                  {["Tarkan", "The Weeknd", "Ezhel", "Daft Punk", "Dua Lipa", "Arctic Monkeys", "Müslüm Gürses"].map((tag) => (
                    <button
                      key={tag}
                      onClick={() => handleSearch(tag)}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-[#a1a1aa] hover:text-white shrink-0 transition-colors border border-white/5"
                    >
                      {tag}
                    </button>
                  ))}
                </div>

                {/* Arama Sonuçları Listesi */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {searchResults.map((track) => (
                    <div
                      key={track.id}
                      className="p-2.5 bg-[#18181b]/60 hover:bg-[#202024] border border-white/5 rounded-xl flex items-center justify-between gap-3 group transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={track.albumArt || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&h=100&fit=crop"}
                          alt={track.name}
                          className="w-10 h-10 rounded-lg object-cover shrink-0 bg-[#2b2d31]"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{track.name}</p>
                          <p className="text-[11px] text-[#a1a1aa] truncate">{track.artists}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] text-[#71717a] font-mono mr-1">
                          {formatDuration(track.durationMs)}
                        </span>
                        <button
                          onClick={() => handlePlayTrack(track)}
                          className="p-2 rounded-lg bg-[#1db954] hover:bg-[#1ed760] text-black font-bold text-xs transition-transform active:scale-95"
                          title="Hemen Şimdi Çal"
                        >
                          <Play className="w-3.5 h-3.5 fill-black" />
                        </button>
                        <button
                          onClick={() => handleAddToQueue(track)}
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs border border-white/10 transition-colors"
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

            {/* SEKME 2: ORTAK KUYRUK (QUEUE) */}
            {activeTab === "queue" && (
              <div className="flex-1 flex flex-col p-6 overflow-hidden">
                {/* Şu An Çalan Şarkı */}
                <div className="mb-4 p-3 bg-[#1db954]/10 border border-[#1db954]/30 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={currentTrack?.albumArt || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&h=100&fit=crop"}
                      alt=""
                      className="w-11 h-11 rounded-xl object-cover"
                    />
                    <div className="min-w-0">
                      <span className="text-[10px] font-extrabold uppercase text-[#1db954]">
                        Şu An Çalıyor
                      </span>
                      <h4 className="text-xs font-bold text-white truncate">{currentTrack?.name}</h4>
                      <p className="text-[11px] text-[#a1a1aa] truncate">{currentTrack?.artists}</p>
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
                      className="text-[11px] text-red-400 hover:text-red-300 transition-colors"
                    >
                      Kuyruğu Temizle
                    </button>
                  )}
                </div>

                {playbackState.queue.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-[#71717a]">
                    <ListMusic className="w-12 h-12 stroke-[1.5] mb-2 opacity-40" />
                    <p className="text-xs font-semibold text-[#a1a1aa]">Kuyrukta şarkı bulunmuyor</p>
                    <p className="text-[11px] mt-1">"Şarkı Ara" sekmesinden yeni parçalar ekleyebilirsiniz.</p>
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
                            src={track.albumArt}
                            alt=""
                            className="w-9 h-9 rounded-lg object-cover"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate">{track.name}</p>
                            <p className="text-[11px] text-[#a1a1aa] truncate">
                              {track.artists} {track.addedBy && `• Ekleyen: ${track.addedBy}`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] text-[#71717a] font-mono">
                            {formatDuration(track.durationMs)}
                          </span>
                          <button
                            onClick={() => handleRemoveFromQueue(track.id)}
                            className="p-1.5 text-[#71717a] hover:text-red-400 transition-colors"
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

            {/* SEKME 3: HİBRİT MOD VE SES AYARLARI */}
            {activeTab === "settings" && (
              <div className="flex-1 p-6 overflow-y-auto space-y-5 custom-scrollbar text-xs">
                {/* 1. Çalma Modu */}
                <div className="space-y-2">
                  <label className="font-bold text-white text-xs uppercase tracking-wider text-[#a1a1aa]">
                    Ses Çalma Modu (Hibrit Seçenekler)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      onClick={() => handleAudioModeChange("hybrid_auto")}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                        playbackState.audioMode === "hybrid_auto"
                          ? "bg-[#1db954]/15 border-[#1db954] text-white"
                          : "bg-white/5 border-white/5 text-[#a1a1aa] hover:bg-white/10"
                      }`}
                    >
                      <Sparkles className="w-4 h-4 text-[#1db954] mb-2" />
                      <div>
                        <p className="font-bold text-white">Akıllı Hibrit</p>
                        <p className="text-[10px] text-[#a1a1aa] mt-0.5 leading-tight">
                          Premium olanlar yerel, olmayanlar DJ yayını dinler.
                        </p>
                      </div>
                    </button>

                    <button
                      onClick={() => handleAudioModeChange("spotify_sdk")}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                        playbackState.audioMode === "spotify_sdk"
                          ? "bg-[#1db954]/15 border-[#1db954] text-white"
                          : "bg-white/5 border-white/5 text-[#a1a1aa] hover:bg-white/10"
                      }`}
                    >
                      <Headphones className="w-4 h-4 text-emerald-400 mb-2" />
                      <div>
                        <p className="font-bold text-white">Spotify SDK</p>
                        <p className="text-[10px] text-[#a1a1aa] mt-0.5 leading-tight">
                          0 sunucu kotası. Doğrudan Spotify'dan 320 kbps çalar.
                        </p>
                      </div>
                    </button>

                    <button
                      onClick={() => handleAudioModeChange("voxa_stream")}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                        playbackState.audioMode === "voxa_stream"
                          ? "bg-[#1db954]/15 border-[#1db954] text-white"
                          : "bg-white/5 border-white/5 text-[#a1a1aa] hover:bg-white/10"
                      }`}
                    >
                      <Radio className="w-4 h-4 text-purple-400 mb-2" />
                      <div>
                        <p className="font-bold text-white">Voxa DJ Yayını</p>
                        <p className="text-[10px] text-[#a1a1aa] mt-0.5 leading-tight">
                          Hesapsız herkes doğrudan tarayıcı içinden dinler.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 2. Ses ve Ducking Ayarları */}
                <div className="p-4 bg-[#18181b]/60 border border-white/10 rounded-2xl space-y-4">
                  {/* Ses Kaydırıcısı */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsMuted(!isMuted)}
                        className="text-[#a1a1aa] hover:text-white transition-colors"
                      >
                        {isMuted || volume === 0 ? (
                          <VolumeX className="w-4 h-4 text-red-400" />
                        ) : (
                          <Volume2 className="w-4 h-4 text-[#1db954]" />
                        )}
                      </button>
                      <span className="font-bold text-white">Müzik Ses Düzeyi</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={isMuted ? 0 : volume}
                        onChange={(e) => {
                          setVolume(parseInt(e.target.value, 10));
                          if (isMuted) setIsMuted(false);
                        }}
                        className="w-28 h-1.5 bg-[#404249] rounded-lg appearance-none cursor-pointer accent-[#1db954]"
                      />
                      <span className="w-8 font-mono text-[11px] text-[#a1a1aa]">
                        %{isMuted ? 0 : volume}
                      </span>
                    </div>
                  </div>

                  {/* Audio Ducking */}
                  <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white flex items-center gap-1.5">
                        <Mic className="w-3.5 h-3.5 text-amber-400" />
                        Akıllı Ses Kısma (Audio Ducking)
                      </p>
                      <p className="text-[11px] text-[#a1a1aa]">
                        Odada biri konuştuğunda müziğin sesini otomatik kısar.
                      </p>
                    </div>
                    <button
                      onClick={() => setAudioDuckingEnabled(!audioDuckingEnabled)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        audioDuckingEnabled ? "bg-[#1db954]" : "bg-[#333]"
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                          audioDuckingEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* 3. Spotify Hesabı Bağlama */}
                <div className="p-4 bg-[#18181b]/60 border border-white/10 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white">Kişisel Spotify Hesabı</p>
                      <p className="text-[11px] text-[#a1a1aa]">
                        {spotifyToken
                          ? "Spotify hesabınız bağlandı."
                          : "Spotify Premium hesabınızı bağlayarak doğrudan dinleyin."}
                      </p>
                    </div>
                    {spotifyToken ? (
                      <button
                        onClick={() => {
                          clearStoredSpotifyToken();
                          setSpotifyToken(null);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-[11px] font-bold"
                      >
                        Bağlantıyı Kes
                      </button>
                    ) : (
                      <button
                        onClick={handleConnectSpotify}
                        className="px-3 py-1.5 rounded-lg bg-[#1db954] hover:bg-[#1ed760] text-black text-[11px] font-bold flex items-center gap-1.5 transition-transform active:scale-95"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Spotify ile Bağlan</span>
                      </button>
                    )}
                  </div>

                  <div className="pt-3 border-t border-white/5">
                    <div className="rounded-xl bg-[#1db954]/10 border border-[#1db954]/20 p-3 text-xs text-[#a1a1aa] leading-relaxed">
                      <p className="font-semibold text-white mb-1 flex items-center gap-1.5">
                        <Headphones className="w-3.5 h-3.5 text-[#1db954]" />
                        Spotify Premium ile Tam Şarkı
                      </p>
                      <p className="text-[11px]">
                        Bağlan butonuna basarak Spotify hesabınıza giriş yapın. Premium üyeler şarkıları baştan sona dinleyebilir. Ücretsiz hesaplar veya bağlanmayanlar otomatik olarak 30 saniyelik önizleme modunda çalar.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
