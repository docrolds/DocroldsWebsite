import { useAudioPlayer } from '../context/AudioPlayerContext';
import { API_URL } from '../config';

function GlobalAudioPlayer() {
  const {
    currentBeat,
    isPlaying,
    currentTime,
    duration,
    volume,
    togglePlayPause,
    playNext,
    playPrev,
    seekTo,
    setVolume,
    closePlayer,
    queue,
    currentIndex,
  } = useAudioPlayer();

  // Don't render if no beat is selected
  if (!currentBeat) return null;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    seekTo(newTime);
  };

  const handleVolumeChange = (e) => {
    setVolume(parseFloat(e.target.value));
  };

  const getArtworkUrl = () => {
    if (!currentBeat.coverArt) return null;
    return currentBeat.coverArt.startsWith('http')
      ? currentBeat.coverArt
      : `${API_URL.replace('/api', '')}${currentBeat.coverArt}`;
  };

  const canPlayPrev = currentIndex !== null && currentIndex > 0;
  const canPlayNext = currentIndex !== null && currentIndex < queue.length - 1;

  return (
    <div className="global-audio-player">
      {/* Progress bar at top of player */}
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

      <div className="global-player-content">
        {/* Left: Track Info */}
        <div className="global-player-track">
          <div className="global-player-artwork">
            {getArtworkUrl() ? (
              <img src={getArtworkUrl()} alt={currentBeat.title} />
            ) : (
              <div className="global-player-artwork-placeholder">
                <i className="fas fa-music"></i>
              </div>
            )}
          </div>
          <div className="global-player-info">
            <span className="global-player-title">{currentBeat.title}</span>
            <span className="global-player-artist">
              {currentBeat.producedBy || currentBeat.producer || 'Doc Rolds'}
            </span>
          </div>
        </div>

        {/* Center: Controls */}
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
            disabled={!canPlayNext}
            title="Next"
          >
            <i className="fas fa-step-forward"></i>
          </button>

          <div className="global-player-time">
            <span>{formatTime(currentTime)}</span>
            <span className="global-player-time-separator">/</span>
            <span>{formatTime(duration || currentBeat.duration || 0)}</span>
          </div>
        </div>

        {/* Right: Volume & Actions */}
        <div className="global-player-right">
          <div className="global-player-volume">
            <button
              className="global-player-volume-btn"
              onClick={() => setVolume(volume === 0 ? 0.8 : 0)}
              title={volume === 0 ? 'Unmute' : 'Mute'}
            >
              <i className={`fas ${volume === 0 ? 'fa-volume-mute' : volume < 0.5 ? 'fa-volume-down' : 'fa-volume-up'}`}></i>
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="global-player-volume-slider"
            />
          </div>

          <button
            className="global-player-close"
            onClick={closePlayer}
            title="Close Player"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      </div>
    </div>
  );
}

export default GlobalAudioPlayer;
