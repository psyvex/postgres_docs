'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { streamAi, type AiPayload, type AiTask } from '@/lib/ai/client';

/**
 * Answers live here, outside React, so closing a panel never costs a request:
 * the streaming request is owned by the store (not by the mounted component), so
 * closing the copilot mid-answer lets it finish in the background, and reopening
 * shows what arrived. Finished answers are mirrored to localStorage, so a reload
 * doesn't re-ask either. Keyed by the request, so an identical ask is served free.
 */
const STORE_KEY = 'postgres-lab:ai-cache';
const MAX_PERSISTED = 24;
const TTL = 7 * 24 * 60 * 60 * 1000;

export type AiUsage = { i: number; o: number };

type Entry = {
  text: string;
  done: boolean;
  failed: boolean;
  started: boolean;
  usage?: AiUsage;
  subs: Set<() => void>;
};

const mem = new Map<string, Entry>();
let disk: Record<string, { t: string; at: number }> | null = null;

/** djb2 over the payload — enough to tell two asks apart without shipping the key. */
function hash(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return `${(h >>> 0).toString(36)}:${s.length}`;
}

/** Everything that changes the answer is in the key, so a new key means a real new request. */
export function aiCacheKey(task: AiTask, p: AiPayload) {
  return [
    task,
    p.lesson ?? '',
    p.language ?? '',
    hash(p.question ?? ''),
    hash(p.text ?? ''),
    hash(p.sql ?? ''),
    hash(p.schema ?? ''),
    hash(p.error ?? ''),
  ].join('|');
}

function readDisk() {
  if (disk) return disk;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    disk = raw ? (JSON.parse(raw) as Record<string, { t: string; at: number }>) : {};
  } catch {
    disk = {};
  }
  return disk;
}

function persist(key: string, text: string) {
  const store = readDisk();
  const now = Date.now();
  store[key] = { t: text, at: now };
  // Newest first, so a trimmed cache drops the oldest answers, never the one you just read.
  const keep = Object.entries(store)
    .filter(([k, v]) => v.at > now - TTL || k === key)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, MAX_PERSISTED);
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(keep)));
  } catch {
    try {
      localStorage.removeItem(STORE_KEY);
    } catch {}
  }
}

function entry(key: string): Entry {
  let e = mem.get(key);
  if (!e) {
    const saved = readDisk()[key];
    e = saved
      ? { text: saved.t, done: true, failed: saved.t.startsWith('**Error:**'), started: true, subs: new Set() }
      : { text: '', done: false, failed: false, started: false, subs: new Set() };
    mem.set(key, e);
  }
  return e;
}

function notify(e: Entry) {
  e.subs.forEach((f) => f());
}

/** Fire the request once per key. Deliberately not aborted on unmount. */
function start(key: string, task: AiTask, payload: AiPayload) {
  const e = entry(key);
  if (e.started) return;
  e.started = true;
  streamAi(task, payload, (t) => {
    e.text = t;
    notify(e);
  }, undefined, (u) => { e.usage = u; })
    .then((final) => {
      e.text = final;
    })
    .catch((err: unknown) => {
      e.failed = true;
      e.text = `**Error:** ${err instanceof Error ? err.message : 'AI request failed'}`;
    })
    .finally(() => {
      e.done = true;
      notify(e);
      if (!e.failed) persist(key, e.text);
    });
}

function forget(key: string) {
  const store = readDisk();
  delete store[key];
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {}
}

/** Drop cached answers (mem + disk). `key` = one answer, omit = all of them. */
export function clearAiCache(key?: string) {
  if (key) {
    mem.delete(key);
    forget(key);
    return;
  }
  mem.clear();
  disk = {};
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {}
}

/** Ask the same question again. Keeps the Entry object so mounted views keep their subscription. */
function restart(key: string, task: AiTask, payload: AiPayload) {
  const e = entry(key);
  e.text = '';
  e.done = false;
  e.failed = false;
  e.started = false;
  e.usage = undefined;
  notify(e);
  forget(key);
  start(key, task, payload);
}

/** Cached, streamed AI answer. Re-renders as text arrives; survives unmount and reload. */
export function useAiAnswer(task: AiTask, payload: AiPayload) {
  const key = useMemo(() => aiCacheKey(task, payload), [task, payload]);
  const request = useRef({ task, payload });
  request.current = { task, payload };

  const [, bump] = useReducer((n: number) => n + 1, 0);
  const e = entry(key);

  useEffect(() => {
    start(key, request.current.task, request.current.payload);
    const on = () => bump();
    const live = entry(key);
    live.subs.add(on);
    return () => {
      live.subs.delete(on);
    };
  }, [key]);

  const retry = useCallback(() => restart(key, request.current.task, request.current.payload), [key]);

  return { text: e.text, done: e.done, failed: e.failed, usage: e.usage, retry };
}
