'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { LayoutGroup, motion } from 'motion/react';
import { useMotionPresets } from '@/lib/motion';
import clsx from 'clsx';

type Heading = { id: string; text: string; level: number };

/** Breathing room kept above and below the active row when the rail auto-scrolls it into view. */
const LIST_PAD = 12;

/**
 * How far below the top of the viewport a heading has to be to count as the section in view.
 *
 * This must sit *below* `scroll-margin-top: 5rem` (80 px) in `globals.css`, which is where the browser
 * parks a heading after a TOC click. At 72 px the clicked heading lands 8 px under the line and the
 * spy picks the section before it — the two authorities disagreeing by one section, which is exactly
 * the flicker this whole component exists to avoid.
 */
const FOLD = 96;

/** Table of contents built from the rendered lesson headings, with scroll-spy. */
export function OnThisPage() {
  const pathname = usePathname();
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const { still } = useMotionPresets();

  const nodesRef = useRef<HTMLElement[]>([]);
  const listRef = useRef<HTMLUListElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // True while a click-initiated scroll is in flight. During an animated jump the sections being flown
  // over are not where the reader is going, so the geometry below would spend the whole scroll lighting
  // up wrong sections — and land wrong at the end, since the clicked heading can be left behind by the
  // spy the instant the next one crosses the line. A click owns the marker until scrolling settles.
  const locked = useRef(false);

  const evaluate = useCallback(() => {
    if (locked.current) return;
    const nodes = nodesRef.current;
    if (!nodes.length) return;
    // Reaching the bottom is its own answer. The last section of a lesson can be shorter than the
    // viewport, so its heading may never pass the line even at maximum scroll — measured on the RLS
    // lesson, where scrolling to the end left "Performance tips" lit while the last item is "Check
    // yourself".
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      setActive(nodes.at(-1)!.id);
      return;
    }
    // `getBoundingClientRect`, not `offsetTop`: offsetTop is measured against the nearest positioned
    // ancestor, not the document, so it silently disagrees with `scrollY` the moment any wrapper around
    // the article becomes positioned. A rect is document truth by construction.
    const top = (el: Element) => el.getBoundingClientRect().top + window.scrollY;
    const line = window.scrollY + FOLD;
    if (line < top(nodes[0]!)) {
      setActive(null); // above the first section: nothing is "current" yet
      return;
    }
    let chosen = nodes[0]!;
    for (const n of nodes) {
      if (top(n) <= line) chosen = n;
      else break;
    }
    setActive(chosen.id);
  }, []);

  /** Safety net for a `scrollend` that never arrives — see the effect below. */
  const arm = useCallback(
    (ms: number) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        locked.current = false;
        evaluate();
      }, ms);
    },
    [evaluate],
  );

  /**
   * Moves the highlight immediately, then leaves the scrolling to the browser.
   *
   * Deliberately not `preventDefault` + `scrollIntoView`: the native anchor is what updates the hash
   * (so a link to this exact moment stays copyable) and moves focus, and `scroll-behavior: smooth` in
   * `globals.css` already makes it glide. What the browser cannot know is that the click was a
   * *statement* about where the reader wants to be — that part is worth holding on to.
   */
  const goTo = useCallback(
    (id: string) => {
      locked.current = true;
      setActive(id);
      // `scrollend` is the real unlock; see the effect below. This covers the one case where no scroll
      // happens at all — the reader clicked the section they are already on — because then no scroll
      // event and no `scrollend` would ever arrive, and the spy would stay dead for the rest of the
      // lesson. The first scroll event re-arms it.
      arm(1200);
    },
    [arm],
  );

  useEffect(() => {
    const collect = () => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('.prose-lab h2[id], .prose-lab h3[id]'));
      nodesRef.current = nodes;
      setHeadings(nodes.map((n) => ({ id: n.id, text: n.textContent ?? '', level: n.tagName === 'H2' ? 2 : 3 })));
    };
    collect();

    // Scroll-spy by direct arithmetic rather than IntersectionObserver, because the observer reports
    // only headings whose intersection *changed* in this batch. A jump — a TOC click, a hash on load,
    // a scroll to the end — can settle without the section now in view ever appearing in that batch, so
    // nothing fires and the highlight stays wherever it last was. Positions are cheap to read (a dozen
    // `offsetTop`s, once per animation frame at worst) and never stale.
    let raf = 0;
    const onScroll = () => {
      // Re-arm on every scroll event, so the backstop can only fire after the page has gone quiet for
      // 800 ms — far longer than the gap between two scroll events even in a throttled tab (measured:
      // 250 ms at this browser's ~4 Hz frame budget), and far longer than the 1.2 s a 9,800 px glide
      // takes, so it can never unlock mid-scroll and show the section being flown over.
      if (locked.current) arm(800);
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        evaluate();
      });
    };
    // `scrollend` rather than a debounce on `scroll`. Debouncing needs a quiet window longer than the
    // gap between scroll events, and that gap is one frame — measured in this browser at 250 ms, where
    // any window short enough to feel instant unlocks the marker mid-flight and one long enough to be
    // safe leaves it stale. The event is the browser stating the scroll is over, at any frame rate.
    const onScrollEnd = () => {
      if (!locked.current) return;
      locked.current = false;
      clearTimeout(timer.current);
      evaluate();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scrollend', onScrollEnd);
    window.addEventListener('resize', evaluate);
    evaluate();

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('scrollend', onScrollEnd);
      window.removeEventListener('resize', evaluate);
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(timer.current);
    };
  }, [pathname, arm, evaluate]);

  // Keep the active row inside the sidebar's own scroll box. The lesson rail is `sticky` with
  // `overflow-y-auto`, so on a long lesson the current section slides out of the rail while the page
  // itself scrolls fine — the reader gets a live indicator they cannot read. `scrollIntoView` is the
  // wrong tool: it walks every scrollable ancestor, including the window, and would fight the very
  // scroll the click just started. Adjusting this container's `scrollTop` touches nothing else.
  useEffect(() => {
    const link = activeRef.current;
    const list = listRef.current;
    if (!link || !list) return;
    // The scroller is NOT the list. The rail is a sticky `div` with `overflow-y-auto` wrapping several
    // blocks (the TOC, the references, the mini schema); the `<ul>` itself is `overflow: visible`, so
    // `scrollTo` on it is a silent no-op — measured as `overflow-y: visible` on the list element. Walk
    // up to whatever actually clips.
    let scroller: HTMLElement | null = list.parentElement;
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
    if (!scroller) return;

    const top = link.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
    const bottom = top + link.offsetHeight;
    // Only nudge when actually outside, and only as far as needed — a rail that recentres itself on
    // every section swims during a read.
    const behavior = (still ? 'auto' : 'smooth') as ScrollBehavior;
    if (top < scroller.scrollTop) scroller.scrollTo({ top: top - LIST_PAD, behavior });
    else if (bottom > scroller.scrollTop + scroller.clientHeight) scroller.scrollTo({ top: bottom - scroller.clientHeight + LIST_PAD, behavior });
  }, [active, still]);

  if (!headings.length) return null;
  return (
    <div>
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">On this page</div>
      <LayoutGroup>
        <ul ref={listRef} className="space-y-1 border-l border-line text-sm">
          {headings.map((h) => (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                ref={active === h.id ? activeRef : undefined}
                onClick={() => goTo(h.id)}
                aria-current={active === h.id ? 'location' : undefined}
                className={clsx(
                  'relative -ml-px block border-l-2 py-0.5 transition-colors',
                  h.level === 3 ? 'pl-6 text-[13px]' : 'pl-3',
                  active === h.id ? 'font-semibold text-brand' : 'border-transparent text-muted hover:text-text',
                )}
              >
                {/* One shared `layoutId`, so the marker travels between headings instead of blinking
                    from one to the next: the reader keeps the thread of where they are in the lesson. */}
                {active === h.id &&
                  (still ? (
                    <span className="absolute inset-y-0 -left-0.5 w-0.5 rounded-full bg-brand" />
                  ) : (
                    <motion.span
                      layoutId="toc-active"
                      className="absolute inset-y-0 -left-0.5 w-0.5 rounded-full bg-brand"
                      transition={{ type: 'spring', stiffness: 520, damping: 42 }}
                    />
                  ))}
                {h.text}
              </a>
            </li>
          ))}
        </ul>
      </LayoutGroup>
    </div>
  );
}
