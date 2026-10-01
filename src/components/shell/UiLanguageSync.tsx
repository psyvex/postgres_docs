'use client';
import { useEffect } from 'react';
import { syncDocumentLanguage } from '@/lib/i18n/store';

/**
 * Renders nothing. The pre-paint script in `app/layout.tsx` gets one chance per full load, so two
 * paths leave `<html>` describing a language this page does not render: another tab changed the
 * preference, and /settings wiped storage under an open page. This re-applies it once on mount.
 */
export function UiLanguageSync() {
  useEffect(() => {
    syncDocumentLanguage();
  }, []);
  return null;
}
