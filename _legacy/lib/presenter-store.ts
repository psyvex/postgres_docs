'use client';

import { create } from 'zustand';
import { presenterConfig } from '@/config/presenter';
import { focusJourney, type JourneyFocus } from '@/config/focus-journey';

type PresenterState = { mode: 'guided' | 'live'; revealIndex: number; playing: boolean; setMode: (mode: PresenterState['mode']) => void; next: () => void; previous: () => void; togglePlay: () => void; reset: () => void; isRevealed: (id: JourneyFocus) => boolean; isFocused: (id: JourneyFocus) => boolean; };

export const usePresenterStore = create<PresenterState>((set, get) => ({
  mode: 'guided', revealIndex: 0, playing: false,
  setMode: (mode) => set({ mode }),
  next: () => set((state) => ({ revealIndex: Math.min(state.revealIndex + 1, focusJourney.length - 1) })),
  previous: () => set((state) => ({ revealIndex: Math.max(state.revealIndex - 1, 0) })),
  togglePlay: () => set((state) => ({ playing: !state.playing })),
  reset: () => set({ revealIndex: 0, playing: false }),
  isRevealed: (id) => get().mode === 'live' || focusJourney.findIndex((step) => step.id === id) <= get().revealIndex,
  isFocused: (id) => get().mode === 'live' ? false : focusJourney[get().revealIndex]?.id === id,
}));

export const presenterSteps = presenterConfig;
