'use client';

import { create } from 'zustand';
import { presenterConfig } from '@/config/presenter';

type PresenterState = {
  mode: 'guided' | 'live';
  revealIndex: number;
  playing: boolean;
  setMode: (mode: PresenterState['mode']) => void;
  next: () => void;
  previous: () => void;
  togglePlay: () => void;
  reset: () => void;
};

export const usePresenterStore = create<PresenterState>((set) => ({
  mode: 'guided', revealIndex: 0, playing: false,
  setMode: (mode) => set({ mode }),
  next: () => set((state) => ({ revealIndex: Math.min(state.revealIndex + 1, presenterConfig.revealLabels.length - 1) })),
  previous: () => set((state) => ({ revealIndex: Math.max(state.revealIndex - 1, 0) })),
  togglePlay: () => set((state) => ({ playing: !state.playing })),
  reset: () => set({ revealIndex: 0, playing: false }),
}));
