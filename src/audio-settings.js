export const MAX_VOLUME = .5;
export const DEFAULT_VOLUME_PERCENT = 60;
export const AUDIO_PROFILES = {
  menu: { src: '/assets/stylish-world.mp3', maximum: MAX_VOLUME, defaultPercent: DEFAULT_VOLUME_PERCENT },
  game: { src: '/assets/coconut-mall.mp3', maximum: .7, defaultPercent: 30 },
};
export const clampPercent = value => Math.max(0, Math.min(100, Number(value) || 0));
export const audioVolume = (percent, profile = 'menu') => clampPercent(percent) / 100 * AUDIO_PROFILES[profile].maximum;
// Preserve each track's chosen level, and never unmute just because a screen changed.
export class MusicLevels {
  profile = 'menu';
  muted = false;
  remembered = { menu: DEFAULT_VOLUME_PERCENT, game: 30 };
  get percent() { return this.muted ? 0 : this.remembered[this.profile]; }
  get volume() { return audioVolume(this.percent, this.profile); }
  setPercent(value) {
    const percent = clampPercent(value);
    this.muted = percent === 0;
    if (percent) this.remembered[this.profile] = percent;
  }
  toggleMute() { this.muted = !this.muted; }
  setProfile(profile) { if (AUDIO_PROFILES[profile]) this.profile = profile; }
}
// Range thumbs travel inside the track by half their diameter at either end.
export const trackFill = (percent, width, thumb = 21) => `${thumb / 2 + clampPercent(percent) / 100 * Math.max(0, width - thumb)}px`;
