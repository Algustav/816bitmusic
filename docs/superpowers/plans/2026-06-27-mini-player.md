# Mini Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/mini` playback mode with a compact embeddable horizontal player.

**Architecture:** Keep the existing full app intact and add a route-like branch in `src/App.tsx` when `window.location.pathname` starts with `/mini`. Extract mini-specific UI into `src/components/MiniPlayer.tsx` and mini-specific styles into `src/styles.css`, while reusing the current engine, album library, metadata, and theme state.

**Tech Stack:** React 19, TypeScript, Vite, existing GME playback engines, existing theme-kit, CSS.

---

## File Structure

- Create `src/components/MiniPlayer.tsx`: presentational mini player plus popup panels.
- Modify `src/App.tsx`: detect `/mini`, share playback/theme state and handlers with mini mode, and keep full mode unchanged.
- Modify `src/styles.css`: add responsive mini player layout and floating panel styles.
- Modify `docs/superpowers/specs/2026-06-27-mini-player-design.md`: keep the approved design available for review.

## Task 1: Add MiniPlayer Component

**Files:**
- Create: `src/components/MiniPlayer.tsx`

- [ ] **Step 1: Create component props**

Define props for album list, selected album, metadata, snapshot, theme list, callbacks, and error strings.

- [ ] **Step 2: Implement the shell**

Create a horizontal bar with previous, play/pause, next, center seek area, total duration, and current album/track caption.

- [ ] **Step 3: Implement popup panels**

Add four popup panels controlled by local state: volume, theme, album, and playlist.

- [ ] **Step 4: Keep controls accessible**

Use button labels, `aria-expanded`, and `aria-label` for icon buttons.

## Task 2: Wire `/mini` in App

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import `MiniPlayer`**

Add the component import.

- [ ] **Step 2: Detect mini mode**

Create `const isMiniMode = window.location.pathname.replace(/\/+$/, "") === "/mini";`.

- [ ] **Step 3: Add auto-load behavior for mini mode**

When mini mode opens with no selected album, load the first album without starting playback.

- [ ] **Step 4: Return MiniPlayer for `/mini`**

Pass existing state and handlers into `MiniPlayer`. Preserve the current full UI return for `/`.

## Task 3: Style Mini Mode

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Add full-page mini background**

Make `/mini` center the player on a calm themed background.

- [ ] **Step 2: Add compact bar layout**

Use grid/flex so the player works from desktop down to phone width.

- [ ] **Step 3: Add floating panels**

Style panels as small elevated cards above or below the relevant icon area.

- [ ] **Step 4: Add responsive fallback**

On narrow screens, allow the bar to wrap while keeping playback controls usable.

## Task 4: Verify

**Files:**
- Test: existing build and tests

- [ ] **Step 1: Run unit tests**

Run: `npm test -- --run`

- [ ] **Step 2: Run production PWA build**

Run: `npm run build:pwa`

- [ ] **Step 3: Smoke test local pages**

Run preview and check `/` and `/mini`.

- [ ] **Step 4: Commit implementation**

Stage only relevant source and docs files, then commit with message `feat: add embeddable mini player mode`.
