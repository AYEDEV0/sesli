export interface YouTubeTrack {
  id: string; // YouTube Video ID
  title: string;
  channelTitle: string;
  thumbnail: string;
  durationMs: number;
  durationFormatted?: string;
  addedBy?: string;
  addedAt?: number;
}

export interface YouTubePlaybackState {
  currentTrack: YouTubeTrack | null;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  lastUpdated: number;
  djIdentity: string | null;
  djName: string | null;
  queue: YouTubeTrack[];
  voteSkips: string[]; // Geçiş için oy veren katılımcı kimlikleri
}

export type YouTubeActionType =
  | "VOXA_YT_PLAY"
  | "VOXA_YT_PAUSE"
  | "VOXA_YT_SEEK"
  | "VOXA_YT_QUEUE_ADD"
  | "VOXA_YT_QUEUE_REMOVE"
  | "VOXA_YT_SKIP"
  | "VOXA_YT_VOTE_SKIP"
  | "VOXA_YT_SYNC_REQ"
  | "VOXA_YT_SYNC_STATE";

export interface YouTubeSyncMessage {
  type: YouTubeActionType;
  track?: YouTubeTrack;
  positionMs?: number;
  sentAt: number;
  senderIdentity: string;
  senderName: string;
  state?: Partial<YouTubePlaybackState>;
  trackId?: string;
}
