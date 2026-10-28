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
  useMediaDeviceSelect,
  TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { Track, RoomEvent, setLogLevel, RemoteAudioTrack } from "livekit-client";

setLogLevel("warn");
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
  VolumeX,
  Shield,
  Loader2,
  MessageSquare,
  Send,
  X,
  Settings,
  Sparkles,
  Lock,
  Unlock,
  Sliders,
  Tv,
  ChevronDown,
  ChevronUp,
  Laptop,
  Download,
  Headphones,
  HeadphoneOff,
  Volume1,
  Activity,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Smile,
  Upload,
  Camera,
} from "lucide-react";
import { useKrispNoiseFilter } from "@livekit/components-react/krisp";
import { playJoinSound, playLeaveSound, playMuteSound } from "@/lib/sounds";
import {
  P2PTransferManager,
  registerLocalFile,
  getLocalFile,
  generateImageThumbnail,
  formatFileSize,
  SharedFileMeta,
  saveBlobToDisk,
} from "@/lib/p2p-file-transfer";
import {
  PRESET_AVATARS,
  getStoredAvatar,
  storeAvatar,
  clearStoredAvatar,
  compressAndCropAvatar,
} from "@/lib/avatars";

interface RoomContentProps {
  roomName: string;
  username: string;
}

// Ekran Kalite Modları Konfigürasyonu
const SCREEN_SHARE_PRESETS = {
  "720p30": {
    label: "⚡ Performans (720p / 30 FPS)",
    width: 1280,
    height: 720,
    frameRate: 30,
    maxBitrate: 1_500_000,
  },
  "1080p30": {
    label: "🎬 Standart (1080p / 30 FPS)",
    width: 1920,
    height: 1080,
    frameRate: 30,
    maxBitrate: 3_000_000,
  },
  "1080p60": {
    label: "🚀 Yüksek Hız (1080p / 60 FPS)",
    width: 1920,
    height: 1080,
    frameRate: 60,
    maxBitrate: 4_500_000,
  },
  "2k60": {
    label: "🔥 Ultra 2K Sinematik (1440p / 60 FPS)",
    width: 2560,
    height: 1440,
    frameRate: 60,
    maxBitrate: 7_000_000,
  },
};

type ScreenSharePresetKey = keyof typeof SCREEN_SHARE_PRESETS;

const getDisplayName = (p?: { name?: string; identity?: string }) => {
  if (!p) return "Misafir";
  if (p.name) return p.name;
  if (p.identity) return p.identity.split("#")[0];
  return "Misafir";
};

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
  const [chatOpen, setChatOpen] = useState<boolean>(false);

  const [chatInput, setChatInput] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);

  // P2P Dosya & Görsel Transfer Durumları
  const p2pManagerRef = useRef<P2PTransferManager | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lightbox Modal Durumu
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    name: string;
    fileId?: string;
    meta?: SharedFileMeta;
  } | null>(null);

  // Avatar Yönetimi Durumu
  const [roomAvatar, setRoomAvatar] = useState<string | null>(null);
  const roomAvatarRef = useRef<string | null>(null);
  const [participantAvatars, setParticipantAvatars] = useState<Record<string, string>>({});
  const [avatarModalOpen, setAvatarModalOpen] = useState<boolean>(false);
  const roomAvatarInputRef = useRef<HTMLInputElement>(null);

  // Çoklu Yayın ve Yayından Ayrıl / İzle Durumları
  const [watchedTrackSid, setWatchedTrackSid] = useState<string | null>(null);
  const [isWatchingStream, setIsWatchingStream] = useState<boolean>(true);

  // Ekran Sesi Doğrudan HTMLAudioElement Referansı
  const screenShareAudioElRef = useRef<HTMLAudioElement | null>(null);

  // Tarayıcı Ses Otomatik Oynatma Engel Takibi (Autoplay Policy)
  const [canPlayAudio, setCanPlayAudio] = useState<boolean>(true);

  useEffect(() => {
    if (!room) return;
    const handleAudioChange = () => {
      setCanPlayAudio(room.canPlaybackAudio);
    };
    setCanPlayAudio(room.canPlaybackAudio);
    room.on(RoomEvent.AudioPlaybackStatusChanged, handleAudioChange);
    return () => {
      room.off(RoomEvent.AudioPlaybackStatusChanged, handleAudioChange);
    };
  }, [room]);

  // Oda Kilitleme Durumu
  const [isRoomLocked, setIsRoomLocked] = useState<boolean>(false);
  const [isLockingPending, setIsLockingPending] = useState<boolean>(false);

  // Kullanıcı Bazlı Ses Düzeyleri (0-100) ve Mute Durumları
  const [userVolumes, setUserVolumes] = useState<Record<string, number>>({});
  const [userMutedState, setUserMutedState] = useState<Record<string, boolean>>({});
  const [isDeafened, setIsDeafened] = useState<boolean>(false);
  const [lastReadChatCount, setLastReadChatCount] = useState<number>(0);

  // Masaüstü (Electron) Ekran Seçim Modalı
  const [desktopPickerOpen, setDesktopPickerOpen] = useState<boolean>(false);
  const [desktopSources, setDesktopSources] = useState<Array<{ id: string; name: string; thumbnail: string }>>([]);

  // Ses Aygıtı Seçicileri (Mikrofon ve Hoparlör)
  const {
    devices: audioInputDevices,
    activeDeviceId: activeAudioInputId,
    setActiveMediaDevice: selectAudioInput,
  } = useMediaDeviceSelect({ kind: "audioinput" });

  const {
    devices: audioOutputDevices,
    activeDeviceId: activeAudioOutputId,
    setActiveMediaDevice: selectAudioOutput,
  } = useMediaDeviceSelect({ kind: "audiooutput" });

  // Açık olan kullanıcı ses ayar popover'ı (identity)
  const [openVolumeUserId, setOpenVolumeUserId] = useState<string | null>(null);

  // Ekran Paylaşımı Kalitesi ve Ekran Sesi Ayarları
  const [screenQuality, setScreenQuality] = useState<ScreenSharePresetKey>("2k60");
  const [screenAudioEnabled, setScreenAudioEnabled] = useState<boolean>(true);
  const [screenAudioVolume, setScreenAudioVolume] = useState<number>(100); // 0 - 100 %
  const [isScreenAudioMuted, setIsScreenAudioMuted] = useState<boolean>(false);

  // Electron Masaüstü Uygulaması Durumu
  const [isElectronApp, setIsElectronApp] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).electronAPI) {
      setIsElectronApp(true);
    }
  }, []);

  // LiveKit Krisp AI Gürültü Engelleme Filtresi Hook'u
  const { isNoiseFilterEnabled, setNoiseFilterEnabled, isNoiseFilterPending } =
    useKrispNoiseFilter();

  const initialAutoEnableRef = useRef<boolean>(false);

  // Gürültü filtresini varsayılan olarak aç
  useEffect(() => {
    if (!initialAutoEnableRef.current && isMicrophoneEnabled && !isNoiseFilterPending) {
      initialAutoEnableRef.current = true;
      setNoiseFilterEnabled(true).catch((err) => {
        console.warn("Krisp AI Gürültü filtresi aktifleştirilirken uyarı:", err);
      });
    }
  }, [isMicrophoneEnabled, isNoiseFilterPending, setNoiseFilterEnabled]);

  // Gürültü Filtresi Açıp/Kapatma İşleyicisi
  const handleToggleNoiseFilter = async () => {
    try {
      await setNoiseFilterEnabled(!isNoiseFilterEnabled);
    } catch (err) {
      console.error("Gürültü filtresi değiştirilemedi:", err);
    }
  };

  // Oda Metadata Dinleyicisi (Oda Kilidi Takibi)
  useEffect(() => {
    if (!room) return;

    const parseMetadata = () => {
      if (room.metadata) {
        try {
          const parsed = JSON.parse(room.metadata);
          setIsRoomLocked(!!parsed.locked);
        } catch {
          // ignore
        }
      }
    };

    parseMetadata();

    const handleRoomUpdate = () => {
      parseMetadata();
    };

    room.on(RoomEvent.RoomMetadataChanged, handleRoomUpdate);
    return () => {
      room.off(RoomEvent.RoomMetadataChanged, handleRoomUpdate);
    };
  }, [room]);

  // Odaya Katılma ve Ayrılma Ses Efektleri (Discord-style Chimes)
  useEffect(() => {
    if (!room) return;

    // Odaya ilk girişte katılma efekti
    playJoinSound();

    const handleParticipantConnected = () => {
      playJoinSound();
    };

    const handleParticipantDisconnected = () => {
      playLeaveSound();
    };

    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

    return () => {
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    };
  }, [room]);

  // P2P WebRTC Sinyal ve Transfer Yöneticisi (LiveKit Kotası Harcamaz)
  useEffect(() => {
    if (!room) return;

    const manager = new P2PTransferManager((targetIdentity, payload) => {
      try {
        const fromIdentity = room.localParticipant?.identity || localParticipant.identity;
        const str = JSON.stringify({
          voxaP2P: true,
          targetIdentity,
          senderIdentity: fromIdentity,
          ...payload,
        });
        const bytes = new TextEncoder().encode(str);
        room.localParticipant.publishData(bytes, { reliable: true });
      } catch (err) {
        console.warn("P2P sinyal iletim hatası:", err);
      }
    });

    p2pManagerRef.current = manager;

    // DataChannel üzerinden avatar yayınlama yardımcısı
    const broadcastAvatar = (avatarData: string | null) => {
      if (!room?.localParticipant) return;
      try {
        const payload = JSON.stringify({
          type: "VOXA_AVATAR",
          identity: room.localParticipant.identity,
          avatar: avatarData,
        });
        room.localParticipant
          .publishData(new TextEncoder().encode(payload), { reliable: true })
          .catch(() => {});
      } catch (err) {
        console.warn("Avatar yayınlama hatası:", err);
      }
    };

    const handleDataReceived = (payload: Uint8Array, participant?: any) => {
      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text);

        // 1. Canlı Avatar Yayın Sinyali
        if (data.type === "VOXA_AVATAR") {
          const senderId = data.identity || participant?.identity;
          if (senderId) {
            setParticipantAvatars((prev) => {
              if (data.avatar) {
                return { ...prev, [senderId]: data.avatar };
              } else {
                const next = { ...prev };
                delete next[senderId];
                return next;
              }
            });
          }
          return;
        }

        // 2. Yeni Katılımcı Avatar Talep Sinyali
        if (data.type === "VOXA_AVATAR_REQ") {
          if (roomAvatarRef.current) {
            broadcastAvatar(roomAvatarRef.current);
          }
          return;
        }

        if (!data.voxaP2P) return;

        const myId = room.localParticipant?.identity || localParticipant.identity;
        if (data.targetIdentity && data.targetIdentity !== myId) {
          return;
        }

        const senderIdentity = data.senderIdentity || participant?.identity;
        if (!senderIdentity) return;

        if (data.type === "P2P_FILE_REQUEST") {
          manager.handleFileRequest(data.fileId, senderIdentity);
        } else if (data.type === "P2P_OFFER") {
          manager.handleOffer(data.fileId, senderIdentity, data.sdp);
        } else if (data.type === "P2P_ANSWER") {
          manager.handleAnswer(data.fileId, senderIdentity, data.sdp);
        } else if (data.type === "P2P_CANDIDATE") {
          manager.handleCandidate(data.fileId, senderIdentity, data.candidate);
        } else if (data.type === "P2P_CANCEL") {
          manager.handleCancelSignal(data.fileId, senderIdentity);
        }
      } catch {
        // ignore non-json data
      }
    };

    // Yeni katılımcı bağlandığında avatarımızı ona duyur
    const handleParticipantConnected = () => {
      if (roomAvatarRef.current) {
        broadcastAvatar(roomAvatarRef.current);
      }
    };

    // Katılımcı metadata'sı değiştiğinde avatar state'ini güncelle
    const handleMetadataChanged = (metadata: string | undefined, participant: any) => {
      if (!participant || !metadata) return;
      try {
        const parsed = JSON.parse(metadata);
        if (parsed.avatar) {
          setParticipantAvatars((prev) => ({
            ...prev,
            [participant.identity]: parsed.avatar,
          }));
        } else if (parsed.avatar === null) {
          setParticipantAvatars((prev) => {
            const next = { ...prev };
            delete next[participant.identity];
            return next;
          });
        }
      } catch {}
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantMetadataChanged, handleMetadataChanged);

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantMetadataChanged, handleMetadataChanged);
      manager.cleanup();
    };
  }, [room, localParticipant.identity]);

  // Kayıtlı avatarı LiveKit metadata'sına ve DataChannel'a anında eşitleme
  useEffect(() => {
    if (!room) return;
    const saved = getStoredAvatar();
    if (saved) {
      setRoomAvatar(saved);
      roomAvatarRef.current = saved;
      try {
        room.localParticipant.setMetadata(JSON.stringify({ avatar: saved })).catch(() => {});
      } catch (err) {
        console.warn("Avatar metadata hatası:", err);
      }
    }

    // Odadaki mevcut katılımcılardan avatarlarını talep et ve kendi avatarımızı yayınla
    const syncTimer = setTimeout(() => {
      try {
        const reqPayload = JSON.stringify({ type: "VOXA_AVATAR_REQ" });
        room.localParticipant.publishData(new TextEncoder().encode(reqPayload), {
          reliable: true,
        }).catch(() => {});
        if (saved) {
          const payload = JSON.stringify({
            type: "VOXA_AVATAR",
            identity: room.localParticipant.identity,
            avatar: saved,
          });
          room.localParticipant.publishData(new TextEncoder().encode(payload), {
            reliable: true,
          }).catch(() => {});
        }
      } catch {}
    }, 600);

    return () => clearTimeout(syncTimer);
  }, [room]);

  // Katılımcının avatarını çözümleme fonksiyonu (Tüm katılımcılar anında görür)
  const getParticipantAvatar = (p?: any): string | null => {
    if (!p) return null;
    const identity = typeof p === "string" ? p : p.identity;
    const isMe =
      identity === localParticipant.identity ||
      identity === room?.localParticipant?.identity;

    if (isMe && roomAvatar) return roomAvatar;

    // 1. Canlı DataChannel / State önbelleği
    if (identity && participantAvatars[identity]) {
      return participantAvatars[identity];
    }

    // 2. Katılımcı nesnesi üzerindeki doğrudan metadata
    if (p.metadata) {
      try {
        const parsed = JSON.parse(p.metadata);
        if (parsed.avatar) return parsed.avatar;
      } catch {}
    }

    // 3. msg.from gibi sadece identity içeren nesneler için oda katılımcılarında arama
    if (identity && room) {
      const found =
        room.remoteParticipants.get(identity) ||
        participants.find((part) => part.identity === identity);
      if (found?.metadata) {
        try {
          const parsed = JSON.parse(found.metadata);
          if (parsed.avatar) return parsed.avatar;
        } catch {}
      }
    }

    return null;
  };

  // Avatar Değiştirme / Yükleme İşleyicileri (Kaydetmeye gerek kalmadan anında odadakilere iletir)
  const handleUpdateRoomAvatar = async (avatarDataUrl: string) => {
    setRoomAvatar(avatarDataUrl);
    roomAvatarRef.current = avatarDataUrl;
    storeAvatar(avatarDataUrl);

    if (room?.localParticipant) {
      // 1. DataChannel ile odaya canlı yayınla (0 gecikme)
      try {
        const payload = JSON.stringify({
          type: "VOXA_AVATAR",
          identity: room.localParticipant.identity,
          avatar: avatarDataUrl,
        });
        room.localParticipant.publishData(new TextEncoder().encode(payload), {
          reliable: true,
        }).catch(() => {});
      } catch (e) {
        console.warn("Avatar DataChannel yayın hatası:", e);
      }

      // 2. LiveKit metadata'sına kaydet (canUpdateOwnMetadata: true)
      try {
        await room.localParticipant.setMetadata(JSON.stringify({ avatar: avatarDataUrl }));
      } catch (e) {
        console.warn("Avatar güncelleme hatası:", e);
      }
    }
    setAvatarModalOpen(false);
  };

  const handleRoomCustomAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const cropped = await compressAndCropAvatar(file);
      await handleUpdateRoomAvatar(cropped);
      if (roomAvatarInputRef.current) roomAvatarInputRef.current.value = "";
    } catch (err: any) {
      alert(err.message || "Avatar yüklenirken bir hata oluştu.");
    }
  };

  const handleRemoveRoomAvatar = async () => {
    setRoomAvatar(null);
    roomAvatarRef.current = null;
    clearStoredAvatar();

    if (room?.localParticipant) {
      try {
        const payload = JSON.stringify({
          type: "VOXA_AVATAR",
          identity: room.localParticipant.identity,
          avatar: null,
        });
        room.localParticipant.publishData(new TextEncoder().encode(payload), {
          reliable: true,
        }).catch(() => {});
      } catch {}

      try {
        await room.localParticipant.setMetadata(JSON.stringify({ avatar: null }));
      } catch {}
    }
    setAvatarModalOpen(false);
  };

  const stageRef = useRef<HTMLDivElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auto scroll chat to bottom & reset unread count when chat is open
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    if (chatOpen) {
      setLastReadChatCount(chatMessages.length);
    }
  }, [chatMessages, chatOpen]);

  const unreadChatCount = chatOpen ? 0 : Math.max(0, chatMessages.length - lastReadChatCount);

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
    if (isElectronApp && (window as any).electronAPI?.toggleFullscreen) {
      (window as any).electronAPI.toggleFullscreen().then((isFull: boolean) => {
        setIsFullscreen(isFull);
      });
      return;
    }

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

  // Tüm Kamera, Ekran ve Mikrofon ses izlerini dinle
  const videoTracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], {
    onlySubscribed: false,
  });

  const micTracks = useTracks([Track.Source.Microphone], {
    onlySubscribed: false,
  });

  const screenShareAudioTracks = useTracks([Track.Source.ScreenShareAudio], {
    onlySubscribed: false,
  });

  // Odadaki tüm ekran paylaşımı video track'lerini listele
  const screenShareTracks = videoTracks.filter(
    (t) => t.source === Track.Source.ScreenShare && t.publication?.isSubscribed !== false
  );

  // Kullanıcı yayın izlemeyi kapatmadıysa ve seçili yayın varsa onu, yoksa ilk yayını izle
  const activeScreenShare = isWatchingStream
    ? (watchedTrackSid
        ? screenShareTracks.find((t) => t.publication?.trackSid === watchedTrackSid) || screenShareTracks[0]
        : screenShareTracks[0]) || null
    : null;

  // Ekran paylaşımı ses track'ini bul (izlenen yayına ait ses)
  const activeScreenShareAudio = screenShareAudioTracks.find((t) => {
    if (t.source !== Track.Source.ScreenShareAudio) {
      return false;
    }
    if (activeScreenShare) {
      return t.participant.identity === activeScreenShare.participant.identity;
    }
    return true;
  });

  // Odaklanan Medya İzleri (Kamera veya Ekran)
  const activeFocusTrack = selectedTrack || activeScreenShare || null;

  // Ekran Sesini Doğrudan HTMLAudioElement İle Güvenli Çalma ve Ses Ayarı
  useEffect(() => {
    const audioTrackPub = activeScreenShareAudio?.publication;
    const audioEl = screenShareAudioElRef.current;
    const isLocal = activeScreenShareAudio?.participant?.isLocal;

    // Yayın açan kişi kendi ekran sesini tekrar duymamalı (yankı/çift ses engelleme)
    if (isLocal) return;

    // Abonelik henüz tamamlanmamışsa abone olmaya zorla
    if (audioTrackPub && !audioTrackPub.isSubscribed && typeof (audioTrackPub as any).setSubscribed === "function") {
      try {
        (audioTrackPub as any).setSubscribed(true);
      } catch (err) {
        console.warn("Ekran sesi abone olma hatası:", err);
      }
    }

    const audioTrack = audioTrackPub?.track as RemoteAudioTrack | undefined;
    if (!audioTrack || !audioEl) return;

    if (!isWatchingStream) {
      audioEl.pause();
      try {
        audioTrack.detach(audioEl);
      } catch {}
      return;
    }

    try {
      audioTrack.attach(audioEl);

      const rawVol = isScreenAudioMuted ? 0 : screenAudioVolume / 100;
      const safeVol = Math.min(1.0, Math.max(0.0, rawVol));
      audioEl.volume = safeVol;

      if (typeof audioTrack.setVolume === "function") {
        audioTrack.setVolume(safeVol);
      }

      if (activeAudioOutputId && typeof (audioEl as any).setSinkId === "function") {
        (audioEl as any).setSinkId(activeAudioOutputId).catch(() => {});
      }

      if (safeVol > 0) {
        audioEl.play().catch((err) => {
          console.warn("Ekran sesi oynatılamadı (otomatik oynatma kısıtlaması):", err);
        });
      }
    } catch (e) {
      console.warn("Ekran sesi bağlama hatası:", e);
    }

    return () => {
      try {
        audioTrack.detach(audioEl);
      } catch {}
    };
  }, [
    activeScreenShareAudio,
    activeScreenShareAudio?.publication?.track,
    activeScreenShareAudio?.publication?.isSubscribed,
    screenAudioVolume,
    isScreenAudioMuted,
    isWatchingStream,
    activeAudioOutputId,
  ]);

  // Bireysel Kullanıcı Ses Düzeyini Güncelleme Fonksiyonu
  const applyUserVolume = (identity: string, volumePercent: number, isMuted: boolean) => {
    const rawVol = isMuted ? 0 : volumePercent / 100;
    const safeVol = Math.min(1.0, Math.max(0.0, rawVol));

    // 1. Mic tracks listesinden ses izini güncelle
    const micTrackRef = micTracks.find((t) => t.participant.identity === identity);
    if (micTrackRef?.publication?.track) {
      try {
        (micTrackRef.publication.track as any).setVolume(safeVol);
      } catch (e) {
        console.warn("Track setVolume hatası:", e);
      }
    }

    // 2. Katılımcı nesnesi üzerindeki yayınlardan güncelle
    const participant = participants.find((p) => p.identity === identity);
    if (participant) {
      participant.audioTrackPublications.forEach((pub) => {
        if (pub.track) {
          try {
            (pub.track as any).setVolume(safeVol);
          } catch (e) {
            console.warn("Participant track setVolume hatası:", e);
          }
        }
      });
    }
  };

  const handleUserVolumeChange = (identity: string, newVolume: number) => {
    const clampedVol = Math.min(100, Math.max(0, newVolume));
    setUserVolumes((prev) => ({ ...prev, [identity]: clampedVol }));
    const isMuted = !!userMutedState[identity];
    applyUserVolume(identity, clampedVol, isMuted);
  };

  // Bireysel Kullanıcı Mute Geçiş Fonksiyonu
  const handleToggleUserMute = (identity: string) => {
    const isCurrentlyMuted = !!userMutedState[identity];
    const nextMuted = !isCurrentlyMuted;
    setUserMutedState((prev) => ({ ...prev, [identity]: nextMuted }));

    const currentVol = userVolumes[identity] ?? 100;
    applyUserVolume(identity, currentVol, nextMuted);
  };

  // Oda Kilitleme / Kilit Açma
  const toggleRoomLock = async () => {
    try {
      setIsLockingPending(true);
      const res = await fetch("/api/room/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: roomName,
          locked: !isRoomLocked,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Oda kilit durumu değiştirilemedi.");
      }

      setIsRoomLocked(!isRoomLocked);
    } catch (err) {
      console.error("Oda kilit hatası:", err);
      alert(err instanceof Error ? err.message : "Oda kilitlenirken bir hata oluştu.");
    } finally {
      setIsLockingPending(false);
    }
  };

  // Copy Invite Link to Clipboard
  const handleCopyInvite = useCallback(() => {
    if (typeof window === "undefined") return;
    const baseDomain = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "https://ses.app.noticq.com");
    const inviteUrl = `${baseDomain}?room=${encodeURIComponent(roomName.toLowerCase())}`;

    try {
      if ((window as any).electronAPI?.clipboardWriteText) {
        (window as any).electronAPI.clipboardWriteText(inviteUrl);
      } else if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(inviteUrl);
      } else {
        const input = document.createElement("input");
        input.value = inviteUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
    } catch (e) {
      console.warn("Clipboard hatası:", e);
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }, [roomName]);

  // Sağırlaştırma (Deafen) Geçiş Fonksiyonu
  const toggleDeafen = async () => {
    const nextDeafened = !isDeafened;
    setIsDeafened(nextDeafened);
    if (nextDeafened) {
      if (isMicrophoneEnabled) {
        await localParticipant.setMicrophoneEnabled(false);
      }
      micTracks.forEach((t) => {
        if (t.publication?.track) {
          try {
            (t.publication.track as any).setVolume(0);
          } catch (e) {}
        }
      });
    } else {
      participants.forEach((p) => {
        const vol = userVolumes[p.identity] ?? 100;
        const isMuted = !!userMutedState[p.identity];
        applyUserVolume(p.identity, vol, isMuted);
      });
    }
  };

  // Kısayol Tuşları (Keybindings Listener)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (lightboxImage) setLightboxImage(null);
        if (avatarModalOpen) setAvatarModalOpen(false);
        if (settingsOpen) setSettingsOpen(false);
        return;
      }
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;
      const key = e.key.toLowerCase();
      if (key === "m") {
        toggleMic();
      } else if (key === "d") {
        toggleDeafen();
      } else if (key === "f") {
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMicrophoneEnabled, isDeafened, lightboxImage, avatarModalOpen, settingsOpen]);

  // Audio / Video Controls
  const toggleMic = async () => {
    try {
      if (isDeafened) setIsDeafened(false);
      const nextState = !isMicrophoneEnabled;
      await localParticipant.setMicrophoneEnabled(nextState);
      playMuteSound(!nextState);
    } catch (err) {
      console.error("Mikrofon değiştirilemedi:", err);
    }
  };

  // Masaüstü Ekran Paylaşım Seçici Açma
  const handleOpenScreenSharePicker = async () => {
    if (isScreenShareEnabled) {
      await localParticipant.setScreenShareEnabled(false);
      return;
    }

    if (isElectronApp && (window as any).electronAPI?.getDesktopSources) {
      try {
        const sources = await (window as any).electronAPI.getDesktopSources();
        if (sources && sources.length > 0) {
          setDesktopSources(sources);
          setDesktopPickerOpen(true);
        } else {
          toggleScreenShare();
        }
      } catch (err) {
        console.error("Masaüstü kaynakları alınamadı:", err);
        toggleScreenShare();
      }
    } else {
      toggleScreenShare();
    }
  };

  const toggleCamera = async () => {
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch (err) {
      console.error("Kamera değiştirilemedi:", err);
    }
  };

  // Ekran Paylaşımı (2K / 60 FPS + AV1 Düşük Kota + Ekran Sesi Yakalama Desteği)
  const toggleScreenShare = async () => {
    try {
      if (isScreenShareEnabled) {
        await localParticipant.setScreenShareEnabled(false);
      } else {
        const preset = SCREEN_SHARE_PRESETS[screenQuality];
        try {
          await localParticipant.setScreenShareEnabled(
            true,
            {
              audio: screenAudioEnabled
                ? {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                  } as any
                : false,
              systemAudio: "include",
              suppressLocalAudioPlayback: false,
              resolution: {
                width: preset.width,
                height: preset.height,
                frameRate: preset.frameRate,
              },
              selfBrowserSurface: "include",
              surfaceSwitching: "include",
            },
            {
              videoCodec: "av1",
              backupCodec: true,
              videoEncoding: {
                maxBitrate: preset.maxBitrate,
                maxFramerate: preset.frameRate,
              },
            }
          );
        } catch (audioErr) {
          if (screenAudioEnabled) {
            console.warn("Ekran sesi ile paylaşım başarısız oldu, sessiz paylaşım deneniyor:", audioErr);
            // Fallback: Ekran ses desteksiz tarayıcı/pencere seçimlerinde ekran paylaşımının düşmesini engelle
            await localParticipant.setScreenShareEnabled(
              true,
              {
                audio: false,
                systemAudio: "include",
                suppressLocalAudioPlayback: false,
                resolution: {
                  width: preset.width,
                  height: preset.height,
                  frameRate: preset.frameRate,
                },
                selfBrowserSurface: "include",
                surfaceSwitching: "include",
              },
              {
                videoCodec: "av1",
                backupCodec: true,
                videoEncoding: {
                  maxBitrate: preset.maxBitrate,
                  maxFramerate: preset.frameRate,
                },
              }
            );
          } else {
            throw audioErr;
          }
        }
      }
    } catch (err) {
      console.error("Ekran paylaşımı başlatılamadı:", err);
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

  // P2P Dosya Yükleme / Paylaşma İşleyicisi
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let thumbnail: string | undefined;
      if (file.type.startsWith("image/")) {
        const thumb = await generateImageThumbnail(file);
        if (thumb) thumbnail = thumb;
      }

      const meta = registerLocalFile(file, localParticipant.identity, username, thumbnail);
      await sendChatMessage(`VOXA_FILE::${JSON.stringify(meta)}`);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Dosya paylaşım hatası:", err);
    }
  };

  // Pano (Clipboard) Görsel Yapıştırma İşleyicisi (Ctrl+V)
  const handlePasteInChat = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      const file = e.clipboardData.files[0];
      e.preventDefault();
      try {
        let thumbnail: string | undefined;
        if (file.type.startsWith("image/")) {
          const thumb = await generateImageThumbnail(file);
          if (thumb) thumbnail = thumb;
        }
        const meta = registerLocalFile(file, localParticipant.identity, username, thumbnail);
        await sendChatMessage(`VOXA_FILE::${JSON.stringify(meta)}`);
      } catch (err) {
        console.error("Pano görsel paylaşım hatası:", err);
      }
    }
  };

  // P2P Dosya İndirme İşleyicisi
  const handleDownloadFile = (meta: SharedFileMeta) => {
    if (!p2pManagerRef.current) return;
    setDownloadingFileId(meta.id);
    setDownloadProgress((prev) => ({ ...prev, [meta.id]: 0 }));

    p2pManagerRef.current.requestDownload(
      meta,
      (percent) => {
        setDownloadProgress((prev) => ({ ...prev, [meta.id]: percent }));
      },
      () => {
        setDownloadProgress((prev) => ({ ...prev, [meta.id]: 100 }));
        setTimeout(() => setDownloadingFileId(null), 1200);
      },
      (errorMsg) => {
        alert(errorMsg || "P2P dosya indirme başarısız oldu.");
        setDownloadingFileId(null);
      }
    );
  };

  // P2P Dosya İndirmesini İptal Etme
  const handleCancelDownload = (fileId: string, senderIdentity?: string) => {
    if (p2pManagerRef.current) {
      p2pManagerRef.current.cancelTransfer(fileId, senderIdentity);
    }
    setDownloadingFileId(null);
    setDownloadProgress((prev) => {
      const copy = { ...prev };
      delete copy[fileId];
      return copy;
    });
  };

  // Lightbox Görselini İndirme İşleyicisi (Web ve Electron Uyumlu, Farklı Kaydet Destekli)
  const handleDownloadLightboxImage = async () => {
    if (!lightboxImage) return;
    try {
      // 1. Dosya yerel bellekte varsa tam kaliteli orijinal dosyayı diske kaydet
      if (lightboxImage.fileId) {
        const local = getLocalFile(lightboxImage.fileId);
        if (local) {
          await saveBlobToDisk(local, lightboxImage.name);
          return;
        }
      }

      // 2. Karşı taraftan tam dosyayı P2P üzerinden indirme talebi başlat
      if (lightboxImage.meta && p2pManagerRef.current) {
        handleDownloadFile(lightboxImage.meta);
        return;
      }

      // 3. Fallback: Mevcut URL / thumbnail üzerinden kaydet
      const res = await fetch(lightboxImage.url);
      const blob = await res.blob();
      await saveBlobToDisk(blob, lightboxImage.name);
    } catch (err) {
      console.error("Lightbox görsel indirme hatası:", err);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#1e1f22] text-[#f2f3f5] overflow-hidden select-none">
      {/* Tarayıcı Ses Otomatik Oynatma Engeli Uyarısı */}
      {!canPlayAudio && (
        <div
          onClick={() => room?.startAudio()}
          className="bg-[#5865f2] hover:bg-[#4752c4] text-white py-2.5 px-4 text-center text-xs font-extrabold cursor-pointer flex items-center justify-center gap-2 z-50 shadow-lg animate-pulse"
        >
          <Volume2 className="w-4 h-4 animate-bounce" />
          <span>Tarayıcınız diğer katılımcıların sesini engelledi. Sesleri duymak için BURAYA TIKLAYIN!</span>
        </div>
      )}

      {/* ÜST DAVET, ODA KİLİDİ VE ODA BARI */}
      <header className="h-16 bg-[#2b2d31] border-b border-[#1e1f22] px-6 flex items-center justify-between z-20 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#5865f2] rounded-xl flex items-center justify-center shadow">
            <Radio className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-wide">
                #{roomName}
              </h1>
              {isRoomLocked && (
                <span className="bg-[#f23f43]/20 border border-[#f23f43]/40 text-[#f23f43] text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Oda Kilitli
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Active Participants Badge */}
          <div className="flex items-center gap-2 bg-[#1e1f22] px-3.5 py-1.5 rounded-lg border border-[#313338] text-xs font-semibold text-[#949ba4]">
            <Users className="w-4 h-4 text-[#5865f2]" />
            <span>{participants.length} Katılımcı</span>
          </div>

          {/* Room Lock Button */}
          <button
            onClick={toggleRoomLock}
            disabled={isLockingPending}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border shadow ${
              isRoomLocked
                ? "bg-[#f23f43] hover:bg-[#d8363a] text-white border-[#f23f43]"
                : "bg-[#1e1f22] hover:bg-[#35373c] text-[#949ba4] border-[#313338]"
            } disabled:opacity-50`}
            title={isRoomLocked ? "Oda Kilidini Aç" : "Odayı Kilitle (Yeni Katılımcıları Engelle)"}
          >
            {isLockingPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isRoomLocked ? (
              <>
                <Lock className="w-4 h-4 text-white" />
                <span className="hidden sm:inline">Kilitli Oda</span>
              </>
            ) : (
              <>
                <Unlock className="w-4 h-4" />
                <span className="hidden sm:inline">Odayı Kilitle</span>
              </>
            )}
          </button>

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
            {unreadChatCount > 0 && (
              <span className="bg-[#f23f43] text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full animate-pulse">
                {unreadChatCount}
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

              {/* Çoklu Yayın Seçici Barı (Birden fazla kişi ekran paylaşıyorsa) */}
              {screenShareTracks.length > 1 && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 flex items-center gap-2 shadow-2xl z-30 max-w-[80%] overflow-x-auto">
                  <span className="text-[10px] uppercase font-bold text-[#949ba4] tracking-wider flex items-center gap-1 flex-shrink-0">
                    <Tv className="w-3.5 h-3.5 text-[#5865f2]" /> Yayınlar:
                  </span>
                  {screenShareTracks.map((st) => {
                    const isCurrent =
                      activeScreenShare?.publication?.trackSid === st.publication?.trackSid;
                    return (
                      <button
                        key={st.publication?.trackSid || st.participant.identity}
                        type="button"
                        onClick={() => {
                          setWatchedTrackSid(st.publication?.trackSid || null);
                          setIsWatchingStream(true);
                          setSelectedTrack(null);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
                          isCurrent
                            ? "bg-[#5865f2] text-white shadow-md ring-1 ring-white/20"
                            : "bg-[#1e1f22] text-[#949ba4] hover:text-white hover:bg-[#313338]"
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-[#23a55a] animate-pulse" />
                        <span>{getDisplayName(st.participant)}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Focus Badge Info & Yayından Ayrıl Butonu */}
              <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-xs text-white flex items-center gap-2 z-20">
                {activeFocusTrack.source === Track.Source.ScreenShare ? (
                  <>
                    <Monitor className="w-4 h-4 text-[#5865f2]" />
                    <span className="font-semibold">
                      {getDisplayName(activeFocusTrack.participant)} kullanıcısının canlı yayını
                    </span>
                    <span className="bg-[#5865f2] text-white text-[10px] font-black px-1.5 py-0.5 rounded">
                      AV1 • {SCREEN_SHARE_PRESETS[screenQuality].label.split(" ")[1]}
                    </span>
                    {/* Yayından Ayrıl Butonu */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsWatchingStream(false);
                        setSelectedTrack(null);
                      }}
                      className="ml-2 px-2.5 py-1 bg-[#f23f43]/85 hover:bg-[#f23f43] text-white text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 shadow cursor-pointer border border-red-500/30"
                      title="Yayını izlemeyi bırak ve sadece sesli sohbette kal"
                    >
                      <PhoneOff className="w-3.5 h-3.5" />
                      <span>Yayından Ayrıl</span>
                    </button>
                  </>
                ) : (
                  <>
                    <VideoIcon className="w-4 h-4 text-[#23a55a]" />
                    <span>{getDisplayName(activeFocusTrack.participant)} kamerasında</span>
                  </>
                )}
              </div>

              {/* Herhangi bir Ekran Paylaşımı İzlenirken Daima Görünür Canlı Yayın Ses Kısma Barı */}
              {activeFocusTrack.source === Track.Source.ScreenShare && (
                <div className="absolute bottom-4 left-4 bg-black/85 backdrop-blur-md p-3 rounded-2xl border border-white/20 text-xs text-white flex items-center gap-3 shadow-2xl z-30">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsScreenAudioMuted(!isScreenAudioMuted);
                    }}
                    className="p-2 bg-[#5865f2]/20 hover:bg-[#5865f2]/40 rounded-xl transition-colors text-[#5865f2]"
                    title={isScreenAudioMuted ? "Yayın Sesini Aç" : "Yayın Sesini Kapat"}
                  >
                    {isScreenAudioMuted || screenAudioVolume === 0 ? (
                      <VolumeX className="w-5 h-5 text-[#f23f43]" />
                    ) : (
                      <Volume2 className="w-5 h-5 text-[#23a55a]" />
                    )}
                  </button>
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-[#5865f2] animate-pulse" />
                      Yayın Sesi
                    </span>
                    <span className="text-[10px] text-[#949ba4]">
                      {activeScreenShareAudio ? "Sistem Sesi Aktif" : "Yayıncı Ses Kontrolü"}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={isScreenAudioMuted ? 0 : screenAudioVolume}
                    onChange={(e) => {
                      e.stopPropagation();
                      const val = Number(e.target.value);
                      setScreenAudioVolume(val);
                      if (isScreenAudioMuted) setIsScreenAudioMuted(false);
                      if (activeFocusTrack.participant) {
                        handleUserVolumeChange(activeFocusTrack.participant.identity, val);
                      }
                    }}
                    className="w-28 h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-[#5865f2]"
                  />
                  <span className="text-[11px] w-8 font-mono text-white text-right font-bold">
                    %{isScreenAudioMuted ? 0 : screenAudioVolume}
                  </span>
                </div>
              )}

              {/* Top Right Action Buttons (Tam Ekran & Reset Focus) */}
              <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
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
              <p className="text-sm text-[#949ba4] max-w-sm mb-4">
                Biri ekran paylaşımı açtığında veya kamera çalıştırdığında yayın burada AV1 düşük kota ve yüksek kalitede canlı görüntülenecek.
              </p>

              {/* Odada Aktif Yayın Varsa "Yayını İzle" Butonları */}
              {screenShareTracks.length > 0 && (
                <div className="mb-6 p-4 rounded-2xl bg-[#1e1f22]/70 border border-[#383a40] max-w-md w-full flex flex-col items-center gap-3 shadow-lg">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#23a55a] animate-pulse" />
                    <span>Odadaki Aktif Canlı Yayınlar ({screenShareTracks.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center w-full">
                    {screenShareTracks.map((st) => (
                      <button
                        key={st.publication?.trackSid || st.participant.identity}
                        type="button"
                        onClick={() => {
                          setWatchedTrackSid(st.publication?.trackSid || null);
                          setIsWatchingStream(true);
                          setSelectedTrack(null);
                        }}
                        className="px-3.5 py-2 bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-2 shadow cursor-pointer"
                      >
                        <Monitor className="w-4 h-4" />
                        <span>{getDisplayName(st.participant)} Yayınına Katıl</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

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

          {/* Gizli Doğrudan Ekran Sesi Çalıcısı (Garanti Oynatma) */}
          <audio
            ref={screenShareAudioElRef}
            playsInline
            autoPlay
            style={{ display: "none" }}
          />
        </div>

        {/* KATILIMCI GRID & SES DÜZEYİ KONTROLLERİ (Sağ Yan Panel) */}
        <div className="w-80 bg-[#2b2d31] border border-[#313338] rounded-2xl p-3 flex flex-col gap-3 overflow-y-auto">
          <div className="text-xs font-bold uppercase tracking-wider text-[#949ba4] px-2 pt-1 flex items-center justify-between">
            <span>Katılımcılar ({participants.length})</span>
            <Shield className="w-3.5 h-3.5 text-[#5865f2]" />
          </div>

          <div className="flex flex-col gap-3">
            {participants.map((p) => {
              const pTrack = videoTracks.find(
                (t) => t.participant.identity === p.identity && t.publication?.isSubscribed !== false
              );

              const isSpeaking = p.isSpeaking;
              const isMe = p.isLocal;
              const vol = userVolumes[p.identity] ?? 100;
              const isUserMuted = !!userMutedState[p.identity];
              const isVolumeOpen = openVolumeUserId === p.identity;
              const pAvatar = getParticipantAvatar(p);
              const isWatchingThisParticipant =
                isWatchingStream &&
                activeFocusTrack?.participant?.identity === p.identity &&
                activeFocusTrack?.source === Track.Source.ScreenShare;

              return (
                <div
                  key={p.identity}
                  className={`p-3 rounded-xl bg-[#313338] border transition-all flex flex-col gap-2.5 ${
                    isSpeaking ? "ring-2 ring-[#23a55a] border-transparent" : "border-[#1e1f22]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      onClick={() => pTrack && setSelectedTrack(pTrack)}
                      className="flex items-center gap-3 overflow-hidden cursor-pointer flex-1"
                    >
                      <div className="relative flex-shrink-0">
                        {pAvatar ? (
                          <img
                            src={pAvatar}
                            alt={getDisplayName(p)}
                            className="w-10 h-10 rounded-xl object-cover shadow"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-[#5865f2] rounded-xl flex items-center justify-center text-white font-bold text-sm shadow">
                            {getDisplayName(p).slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        {isSpeaking && (
                          <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#23a55a] rounded-full border-2 border-[#313338] flex items-center justify-center">
                            <Volume2 className="w-2.5 h-2.5 text-white" />
                          </span>
                        )}
                      </div>

                      <div className="truncate">
                        <p className="text-sm font-semibold text-white truncate">
                          {getDisplayName(p)} {isMe && "(Siz)"}
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

                    <div className="flex items-center gap-2 text-[#949ba4] flex-shrink-0">
                      {!p.isMicrophoneEnabled && <MicOff className="w-4 h-4 text-[#f23f43]" />}
                      
                      {/* Ekran Paylaşımı Varsa Yayını İzle / Ayrıl Butonları */}
                      {p.isScreenShareEnabled && (
                        <div className="flex items-center gap-1">
                          {isWatchingThisParticipant ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsWatchingStream(false);
                                setSelectedTrack(null);
                              }}
                              className="px-2 py-0.5 bg-[#f23f43]/20 hover:bg-[#f23f43] text-[#f23f43] hover:text-white rounded-md text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                              title="Bu yayını izlemeyi bırak"
                            >
                              <X className="w-3 h-3" />
                              <span>Ayrıl</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const targetTrack = screenShareTracks.find(
                                  (t) => t.participant.identity === p.identity
                                );
                                if (targetTrack) {
                                  setWatchedTrackSid(targetTrack.publication?.trackSid || null);
                                  setIsWatchingStream(true);
                                  setSelectedTrack(null);
                                }
                              }}
                              className="px-2 py-0.5 bg-[#5865f2]/20 hover:bg-[#5865f2] text-[#5865f2] hover:text-white rounded-md text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer animate-pulse"
                              title="Bu kullanıcının ekran yayınını izle"
                            >
                              <Monitor className="w-3 h-3" />
                              <span>İzle</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Diğer Kullanıcıların Ses Düzeyi Popover Açma Butonu */}
                      {!isMe && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenVolumeUserId(isVolumeOpen ? null : p.identity);
                          }}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                            isVolumeOpen || isUserMuted
                              ? "bg-[#5865f2]/20 border-[#5865f2] text-white"
                              : "bg-[#1e1f22] border-[#2b2d31] hover:bg-[#35373c] text-[#949ba4]"
                          }`}
                          title="Kullanıcı Ses Seviyesini Ayarla"
                        >
                          {isUserMuted || vol === 0 ? (
                            <VolumeX className="w-3.5 h-3.5 text-[#f23f43]" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5 text-[#23a55a]" />
                          )}
                          {isVolumeOpen ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Remote Participant Local Volume Controls (Sadece ses butonuna tıklanınca açılır) */}
                  {!isMe && isVolumeOpen && (
                    <div className="pt-2.5 border-t border-[#2b2d31] flex items-center gap-2 bg-[#1e1f22]/80 p-2.5 rounded-xl animate-in fade-in duration-150">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleUserMute(p.identity);
                        }}
                        className="p-1.5 hover:bg-[#313338] rounded-lg transition-colors text-[#949ba4] hover:text-white"
                        title={isUserMuted ? "Kullanıcının Sesini Aç" : "Kullanıcının Sesini Kapat"}
                      >
                        {isUserMuted || vol === 0 ? (
                          <VolumeX className="w-4 h-4 text-[#f23f43]" />
                        ) : (
                          <Volume2 className="w-4 h-4 text-[#23a55a]" />
                        )}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={isUserMuted ? 0 : vol}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleUserVolumeChange(p.identity, Number(e.target.value));
                        }}
                        className="flex-1 h-1.5 bg-[#313338] rounded-lg appearance-none cursor-pointer accent-[#5865f2]"
                      />
                      <span className="text-[10px] w-8 font-mono text-[#949ba4] text-right font-bold">
                        %{isUserMuted ? 0 : vol}
                      </span>
                    </div>
                  )}
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
            <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-[#2b2d31] select-text cursor-text">
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
                  const senderName = getDisplayName(msg.from);
                  const isMe = msg.from?.name === username || msg.from?.identity?.startsWith(`${username}#`) || senderName === username;
                  const formattedTime = new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  const isFileMessage = msg.message.startsWith("VOXA_FILE::");
                  let fileMeta: SharedFileMeta | null = null;
                  if (isFileMessage) {
                    try {
                      fileMeta = JSON.parse(msg.message.replace("VOXA_FILE::", ""));
                    } catch {}
                  }

                  const senderAvatar = getParticipantAvatar(msg.from);

                  return (
                    <div
                      key={idx}
                      className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 select-text">
                        {senderAvatar ? (
                          <img
                            src={senderAvatar}
                            alt={senderName}
                            className="w-4 h-4 rounded-full object-cover flex-shrink-0 shadow-sm"
                          />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-[#5865f2] text-[8px] text-white font-bold flex items-center justify-center flex-shrink-0">
                            {senderName.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <span className="text-[11px] font-bold text-white select-text">
                          {senderName}
                        </span>
                        <span className="text-[10px] text-[#949ba4] select-text">{formattedTime}</span>
                      </div>

                      {fileMeta ? (
                        <div
                          className={`p-3 rounded-xl text-xs max-w-[92%] select-text ${
                            isMe
                              ? "bg-[#5865f2] text-white rounded-tr-none"
                              : "bg-[#313338] text-[#f2f3f5] rounded-tl-none border border-[#1e1f22]"
                          }`}
                        >
                          {/* Resim Önizleme (Tıklanınca Lightbox Büyütme) */}
                          {fileMeta.isImage && fileMeta.thumbnail && (
                            <div
                              onClick={() =>
                                setLightboxImage({
                                  url: fileMeta!.thumbnail!,
                                  name: fileMeta!.name,
                                  fileId: fileMeta!.id,
                                  meta: fileMeta,
                                })
                              }
                              className="mb-2 max-w-[260px] rounded-lg overflow-hidden border border-black/20 bg-black/40 cursor-pointer group relative hover:opacity-95 transition-opacity"
                              title="Büyütmek için tıklayın"
                            >
                              <img
                                src={fileMeta.thumbnail}
                                alt={fileMeta.name}
                                className="w-full h-auto max-h-[200px] object-contain rounded-lg"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5">
                                <Maximize2 className="w-4 h-4" />
                                <span>Büyüt</span>
                              </div>
                            </div>
                          )}

                          {/* Dosya Bilgi Kartı */}
                          <div className="flex items-center gap-2.5 bg-black/20 p-2.5 rounded-lg border border-white/10">
                            <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                              {fileMeta.isImage ? (
                                <ImageIcon className="w-5 h-5 text-white" />
                              ) : (
                                <FileText className="w-5 h-5 text-white" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 pr-1">
                              <p className="font-bold text-xs truncate">{fileMeta.name}</p>
                              <p className="text-[10px] opacity-75">{formatFileSize(fileMeta.size)} • P2P</p>
                            </div>

                            {/* İndir ve İptal Butonları */}
                            {isMe ? (
                              <span className="text-[10px] font-semibold opacity-80 px-2 py-1 bg-white/10 rounded-md whitespace-nowrap">
                                Paylaşıldı
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <button
                                  type="button"
                                  disabled={downloadingFileId === fileMeta.id}
                                  onClick={() => handleDownloadFile(fileMeta!)}
                                  className="px-2.5 py-1.5 bg-[#23a55a] hover:bg-[#1f934f] text-white text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-50"
                                >
                                  {downloadingFileId === fileMeta.id ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      <span>
                                        {(downloadProgress[fileMeta.id] || 0) >= 100
                                          ? "Kaydediliyor..."
                                          : `%${downloadProgress[fileMeta.id] || 0}`}
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <Download className="w-3.5 h-3.5" />
                                      <span>İndir</span>
                                    </>
                                  )}
                                </button>

                                {/* İndirmeyi İptal Et Butonu */}
                                {downloadingFileId === fileMeta.id && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCancelDownload(fileMeta!.id, fileMeta!.senderIdentity)
                                    }
                                    className="p-1.5 bg-[#f23f43]/20 hover:bg-[#f23f43] text-[#f23f43] hover:text-white rounded-lg transition-all cursor-pointer"
                                    title="İndirmeyi İptal Et"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* İndirme İlerleme Çubuğu */}
                          {downloadingFileId === fileMeta.id && (
                            <div className="w-full bg-black/30 rounded-full h-1.5 mt-2 overflow-hidden">
                              <div
                                className="bg-[#23a55a] h-full transition-all duration-150"
                                style={{ width: `${downloadProgress[fileMeta.id] || 0}%` }}
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div
                          className={`p-2.5 rounded-xl text-xs max-w-[90%] break-words select-text cursor-text ${
                            isMe
                              ? "bg-[#5865f2] text-white rounded-tr-none"
                              : "bg-[#313338] text-[#f2f3f5] rounded-tl-none border border-[#1e1f22]"
                          }`}
                        >
                          {msg.message}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Chat Input Form (P2P Dosya & Görsel Destekli) */}
            <form
              onSubmit={handleSendChat}
              className="p-3 bg-[#313338] border-t border-[#1e1f22] flex items-center gap-2"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleUploadFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-[#949ba4] hover:text-white hover:bg-[#1e1f22] rounded-xl transition-all cursor-pointer flex-shrink-0"
                title="Dosya veya Görsel Gönder (P2P - Sunucu/Kota Harcamaz)"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onPaste={handlePasteInChat}
                placeholder="Mesaj yazın veya görsel yapıştırın..."
                className="flex-1 bg-[#1e1f22] border border-[#2b2d31] focus:border-[#5865f2] px-3 py-2 rounded-xl text-xs text-white placeholder-[#949ba4] outline-none transition-all"
              />
              <button
                type="submit"
                className="p-2 bg-[#5865f2] hover:bg-[#4752c4] text-white rounded-xl transition-all cursor-pointer shadow disabled:opacity-50 flex-shrink-0"
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
        {/* Left identity info & Avatar Değiştir Butonu */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setAvatarModalOpen(true)}
            className="relative w-10 h-10 rounded-xl bg-[#5865f2] flex items-center justify-center text-white font-bold cursor-pointer hover:ring-2 hover:ring-[#5865f2] group overflow-hidden shadow flex-shrink-0"
            title="Profil Avatarını Değiştir"
          >
            {roomAvatar ? (
              <img src={roomAvatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              username.slice(0, 2).toUpperCase()
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="w-3.5 h-3.5 text-white" />
            </div>
          </button>
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
            title={isMicrophoneEnabled ? "Mikrofonu Kapat (Kısayol: M)" : "Mikrofonu Aç (Kısayol: M)"}
          >
            {isMicrophoneEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>

          {/* Deafen Toggle */}
          <button
            onClick={toggleDeafen}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow ${
              isDeafened
                ? "bg-[#f23f43] hover:bg-[#d8363a] text-white"
                : "bg-[#313338] hover:bg-[#35373c] text-white border border-[#404249]"
            }`}
            title={isDeafened ? "Sağırlaştırmayı Kaldır (Kısayol: D)" : "Sağırlaştır (Gelen Tüm Sesleri Kapat - Kısayol: D)"}
          >
            {isDeafened ? <HeadphoneOff className="w-5 h-5 text-white" /> : <Headphones className="w-5 h-5 text-[#949ba4]" />}
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
            onClick={handleOpenScreenSharePicker}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow ${
              isScreenShareEnabled
                ? "bg-[#5865f2] hover:bg-[#4752c4] text-white"
                : "bg-[#313338] hover:bg-[#35373c] text-white border border-[#404249]"
            }`}
            title={isScreenShareEnabled ? "Ekran Paylaşımını Durdur" : "Ekran veya Pencere Paylaşımı Başlat"}
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
            title={isFullscreen ? "Tam Ekrandan Çık (Kısayol: F)" : "Yayını Tam Ekran Yap (Kısayol: F)"}
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
            title="Ses, Aygıt Seçimi, Yayın Kalitesi ve Görüşme Ayarları"
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

      {/* SES, YAYIN KALİTESİ VE GÖRÜŞME AYARLARI MODAL */}
      {settingsOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#2b2d31] border border-[#383a40] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#1e1f22] border-b border-[#313338] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#5865f2]/20 rounded-xl flex items-center justify-center text-[#5865f2]">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-wide">Ses & Yayın Ayarları</h2>
                  <p className="text-xs text-[#949ba4]">Krisp AI, Yayın Kalitesi ve Ekran Sesi tercihlerini yapılandırın</p>
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
            <div className="p-6 flex flex-col gap-5 max-h-[75vh] overflow-y-auto">
              {/* Profil Avatarı Tercihi */}
              <div className="bg-[#1e1f22] p-4 rounded-xl border border-[#313338] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#5865f2] flex items-center justify-center text-white font-bold overflow-hidden shadow">
                    {roomAvatar ? (
                      <img src={roomAvatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      username.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Profil Avatarınız</h3>
                    <p className="text-xs text-[#949ba4]">Avatarınızı değiştirin veya bilgisayarınızdan yeni görsel yükleyin</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAvatarModalOpen(true)}
                  className="px-3.5 py-2 bg-[#313338] hover:bg-[#35373c] text-white text-xs font-semibold rounded-xl border border-[#404249] transition-all cursor-pointer"
                >
                  Değiştir
                </button>
              </div>

              {/* 0. Giriş ve Çıkış Aygıtı Seçimi (Mikrofon & Hoparlör) */}
              <div className="bg-[#1e1f22] p-4 rounded-xl border border-[#313338] flex flex-col gap-3">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Mic className="w-4 h-4 text-[#5865f2]" />
                  <span>Ses Giriş ve Çıkış Aygıtları</span>
                </div>

                <div className="flex flex-col gap-3 mt-1">
                  {/* Mikrofon Seçimi */}
                  <div>
                    <label className="block text-xs font-bold text-[#949ba4] mb-1.5">
                      Mikrofon (Giriş Aygıtı)
                    </label>
                    <select
                      value={activeAudioInputId}
                      onChange={(e) => selectAudioInput(e.target.value)}
                      className="w-full bg-[#313338] border border-[#404249] focus:border-[#5865f2] text-xs font-medium text-white p-2.5 rounded-xl outline-none transition-all"
                    >
                      {audioInputDevices.map((dev) => (
                        <option key={dev.deviceId} value={dev.deviceId}>
                          {dev.label || `Mikrofon (${dev.deviceId.slice(0, 8)})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Hoparlör Seçimi */}
                  <div>
                    <label className="block text-xs font-bold text-[#949ba4] mb-1.5">
                      Hoparlör / Kulaklık (Çıkış Aygıtı)
                    </label>
                    <select
                      value={activeAudioOutputId}
                      onChange={(e) => selectAudioOutput(e.target.value)}
                      className="w-full bg-[#313338] border border-[#404249] focus:border-[#5865f2] text-xs font-medium text-white p-2.5 rounded-xl outline-none transition-all"
                    >
                      {audioOutputDevices.map((dev) => (
                        <option key={dev.deviceId} value={dev.deviceId}>
                          {dev.label || `Kulaklık (${dev.deviceId.slice(0, 8)})`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 1. Krisp AI Noise Filter Option */}
              <div
                onClick={handleToggleNoiseFilter}
                className="bg-[#1e1f22] p-4 rounded-xl border border-[#313338] hover:border-[#5865f2]/50 flex items-center justify-between gap-4 transition-all cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2.5 rounded-xl mt-0.5 transition-colors ${
                      isNoiseFilterEnabled
                        ? "bg-[#5865f2]/20 text-[#5865f2]"
                        : "bg-[#313338]"
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
                      Arka plandaki gürültüleri, klavye seslerini ve yankıyı otomatik olarak engeller. Tıklayarak açıp kapatabilirsiniz.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <button
                    type="button"
                    disabled={isNoiseFilterPending}
                    className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors ${
                      isNoiseFilterEnabled ? "bg-[#5865f2]" : "bg-[#313338]"
                    } ${isNoiseFilterPending ? "opacity-50" : ""}`}
                  >
                    <span
                      className={`inline-block w-5 h-5 transform rounded-full bg-white transition-transform ${
                        isNoiseFilterEnabled ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                  <span
                    className={`text-[10px] font-bold ${
                      isNoiseFilterEnabled ? "text-[#23a55a]" : "text-[#f23f43]"
                    }`}
                  >
                    {isNoiseFilterPending
                      ? "..."
                      : isNoiseFilterEnabled
                      ? "AÇIK"
                      : "KAPALI"}
                  </span>
                </div>
              </div>

              {/* 2. Ekran Paylaşımı Yayın Kalitesi Seçimi */}
              <div className="bg-[#1e1f22] p-4 rounded-xl border border-[#313338] flex flex-col gap-3">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Tv className="w-4 h-4 text-[#5865f2]" />
                  <span>Ekran Paylaşımı Çözünürlük & FPS</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  {(Object.keys(SCREEN_SHARE_PRESETS) as ScreenSharePresetKey[]).map((key) => {
                    const preset = SCREEN_SHARE_PRESETS[key];
                    const isSelected = screenQuality === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setScreenQuality(key)}
                        className={`p-3 rounded-xl border text-left text-xs font-semibold transition-all cursor-pointer flex flex-col gap-1 ${
                          isSelected
                            ? "bg-[#5865f2]/20 border-[#5865f2] text-white shadow"
                            : "bg-[#313338] border-[#404249] text-[#949ba4] hover:text-white hover:border-gray-500"
                        }`}
                      >
                        <span>{preset.label}</span>
                        <span className="text-[10px] opacity-75 font-mono">
                          {(preset.maxBitrate / 1000000).toFixed(1)} Mbps Max Bitrate
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Ekran Paylaşımı Ses Yakalama Opsiyonu */}
              <div className="bg-[#1e1f22] p-4 rounded-xl border border-[#313338] flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-[#5865f2]/20 text-[#5865f2] mt-0.5">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white">Ekran Sesi Yayınlama</span>
                    <p className="text-xs text-[#949ba4] mt-1 leading-relaxed">
                      Ekran paylaşımı yapılırken tarayıcı sekmesi veya sistem seslerinin de izleyicilere iletilmesini sağlar.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={screenAudioEnabled}
                    onChange={(e) => setScreenAudioEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-[#313338] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5865f2]"></div>
                </label>
              </div>

              {/* 4. Masaüstü Uygulaması (Son Versiyon & İndir) */}
              <div className="bg-[#1e1f22] p-4 rounded-xl border border-[#313338] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-[#5865f2]/20 text-[#5865f2] mt-0.5">
                    <Laptop className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">Voxa Masaüstü Uygulaması</span>
                      <span className="bg-[#23a55a]/20 text-[#23a55a] text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-[#23a55a]/30">
                        v1.0.4 (Son Sürüm)
                      </span>
                    </div>
                    <p className="text-xs text-[#949ba4] mt-1 leading-relaxed">
                      {isElectronApp
                        ? "Masaüstü uygulaması üzerinden bağlısınız. Tüm oyun/uygulama sesleri ve 2K 60 FPS yayınlar aktif."
                        : "Tüm uygulama ve oyun seslerini engelsiz 2K 60 FPS yayınlamak için masaüstü uygulamasını indirin."}
                    </p>
                  </div>
                </div>

                {!isElectronApp && (
                  <a
                    href="/api/download/desktop"
                    className="px-4 py-2 bg-[#5865f2] hover:bg-[#4752c4] active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow flex items-center gap-2 flex-shrink-0 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Masaüstü Uygulamasını İndir (.exe)</span>
                  </a>
                )}
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

      {/* MASAÜSTÜ EKRAN / PENCERE SEÇİM MODALI (ELECTRON SCREEN PICKER) */}
      {desktopPickerOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#2b2d31] border border-[#383a40] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 bg-[#1e1f22] border-b border-[#313338] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#5865f2]/20 rounded-xl flex items-center justify-center text-[#5865f2]">
                  <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-wide">Yayınlanacak Ekranı veya Pencereyi Seçin</h2>
                  <p className="text-xs text-[#949ba4]">Paylaşmak istediğiniz uygulama penceresine veya ekrana tıklayın</p>
                </div>
              </div>
              <button
                onClick={() => setDesktopPickerOpen(false)}
                className="p-1.5 rounded-xl text-[#949ba4] hover:text-white hover:bg-[#313338] transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-4 flex-1">
              {desktopSources.map((src) => (
                <div
                  key={src.id}
                  onClick={async () => {
                    setDesktopPickerOpen(false);
                    if ((window as any).electronAPI?.selectDesktopSource) {
                      try {
                        await (window as any).electronAPI.selectDesktopSource(src.id);
                      } catch (e) {
                        console.warn("Kaynak seçim hatası:", e);
                      }
                    }
                    toggleScreenShare();
                  }}
                  className="bg-[#1e1f22] border border-[#313338] hover:border-[#5865f2] rounded-xl p-2.5 flex flex-col gap-2 cursor-pointer transition-all hover:scale-[1.02] group shadow"
                >
                  <div className="w-full aspect-video bg-black rounded-lg overflow-hidden relative">
                    <img
                      src={src.thumbnail}
                      alt={src.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <p className="text-xs font-semibold text-[#f2f3f5] truncate group-hover:text-[#5865f2] transition-colors">
                    {src.name}
                  </p>
                </div>
              ))}
            </div>

            <div className="px-6 py-3.5 bg-[#1e1f22] border-t border-[#313338] flex justify-end">
              <button
                onClick={() => setDesktopPickerOpen(false)}
                className="px-4 py-2 bg-[#313338] hover:bg-[#35373c] text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GÖRSEL BÜYÜTME (LIGHTBOX) MODALI */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setLightboxImage(null)}
        >
          {/* Üst İşlem Butonları */}
          <div
            className="absolute top-4 right-4 flex items-center gap-3 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleDownloadLightboxImage}
              className="px-3.5 py-2 bg-[#23a55a] hover:bg-[#1f934f] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Görseli İndir</span>
            </button>
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all cursor-pointer"
              title="Kapat (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Orijinal Oranlı Görsel Gövdesi */}
          <div
            className="max-w-[90vw] max-h-[85vh] flex items-center justify-center overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxImage.url}
              alt={lightboxImage.name}
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/10"
            />
          </div>
          <p className="text-xs text-[#949ba4] mt-3 truncate max-w-md text-center">
            {lightboxImage.name}
          </p>
        </div>
      )}

      {/* ODA İÇİ AVATAR DEĞİŞTİRME / YÜKLEME MODALI */}
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
                  ref={roomAvatarInputRef}
                  accept="image/*"
                  onChange={handleRoomCustomAvatarUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => roomAvatarInputRef.current?.click()}
                  className="w-full py-3 px-4 bg-[#1e1f22] hover:bg-[#35373c] border border-dashed border-[#5865f2] rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm group"
                >
                  <Upload className="w-4 h-4 text-[#5865f2] group-hover:scale-110 transition-transform" />
                  <span>Bilgisayardan Fotoğraf Yükle</span>
                </button>
                <p className="text-[10px] text-[#949ba4] text-center mt-1">
                  PNG, JPG veya WebP (Otomatik kare optimize edilir ve hatırlanır)
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
                    onClick={() => handleUpdateRoomAvatar(av.url)}
                    className={`relative p-2 rounded-xl bg-[#1e1f22] border transition-all hover:scale-105 flex flex-col items-center gap-1.5 cursor-pointer ${
                      roomAvatar === av.url
                        ? "border-[#5865f2] ring-2 ring-[#5865f2]/40"
                        : "border-[#313338] hover:border-gray-500"
                    }`}
                  >
                    <img src={av.url} alt={av.name} className="w-12 h-12 rounded-lg" />
                    <span className="text-[10px] text-[#949ba4] font-medium truncate w-full text-center">
                      {av.name}
                    </span>
                    {roomAvatar === av.url && (
                      <span className="absolute top-1 right-1 w-4 h-4 bg-[#5865f2] rounded-full flex items-center justify-center shadow">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Avatarı Sıfırla / Kaldır */}
              {roomAvatar && (
                <button
                  type="button"
                  onClick={handleRemoveRoomAvatar}
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

function RoomContainer() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawRoom = (params?.roomName as string) || "";
  const roomName = decodeURIComponent(rawRoom).trim().toLowerCase();
  const usernameParam = searchParams.get("username");
  const username = usernameParam?.trim() || "";

  const [token, setToken] = useState<string>("");
  const [wsUrl, setWsUrl] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    if (!usernameParam) {
      router.replace(`/?room=${encodeURIComponent(roomName)}`);
      return;
    }

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
  }, [roomName, username, usernameParam, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1e1f22] flex flex-col items-center justify-center text-white gap-4">
        <Loader2 className="w-12 h-12 text-[#5865f2] animate-spin" />
        <h2 className="text-lg font-bold">Odaya Bağlanılıyor...</h2>
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
          simulcast: true,
          videoCodec: "av1",
          backupCodec: true,
        },
        adaptiveStream: true,
        dynacast: true,
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
