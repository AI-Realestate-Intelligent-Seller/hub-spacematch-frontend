// Announcements on the new backend (backend/src/modules/announcements).
import { apiGet, apiSend } from "./apiData";

export interface Announcement {
  _id: string;
  title?: string;
  body: string;
  link?: string;
  pinned: boolean;
  authorEmail: string;
  authorName: string;
  createdAt: number;
}

const enc = encodeURIComponent;

export const announcementsApi = {
  list: () => apiGet<{ canPost: boolean; vapidKey?: string; rows: Announcement[] }>("/announcements"),
  post: (input: { title: string | null; body: string; link: string | null; pinned: boolean; notify: boolean }) => apiSend<Announcement>("POST", "/announcements", input),
  setPinned: (id: string, pinned: boolean) => apiSend<Announcement>("PATCH", `/announcements/${enc(id)}/pin`, { pinned }),
  remove: (id: string) => apiSend<{ ok: true }>("DELETE", `/announcements/${enc(id)}`),
  subscribe: (s: { endpoint: string; p256dh: string; auth: string }) => apiSend<{ ok: true }>("POST", "/announcements/push-subscriptions", s, false),
  unsubscribe: (endpoint: string) => apiSend<{ ok: true }>("DELETE", "/announcements/push-subscriptions", { endpoint }, false),
};
