import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App.js";
import { useSygil } from "./store/sygilStore.js";

// Dev-only: expose the store for manual/automated verification in the browser.
if (import.meta.env.DEV) {
  (window as unknown as { __sygil: typeof useSygil }).__sygil = useSygil;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
