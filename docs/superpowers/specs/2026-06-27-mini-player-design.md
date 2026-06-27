# Mini Player Design

## Goal

Add a minimal playback mode that can be used directly inside the current app and can later be embedded into other frontend projects with minimal coupling.

## Entry Point

The first version exposes the mini player at `/mini`. The existing full player remains unchanged at `/`.

This makes the feature easy to test, bookmark, deploy, and embed through an iframe later. It also avoids disturbing the current full-screen library and visualization workflow.

## Layout

The mini player uses one compact horizontal bar inspired by the provided reference image:

- Left: previous, play/pause, next.
- Center: seek bar and total duration on the right side only.
- Below the seek bar: small text showing current album and track title.
- Right: compact buttons for volume, theme, album, and playlist.

Each right-side button opens a lightweight floating panel. Panels close when another panel is opened. The first implementation keeps these panels inside the React app rather than creating a separate package.

## Playback Behavior

The mini player reuses the existing audio engine, album library, NSFe metadata parser, theme system, and favorites where useful.

Default behavior:

- Auto-load the first album when `/mini` opens.
- Auto-play remains subject to browser gesture policies; if playback is blocked, the play button starts playback.
- Loop mode defaults to all tracks.
- Previous and next move within the loaded album.
- Playlist panel lists tracks for the selected album.
- Album panel lists available albums and loads the chosen album.

## Visual Scope

The mini player is intentionally not a second full UI. It does not show oscilloscope, channel meters, PWA status, favorites management, or the Todo entry.

It should still inherit the active theme and bundled retro fonts. Theme changes use the same local storage key as the main app.

## Embedding Boundary

Version 1 implements `/mini` as a route-like mode inside the existing Vite app. This is enough for direct use and iframe embedding:

```html
<iframe src="https://example.com/mini" title="8+16 bit mini player"></iframe>
```

A later version can extract the mini player into a standalone component API or Web Component if another frontend project needs deeper integration than iframe embedding.

## Error Handling

If an album cannot be loaded, show a short inline error in the mini bar.

If a track cannot be played, keep the UI interactive and show a short inline error. The app should not crash if metadata is missing.

## Testing

Verify:

- `/` still renders the existing full player.
- `/mini` renders the compact player.
- Album selection loads metadata.
- Playlist click plays the chosen track.
- Seek bar remains draggable/clickable.
- Theme popup changes the same global theme.
- Production PWA build still passes.
