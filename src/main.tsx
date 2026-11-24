import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

// Dev only: exposes window.checkApiHealth() to test the connection to the new backend.
if (import.meta.env.DEV) void import("./lib/api");

// Installable home-screen app (PWA). Skipped inside the Viktor preview iframe.
if ("serviceWorker" in navigator && import.meta.env.PROD && window.self === window.top) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
