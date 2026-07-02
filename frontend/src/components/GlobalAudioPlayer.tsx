import { useAudioPlayer } from '../context/AudioPlayerContext';
import { API_URL } from '../config';
import { MouseEvent, ChangeEvent, useState } from 'react';
import { Shuffle, Repeat, Repeat1, Volume2, VolumeX, Volume1 } from 'lucide-react';

function GlobalAudioPlayer(): JSX.Element | null {
  const {
    currentBeat,
    isPlaying,
    currentTime,
    duration,
    volume,
    shuffle,
    repeatMode,
    togglePlayPause,
    playNext,
    playPrev,
    seekTo,
    setVolume,
    closePlayer,
    toggleShuffle,
    toggleRepeat,
    queue,
    currentIndex,
  } = useAudioPlayer();

  const [showVolumeSlider, setShowVolumeSlider] = useState<boolean>(false);

  // Don't render if no beat is selected
  if (!currentBeat) return null;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage: number = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSeek = (e: MouseEvent<HTMLDivElement>): void => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    seekTo(newTime);
  };

  const handleVolumeChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setVolume(parseFloat(e.target.value));
  };

  const handleMuteToggle = (): void => {
    setVolume(volume === 0 ? 0.8 : 0);
  };

  const getArtworkUrl = (): string | null => {
    if (!currentBeat.coverArt) return null;
    return currentBeat.coverArt.startsWith('http')
      ? currentBeat.coverArt
      : `${API_URL.replace('/api', '')}${currentBeat.coverArt}`;
  };

  const canPlayPrev: boolean = currentIndex !== null && currentIndex > 0;
  const canPlayNext: boolean = currentIndex !== null && currentIndex < queue.length - 1;
  const artworkUrl = getArtworkUrl();

  // Get repeat icon based on mode
  const getRepeatIcon = () => {
    if (repeatMode === 'one') {
      return <Repeat1 size={18} />;
    }
    return <Repeat size={18} />;
  };

  // Get volume icon based on level
  const getVolumeIcon = () => {
    if (volume === 0) return <VolumeX size={20} />;
    if (volume < 0.5) return <Volume1 size={20} />;
    return <Volume2 size={20} />;
  };

  return (
    <div className="global-audio-player">
      {/* Left: Track Info */}
      <div className="global-player-track">
        <div className="global-player-artwork">
          {artworkUrl ? (
            <img src={artworkUrl} alt={currentBeat.title} />
          ) : (
            <div className="global-player-artwork-placeholder">
              <i className="fas fa-music"></i>
            </div>
          )}
          {/* Equalizer bars when playing */}
          {isPlaying && (
            <div className="artwork-equalizer">
              <div className="equalizer-bar"></div>
              <div className="equalizer-bar"></div>
              <div className="equalizer-bar"></div>
              <div className="equalizer-bar"></div>
            </div>
          )}
        </div>
        <div className="global-player-info">
          <span className="global-player-title">{currentBeat.title}</span>
          <span className="global-player-artist">
            {currentBeat.artist || 'Doc Rolds'}
          </span>
        </div>
      </div>

      {/* Center: Controls + Progress */}
      <div className="global-player-center">
        {/* Time + Progress Bar */}
        <div className="global-player-progress-row">
          <span className="global-player-time-current">{formatTime(currentTime)}</span>
          <div className="global-player-progress" onClick={handleSeek}>
            <div
              className="global-player-progress-fill"
              style={{ width: `${progressPercentage}%` }}
            />
            <div
              className="global-player-progress-handle"
              style={{ left: `${progressPercentage}%` }}
            />
          </div>
          <span className="global-player-time-duration">{formatTime(duration || currentBeat.duration || 0)}</span>
        </div>

        {/* Playback Controls */}
        <div className="global-player-controls">
          <button
            className="global-player-btn"
            onClick={playPrev}
            disabled={!canPlayPrev}
            title="Previous"
          >
            <i className="fas fa-step-backward"></i>
          </button>

          <button
            className="global-player-btn main"
            onClick={togglePlayPause}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
          </button>

          <button
            className="global-player-btn"
            onClick={playNext}
            disabled={!canPlayNext && repeatMode !== 'all'}
            title="Next"
          >
            <i className="fas fa-step-forward"></i>
          </button>
        </div>
      </div>

      {/* Right: Extra Controls */}
      <div className="global-player-right">
        {/* Queue Position Indicator */}
        {queue.length > 1 && (
          <div className="global-player-queue-info">
            <span>{(currentIndex ?? 0) + 1}</span> / {queue.length}
          </div>
        )}

        {/* Shuffle Button */}
        <button
          className={`global-player-extra-btn ${shuffle ? 'active' : ''}`}
          onClick={toggleShuffle}
          title={shuffle ? 'Shuffle On' : 'Shuffle Off'}
        >
          <Shuffle size={18} />
        </button>

        {/* Repeat Button */}
        <button
          className={`global-player-extra-btn ${repeatMode !== 'off' ? 'active' : ''}`}
          onClick={toggleRepeat}
          title={
            repeatMode === 'off' ? 'Repeat Off' :
            repeatMode === 'all' ? 'Repeat All' : 'Repeat One'
          }
        >
          {getRepeatIcon()}
        </button>

        {/* Volume Control */}
        <div
          className="global-player-volume"
          onMouseEnter={() => setShowVolumeSlider(true)}
          onMouseLeave={() => setShowVolumeSlider(false)}
        >
          <button
            className="global-player-extra-btn"
            onClick={handleMuteToggle}
            title={volume === 0 ? 'Unmute' : 'Mute'}
          >
            {getVolumeIcon()}
          </button>
          <div className={`global-player-volume-popup ${showVolumeSlider ? 'visible' : ''}`}>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="global-player-volume-slider"
              style={{
                background: `linear-gradient(to right, var(--primary) ${volume * 100}%, rgba(255,255,255,0.2) ${volume * 100}%)`
              }}
            />
          </div>
        </div>

        {/* Close Button */}
        <button
          className="global-player-close"
          onClick={closePlayer}
          title="Close Player"
        >
          <i className="fas fa-times"></i>
        </button>
      </div>
    </div>
  );
}

export default GlobalAudioPlayer;
