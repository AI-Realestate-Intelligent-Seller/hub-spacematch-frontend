// Loading data from the new Express backend in pages: conversion, refresh-after-change, errors.
//
// The API sends `id` and ISO dates; the pages were written against Convex (`_id`, millisecond
// timestamps, missing = undefined). fromApi() converts responses to that shape.
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "./api";

// ---------- Response conversion ----------

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** id → _id, ISO "…At" timestamps → milliseconds, null → undefined (left out). */
export function fromApi<T>(value: unknown): T {
  if (Array.isArray(value)) return value.map(v => fromApi(v)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === null) continue;
      const key = k === "id" ? "_id" : k;
      if ((k.endsWith("At") || k === "at") && typeof v === "string" && ISO.test(v)) out[key] = Date.parse(v);
      else out[key] = fromApi(v);
    }
    return out as T;
  }
  return value as T;
}

// ---------- Change notifications (Convex re-rendered on every change; this does the same) ----------

const listeners = new Set<() => void>();

/** Tells every mounted view using useApiData to reload. Called after each successful change. */
export function notifyDataChanged() {
  for (const l of listeners) l();
}

/** GET a path and convert the response. */
export const apiGet = async <T>(path: string) => fromApi<T>(await api<unknown>(path));

/** POST/PUT/PATCH/DELETE, convert the response, then tell every view to reload. */
export async function apiSend<T>(method: "POST" | "PATCH" | "PUT" | "DELETE", path: string, body?: unknown, notify = true): Promise<T> {
  const r = fromApi<T>(await api<unknown>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }));
  if (notify) notifyDataChanged();
  return r;
}

// ---------- Data hook ----------

/**
 * Loads data and keeps it fresh: reloads after any listings change made in this tab, when the
 * tab regains focus, and every `pollMs` (changes made by other people or background jobs).
 * `data` is undefined while loading (like Convex's useQuery); `notFound` is set on a 404.
 * Pass key = null to skip.
 */
export function useApiData<T>(key: string | null, fetcher: () => Promise<T>, opts: { pollMs?: number; pollWhen?: (data: T | undefined) => boolean } = {}) {
  const [state, setState] = useState<{ key: string | null; data?: T; error?: ApiError | Error }>({ key: null });
  const fetchRef = useRef(fetcher);
  const requestRef = useRef(0);
  // Requests still waiting for an answer. Timed polls skip while one is out: when the server answers slower
  // than `pollMs`, each poll used to supersede the previous one, so no answer was ever shown (a CMA stuck
  // on "Identifying parcel" while requests piled up).
  const inFlightRef = useRef(0);
  fetchRef.current = fetcher;

  const load = useCallback(async () => {
    if (key === null) return;
    const request = ++requestRef.current;
    inFlightRef.current++;
    try {
      const data = await fetchRef.current();
      if (request === requestRef.current) setState({ key, data });
    } catch (e) {
      if (request === requestRef.current) {
        setState(s => ({ key, data: s.key === key ? s.data : undefined, error: e as Error }));
      }
    } finally {
      inFlightRef.current--;
    }
  }, [key]);

  const reload = useCallback(() => {
    setState(s => s.key === key && s.data === undefined && s.error ? { key } : s);
    return load();
  }, [key, load]);

  const current = state.key === key;
  const data = current ? state.data : undefined;
  const pollMs = !opts.pollWhen || opts.pollWhen(data) ? opts.pollMs : undefined;

  useEffect(() => {
    if (key === null) return;
    void load();
    listeners.add(load);
    const idle = () => document.visibilityState === "visible" && inFlightRef.current === 0;
    const onFocus = () => idle() && void load();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      requestRef.current++;
      listeners.delete(load);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [key, load]);

  useEffect(() => {
    if (key === null || !pollMs) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && inFlightRef.current === 0) void load();
    }, pollMs);
    return () => window.clearInterval(timer);
  }, [key, load, pollMs]);
  return {
    data,
    error: current ? state.error : undefined,
    notFound: current && state.error instanceof ApiError && state.error.status === 404,
    reload,
  };
}

// ---------- Errors ----------

/** Field → message from a validation error (keys like "sellerEmail" or "links.zillow"). */
export function fieldErrors(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError) || e.code !== "validation_failed" || !Array.isArray(e.details)) return {};
  const out: Record<string, string> = {};
  for (const d of e.details as { path?: string; message?: string }[]) if (d.path && d.message && !out[d.path]) out[d.path] = d.message;
  return out;
}

/** One readable line for a toast. */
export function apiErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const first = Object.values(fieldErrors(e))[0];
    return first ?? e.message;
  }
  if (e instanceof TypeError) return "Can't reach the server. Check your connection and try again.";
  return String((e as Error)?.message ?? e).match(/Uncaught Error: ([^\n]+)/)?.[1] ?? "Something went wrong";
}
