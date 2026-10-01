/**
 * Shared motion vocabulary.
 *
 * Every transition in the app is built from these presets, so a panel, a menu and a page entrance
 * all accelerate and settle the same way. That consistency, not the duration numbers, is what reads
 * as "professional": a pop-up that scales on one curve while the page behind it slides on another
 * feels like two different products.
 *
 * Conventions:
 * - Entrance is longer than exit (0.26s in, 0.16s out). Elements arriving deserve the read; leaving
 *  ones should not block the next click.
 * - Distances are small (4 to 12 px). Anything larger reads as a slide deck.
 * - `easeOut` is the signature curve: fast start, long soft landing.
 * - Nothing animates `width`/`height` (layout thrash); collapse animations use `scaleY`/`grid-template-rows`.
 *
 * `prefers-reduced-motion` is handled by motion's `useReducedMotion` at each call site: spread
 * `useReducedMotion() ? STILL : <preset>` over the animated props. The CSS kill-switch in
 * `globals.css` cannot reach these, because motion writes inline transforms rather than CSS
 * transitions.
 */

import { useReducedMotion } from 'motion/react';

/** Fast start, long soft landing. The only ease used for entrances. */
export const easeOut = [0.22, 1, 0.36, 1] as const;

/**
 * A page (or a lesson article) arriving. Opacity only, deliberately: a transform on an ancestor of
 * a `position: fixed` element makes that ancestor its containing block, and the page chrome is full
 * of fixed things (the copilot launcher and panel, the ⌘K overlay, the assistant sheet, tooltips).
 * A `y` entrance would park them inside the wrapper at the wrong offset, permanently, because motion
 * leaves `transform: translateY(0px)` on the node when it settles. A fade costs nothing and breaks
 * nothing.
 */
export const pageIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.22, ease: easeOut },
};

/** A centered dialog: backdrop + panel, the panel grows from 98%. */
export const dialog = {
  backdrop: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.16, ease: easeOut },
  },
  panel: {
    initial: { opacity: 0, y: -8, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -6, scale: 0.985 },
    transition: { duration: 0.22, ease: easeOut },
  },
};

/** A menu, popover or dropdown attached to the thing that opened it. */
export const popover = (offset = -4) => ({
  initial: { opacity: 0, y: offset, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: offset, scale: 0.98 },
  transition: { duration: 0.16, ease: easeOut },
});

/** A sheet rising from an edge (the assistant on a phone). */
export const sheet = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 24 },
  transition: { duration: 0.24, ease: easeOut },
};

/** Swapping the content of a fixed panel (a translated lesson, an assistant answer). */
export const swap = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.18, ease: easeOut },
};

/**
 * A tab strip swap inside a panel. `AnimatePresence mode="wait"` runs the exit to completion before
 * the new tab enters, so the two halves add up: measured on the playground bottom panel, 0.14 s each
 * settled at 298 ms, which for a control as instant as a tab reads as "the app is loading something".
 * At 0.11 s the same swap measures 196 ms on a production build and still reads as one move.
 */
export const tabSwap = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.11, ease: easeOut },
};

/**
 * Opacity with no movement, for things that must not move: a panel that occupies a grid column (a
 * `y` entrance would shove its neighbours), a collapsing region whose height snaps anyway, a dialog
 * backdrop.
 */
export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.18, ease: easeOut },
};

/** A list item entering inside an open menu. */
export const listItem = (i: number) => ({
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.18, delay: i * 0.03, ease: easeOut },
});

/**
 * Props that neutralise an animation. Spread over a preset's props when the visitor asked for
 * reduced motion: `{...(still ? STILL : pageIn)}`. Not `transition: {duration: 0}` alone, because
 * that leaves the element parked on its `initial` frame.
 */
export const STILL = { initial: undefined, animate: undefined, exit: undefined, transition: { duration: 0 } };

/** `STILL` plus a reduced-motion read, for the common "one hook, several presets" case. */
export function useMotionPresets() {
  const still = useReducedMotion();
  return {
    still: Boolean(still),
    /** Spread these over the animated props of one element. */
    page: Boolean(still) ? STILL : pageIn,
    panel: Boolean(still) ? STILL : dialog.panel,
    backdrop: Boolean(still) ? STILL : dialog.backdrop,
    swap: Boolean(still) ? STILL : swap,
    tab: Boolean(still) ? STILL : tabSwap,
    fade: Boolean(still) ? STILL : fade,
    sheet: Boolean(still) ? STILL : sheet,
    /**
     * Menus and dropdowns hang off the trigger at the default offset, so this one is the finished
     * props rather than a factory: `const { popover: menu } = useMotionPresets()` then `{...menu}` is
     * the shape every call site wants, and spreading a factory silently animates nothing.
     */
    popover: Boolean(still) ? STILL : popover(),
    /** A popover that opens from an edge other than the default 4 px above its trigger. */
    popoverFrom: (offset: number) => (Boolean(still) ? STILL : popover(offset)),
    /** A row entering inside an open menu; the index is the stagger. Named as a call, deliberately. */
    listItemIn: (i: number) => (Boolean(still) ? STILL : listItem(i)),
  };
}
