import { applyCssTheme, defaultTheme, getTheme } from "./theme.js";

const THEME_STORAGE_KEY = "tetris-theme";

const requestedTheme = new URLSearchParams(window.location.search).get("theme");
const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
const theme = getTheme(requestedTheme || storedTheme || defaultTheme.id);

applyCssTheme(theme);
document.documentElement.dataset.theme = theme.id;
