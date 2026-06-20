import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyCssTheme, defaultTheme, getTheme } from "../theme-kit/theme.js";
import "../theme-kit/theme.css";
import "./styles.css";
import App from "./App";

const storageKey = document.documentElement.dataset.themeStorageKey || "chip-player-theme";
const requestedTheme = new URLSearchParams(window.location.search).get("theme");
const theme = getTheme(requestedTheme || localStorage.getItem(storageKey) || defaultTheme.id);
applyCssTheme(theme);
document.documentElement.dataset.theme = theme.id;
document.documentElement.style.colorScheme = theme.tone;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
