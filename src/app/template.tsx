'use client';

import { motion } from 'motion/react';
import { useMotionPresets } from '@/lib/motion';

/**
 * Page transition. Next remounts a `template` on every navigation (that is its documented behaviour,
 * and the reason a page's own state never survives a route change), which makes this the one place a
 * page entrance can be animated without a client-side router shim.
 *
 * `loading.tsx` covers the gap while a route resolves; this covers the arrival, so navigating from a
 * lesson into the playground fades instead of repainting.
 * Opacity only, see `pageIn` in `lib/motion` for why a rise is not safe here.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const { page } = useMotionPresets();
  return <motion.div {...page}>{children}</motion.div>;
}
