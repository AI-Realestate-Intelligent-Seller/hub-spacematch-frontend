import fs from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, type Plugin } from "vite";
import { AGENT_PROFILES } from "./src/lib/agentProfiles.ts";

// "Why SpaceMatch" links (/m/<agent>): text/iMessage previews read static OG tags, so write
// dist/m/<slug>/index.html (the SPA shell with that agent's title + image). Vercel serves
// these files before the SPA rewrite; the app itself is unchanged.
function whyLinkPreviews(): Plugin {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return {
    name: "why-link-previews",
    apply: "build",
    closeBundle() {
      const out = path.resolve(import.meta.dirname, "dist");
      const shell = path.join(out, "index.html");
      if (!fs.existsSync(shell)) return;
      const html = fs.readFileSync(shell, "utf8");
      for (const p of AGENT_PROFILES) {
        const title = esc(`${p.name} · SpaceMatch Inc.`);
        const desc = esc("Most homes get listed. Yours gets launched. See how SpaceMatch sells and buys differently, in 2 minutes.");
        const img = `https://hub.spacematchinc.com/media/og/${p.slug}.jpg`;
        const url = `https://hub.spacematchinc.com/m/${p.slug}`;
        const page = html
          .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
          .replace(/(<meta property="og:title" content=")[^"]*/, `$1${title}`)
          .replace(/(<meta name="twitter:title" content=")[^"]*/, `$1${title}`)
          .replace(/(<meta property="og:description" content=")[^"]*/, `$1${desc}`)
          .replace(/(<meta name="twitter:description" content=")[^"]*/, `$1${desc}`)
          .replace(/(<meta name="description" content=")[^"]*/, `$1${desc}`)
          .replace(/(<meta property="og:url" content=")[^"]*/, `$1${url}`)
          .replace(/(<meta property="og:image" content=")[^"]*/, `$1${img}`)
          .replace(/(<meta name="twitter:image" content=")[^"]*/, `$1${img}`)
          .replace(/(<meta property="og:image:alt" content=")[^"]*/, `$1${title}`);
        fs.mkdirSync(path.join(out, "m", p.slug), { recursive: true });
        fs.writeFileSync(path.join(out, "m", p.slug, "index.html"), page);
      }
    },
  };
}

// New Express backend (backend/). In development, the Vite dev server forwards /api/v1/*
// to it, so the frontend calls same-origin "/api/v1/..." with no CORS setup.
// Override the target with API_PROXY_TARGET=http://host:port npm run dev.
const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? "http://localhost:4000";

export default defineConfig({
  plugins: [react(), tailwindcss(), whyLinkPreviews()],
  resolve: {
    alias: [
      // While pages move to the new backend: "convex/react" → a copy whose useQuery doesn't throw
      // when Convex says "Not authenticated" (see src/lib/convex-compat/react.ts).
      { find: /^convex\/react$/, replacement: path.resolve(import.meta.dirname, "src/lib/convex-compat/react.ts") },
      // The real module, for the compat file itself.
      {
        find: /^convex-react-original$/,
        replacement: path.resolve(import.meta.dirname, "node_modules/convex/dist/esm/react/index.js"),
      },
      { find: "@", replacement: path.resolve(import.meta.dirname, "src") },
    ],
  },
  server: {
    port: 5173,
    proxy: {
      // Only our versioned API prefix; /api/viktor-auth/* (old Viktor sign-in) is untouched.
      "/api/v1": { target: API_PROXY_TARGET, changeOrigin: true },
    },
  },
});
