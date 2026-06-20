import { applyCssTheme, defaultTheme, getTheme } from "./theme.js";

const DEFAULT_STORAGE_KEY = "theme-kit-theme";

export function resolveTheme(options = {}) {
  const storageKey = options.storageKey || document.documentElement.dataset.themeStorageKey || DEFAULT_STORAGE_KEY;
  const queryKey = options.queryKey || "theme";
  const requestedTheme = new URLSearchParams(window.location.search).get(queryKey);
  const storedTheme = localStorage.getItem(storageKey);
  return getTheme(requestedTheme || storedTheme || defaultTheme.id);
}

export function applyPageTheme(options = {}) {
  const storageKey = options.storageKey || document.documentElement.dataset.themeStorageKey || DEFAULT_STORAGE_KEY;
  const theme = resolveTheme({ ...options, storageKey });
  applyCssTheme(theme);
  document.documentElement.dataset.theme = theme.id;
  document.documentElement.style.colorScheme = theme.tone === "light" ? "light" : "dark";
  if (options.persist !== false) {
    localStorage.setItem(storageKey, theme.id);
  }
  return theme;
}

export const activeTheme = applyPageTheme({ persist: false });
