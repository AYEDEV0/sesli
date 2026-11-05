export interface SpotifyTrack {
  id: string;
  name: string;
  artists: string;
  albumName: string;
  albumArt: string;
  durationMs: number;
  uri?: string;
  previewUrl?: string | null;
  externalUrl?: string;
  addedBy?: string;
  addedAt?: number;
}

export type SpotifyAudioMode = "hybrid_auto" | "spotify_sdk" | "voxa_stream";

export interface SpotifyPlaybackState {
  currentTrack: SpotifyTrack | null;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  lastUpdated: number; // Date.now() at time of action
  djIdentity: string | null;
  djName: string | null;
  queue: SpotifyTrack[];
  voteSkips: string[]; // List of participant identities who voted
  audioMode: SpotifyAudioMode;
}

export type SpotifyActionType =
  | "VOXA_SPOTIFY_PLAY"
  | "VOXA_SPOTIFY_PAUSE"
  | "VOXA_SPOTIFY_SEEK"
  | "VOXA_SPOTIFY_QUEUE_ADD"
  | "VOXA_SPOTIFY_QUEUE_REMOVE"
  | "VOXA_SPOTIFY_SKIP"
  | "VOXA_SPOTIFY_VOTE_SKIP"
  | "VOXA_SPOTIFY_SYNC_REQ"
  | "VOXA_SPOTIFY_SYNC_STATE"
  | "VOXA_SPOTIFY_MODE_CHANGE";

export interface SpotifySyncMessage {
  type: SpotifyActionType;
  track?: SpotifyTrack;
  positionMs?: number;
  sentAt: number;
  senderIdentity: string;
  senderName: string;
  state?: Partial<SpotifyPlaybackState>;
  trackId?: string;
  audioMode?: SpotifyAudioMode;
}

