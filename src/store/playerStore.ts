import { create } from "zustand";
import type { NesChannelId, NsfMetadata } from "../audio/types";

interface PlayerState {
  metadata: NsfMetadata | null;
  fileData: ArrayBuffer | null;
  error: string | null;
  loading: boolean;
  muted: Record<NesChannelId, boolean>;
  setLoadedFile: (data: ArrayBuffer, metadata: NsfMetadata) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  toggleMuted: (channel: NesChannelId) => void;
  reset: () => void;
}

const initialMuted = {
  pulse1: false,
  pulse2: false,
  triangle: false,
  noise: false,
  dpcm: false
};

export const usePlayerStore = create<PlayerState>((set) => ({
  metadata: null,
  fileData: null,
  error: null,
  loading: false,
  muted: initialMuted,
  setLoadedFile: (fileData, metadata) => set({ fileData, metadata, error: null, loading: false }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
  toggleMuted: (channel) =>
    set((state) => ({ muted: { ...state.muted, [channel]: !state.muted[channel] } })),
  reset: () => set({ metadata: null, fileData: null, error: null, muted: initialMuted })
}));
