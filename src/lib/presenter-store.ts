'use client';

import { create } from 'zustand';
import { presenterConfig } from '@/config/presenter';
import type { RevealId } from '@/config/presenter-reveal';

type PresenterState = { mode: 'guided' | 'live'; revealIndex: number; playing: boolean; setMode: (mode: PresenterState['mode']) => void; next: () => void; previous: () => void; togglePlay: () => void; reset: () => void; isRevealed: (id: RevealId) => boolean; };
const revealOrder: RevealId[] = ['sql', 'role', 'rls', 'rows', 'result'];

export const usePresenterStore = create<PresenterState>((set, get) => ({
  mode: 'guided', revealIndex: 0, playing: false,
  setMode: (mode) => set({ mode }),
  next: () => set((state) => ({ revealIndex: Math.min(state.revealIndex + 1, presenterConfig.revealLabels.length - 1) })),
  previous: () => set((state) => ({ revealIndex: Math.max(state.revealIndex - 1, 0) })),
  togglePlay: () => set((state) => ({ playing: !state.playing })),
  reset: () => set({ revealIndex: 0, playing: false }),
  isRevealed: (id) => get().mode === 'live' || revealOrder.indexOf(id) <= get().revealIndex,
}));
