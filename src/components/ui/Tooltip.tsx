'use client';

/**
 * One global tooltip for the whole app.
 *
 * It is delegated: a single pair of document listeners upgrades every `title="…"` attribute that
 * already exists in the codebase, buttons, icons, badges, chips, into a themed tooltip, with no
 * call-site changes. New components just write `title` and inherit the behaviour.
 *
 * Suppressing the native tooltip: the browser paints `title` on its own schedule, so on show the
 * text is moved to `data-tip` and `title` is removed, then restored on hide. (React re-adds `title`
 * on re-render; the show path reads whichever attribute currently carries the text, so a re-render
 * mid-hover costs nothing.) `data-tip` alone also works, for content that must not be a native
 * tooltip at all.
 *
 * Conventions: `z-[80]` (above modal 60 / toast 70, below the splash's 100); tokens only;
 * `useReducedMotion` drops the entrance animation. Touch pointers are ignored deliberately: a
 * tooltip that sticks to a tapped element is worse than none. Disabled controls get no tooltip,
 * because Chrome fires no pointer events on them; that is the accepted cost of delegation.
 */
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const SHOW_MS = 120; // faster than the browser's own ~500–700 ms
const GAP = 6;
const EDGE = 8;
const TIP_ID = 'lab-tooltip';

type Tip = { text: string; x: number; y: number; below: boolean };

const tipText = (el: Element) => el.getAttribute('data-tip') ?? el.getAttribute('title');

export function TooltipLayer() {
  const still = useReducedMotion();
  const [tip, setTip] = useState<Tip | null>(null);
  const [measured, setMeasured] = useState<{ w: number; h: number } | null>(null);
  const node = useRef<HTMLDivElement | null>(null);
  const timer = useRef<number | null>(null);
  const shown = useRef<Element | null>(null);
  const taken = useRef<string | null>(null);

  // Clamp the centre x once the real width is known, so a tooltip near an edge stays inside it.
  useLayoutEffect(() => {
    if (tip && node.current) {
      const r = node.current.getBoundingClientRect();
      if (!measured || Math.abs(measured.w - r.width) > 1 || Math.abs(measured.h - r.height) > 1) {
        setMeasured({ w: r.width, h: r.height });
      }
    }
  }, [tip, measured]);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clear();
    const el = shown.current;
    if (el) {
      if (taken.current !== null) el.setAttribute('title', taken.current);
      el.removeAttribute('data-tip-shown');
      el.removeAttribute('aria-describedby');
    }
    taken.current = null;
    shown.current = null;
    setTip(null);
  }, [clear]);

  const show = useCallback((el: Element) => {
    const text = tipText(el);
    if (!text) return;
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return; // scrolled out of view
    // Take the title so the native tooltip cannot also appear.
    if (el.hasAttribute('title')) {
      taken.current = el.getAttribute('title');
      el.removeAttribute('title');
    } else {
      taken.current = null;
    }
    el.setAttribute('data-tip-shown', '');
    el.setAttribute('aria-describedby', TIP_ID);
    shown.current = el;
    setMeasured(null);
    setTip({
      text,
      x: r.left + r.width / 2,
      y: r.top - GAP,
      below: r.top < 40, // flip under for items at the very top of the viewport
    });
  }, []);

  useEffect(() => {
    const onOver = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const el = (e.target as Element | null)?.closest?.('[title],[data-tip]') ?? null;
      if (el === shown.current) return; // moving within the same target
      const over = (e.relatedTarget as Element | null)?.closest?.('[title],[data-tip]');
      if (el && el === over) return;
      hide();
      if (!el) return;
      const t = el;
      clear();
      timer.current = window.setTimeout(() => {
        timer.current = null;
        show(t);
      }, SHOW_MS);
    };

    const onOut = (e: PointerEvent) => {
      const from = (e.target as Element | null)?.closest?.('[title],[data-tip]');
      const to = (e.relatedTarget as Element | null)?.closest?.('[title],[data-tip]');
      if (from && from !== to) hide();
    };

    // Keyboard focus gets the tooltip immediately: a focused control is a deliberate target.
    const onFocusIn = (e: FocusEvent) => {
      const el = (e.target as Element | null)?.closest?.('[title],[data-tip]');
      if (!el || el === shown.current) return;
      hide();
      show(el);
    };
    const onFocusOut = () => hide();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    const onScroll = () => hide();

    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerout', onOut);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      clear();
    };
  }, [hide, show, clear]);

  // Centre of the bubble, kept inside the viewport now that its width is known.
  let cx = tip?.x ?? 0;
  if (tip && measured) {
    const half = measured.w / 2;
    cx = Math.min(Math.max(tip.x, half + EDGE), innerWidth - half - EDGE);
  }
  // `y` is the anchor edge: above the item's top, or below its bottom when flipped.
  const anchorY = tip ? (tip.below ? (tip.y as number) : tip.y) : 0;

  return (
    <AnimatePresence>
      {tip && (
        <motion.div
          ref={node}
          id={TIP_ID}
          role="tooltip"
          initial={still ? { opacity: 1 } : { opacity: 0, y: tip.below ? -3 : 3, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={still ? { opacity: 0 } : { opacity: 0, transition: { duration: 0.1 } }}
          transition={{ duration: 0.14, ease: 'easeOut' }}
          style={{
            left: cx,
            top: tip.below ? anchorY + GAP * 2 + (shown.current?.getBoundingClientRect().height ?? 0) : anchorY,
            transform: 'translate(-50%, -100%)',
          }}
          className="pointer-events-none fixed z-[80] max-w-[260px] rounded-lg bg-code-bg px-2 py-1 text-center text-[11px] font-medium leading-snug text-code-text shadow-card"
        >
          {tip.text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
