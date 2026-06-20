#include <stddef.h>
#include <stdint.h>
#include <string.h>

#include <emscripten/emscripten.h>
#include <gme.h>

static Music_Emu* player = NULL;
static const char* last_error = NULL;

static int capture_error(gme_err_t error) {
  last_error = error;
  return error ? 0 : 1;
}

EMSCRIPTEN_KEEPALIVE
int chip_load(const void* data, int size, int sample_rate) {
  if (player) {
    gme_delete(player);
    player = NULL;
  }
  last_error = NULL;
  return capture_error(gme_open_data(data, size, &player, sample_rate));
}

EMSCRIPTEN_KEEPALIVE
void chip_destroy(void) {
  if (player) {
    gme_delete(player);
    player = NULL;
  }
  last_error = NULL;
}

EMSCRIPTEN_KEEPALIVE
int chip_start_track(int track) {
  if (!player) return 0;
  return capture_error(gme_start_track(player, track));
}

EMSCRIPTEN_KEEPALIVE
int chip_render(int16_t* output, int sample_count) {
  if (!player || !output || sample_count <= 0) return 0;
  if (!capture_error(gme_play(player, sample_count, output))) return 0;
  return sample_count;
}

EMSCRIPTEN_KEEPALIVE
int chip_seek(int milliseconds) {
  if (!player || milliseconds < 0) return 0;
  return capture_error(gme_seek(player, milliseconds));
}

EMSCRIPTEN_KEEPALIVE
void chip_mute_voice(int voice, int muted) {
  if (player) gme_mute_voice(player, voice, muted);
}

EMSCRIPTEN_KEEPALIVE
void chip_mute_mask(int mask) {
  if (player) gme_mute_voices(player, mask);
}

EMSCRIPTEN_KEEPALIVE
void chip_set_fade(int start_ms, int length_ms) {
  if (player && start_ms >= 0) {
    gme_set_fade_msecs(player, start_ms, length_ms > 0 ? length_ms : 1);
  }
}

EMSCRIPTEN_KEEPALIVE
int chip_voice_count(void) {
  return player ? gme_voice_count(player) : 0;
}

EMSCRIPTEN_KEEPALIVE
const char* chip_voice_name(int voice) {
  return player ? gme_voice_name(player, voice) : "";
}

EMSCRIPTEN_KEEPALIVE
int chip_track_count(void) {
  return player ? gme_track_count(player) : 0;
}

EMSCRIPTEN_KEEPALIVE
int chip_track_ended(void) {
  return player ? gme_track_ended(player) : 1;
}

EMSCRIPTEN_KEEPALIVE
int chip_tell(void) {
  return player ? gme_tell(player) : 0;
}

EMSCRIPTEN_KEEPALIVE
int chip_track_length(int track) {
  gme_info_t* info = NULL;
  int value = -1;
  if (!player || gme_track_info(player, &info, track)) return value;
  value = info->length;
  gme_free_info(info);
  return value;
}

EMSCRIPTEN_KEEPALIVE
int chip_track_fade(int track) {
  gme_info_t* info = NULL;
  int value = -1;
  if (!player || gme_track_info(player, &info, track)) return value;
  value = info->fade_length;
  gme_free_info(info);
  return value;
}

EMSCRIPTEN_KEEPALIVE
const char* chip_last_error(void) {
  return last_error ? last_error : "";
}
