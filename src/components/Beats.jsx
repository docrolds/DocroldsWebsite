import { useState, useEffect, useRef } from 'react';

function Beats() {
  const defaultBeats = [
    { title: 'Beat Title 1', genre: 'Hip-Hop', category: 'Hip-Hop', bpm: 92, key: 'C Minor', duration: 165 },
    { title: 'Beat Title 2', genre: 'Trap', category: 'Trap', bpm: 140, key: 'A Minor', duration: 180 },
    { title: 'Beat Title 3', genre: 'R&B', category: 'R&B', bpm: 95, key: 'F Major', duration: 200 },
    { title: 'Beat Title 4', genre: 'Pop', category: 'Pop', bpm: 120, key: 'G Major', duration: 210 }
  ];

  const [beats, setBeats] = useState(defaultBeats);
  const [currentBeatIndex, setCurrentBeatIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const animationIdRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    setIsAdmin(!!token);
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const animateProgress = () => {
    if (!isPlaying) return;
    const beat = beats[currentBeatIndex];
    setCurrentTime(prev => {
      const newTime = Math.min(prev + 0.016, beat.duration);
      if (newTime >= beat.duration) {
        nextBeat();
        return 0;
      }
      return newTime;
    });
    animationIdRef.current = requestAnimationFrame(animateProgress);
  };

  useEffect(() => {
    if (isPlaying) {
      animationIdRef.current = requestAnimationFrame(animateProgress);
    } else if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
    }
    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [isPlaying, currentBeatIndex]);

  const playBeat = (index) => {
    setCurrentBeatIndex(index);
    setIsPlaying(true);
    setCurrentTime(0);
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const nextBeat = () => {
    setCurrentBeatIndex((currentBeatIndex + 1) % beats.length);
    setIsPlaying(true);
    setCurrentTime(0);
  };

  const previousBeat = () => {
    setCurrentBeatIndex((currentBeatIndex - 1 + beats.length) % beats.length);
    setIsPlaying(true);
    setCurrentTime(0);
  };

  const currentBeat = beats[currentBeatIndex];
  const progress = (currentTime / currentBeat.duration) * 100;

  return (
    <section id="beats">
      <h2 className="section-title">Recent Beats</h2>
      <div className="playlist-container">
        <div className="player-controls">
          <button className="player-btn" onClick={previousBeat} title="Previous">⏮</button>
          <button className="player-btn" id="playPauseBtn" onClick={togglePlayPause} title="Play/Pause">
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button className="player-btn" onClick={nextBeat} title="Next">⏭</button>
        </div>

        <div className="now-playing">
          <div className="now-playing-title">Now Playing</div>
          <div className="now-playing-beat">{currentBeat.title}</div>
          <div className="now-playing-genre">{currentBeat.genre}</div>

          <div className="beat-info-grid">
            <div className="beat-info-item">
              <div className="beat-info-label">Category</div>
              <div className="beat-info-value">{currentBeat.category}</div>
            </div>
            <div className="beat-info-item">
              <div className="beat-info-label">BPM</div>
              <div className="beat-info-value">{currentBeat.bpm}</div>
            </div>
            <div className="beat-info-item">
              <div className="beat-info-label">Key</div>
              <div className="beat-info-value">{currentBeat.key}</div>
            </div>
          </div>

          <div className="progress-container">
            <div className="progress-bar-wrapper">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }}></div>
              </div>
              <div className="progress-time">{formatTime(currentBeat.duration)}</div>
            </div>
          </div>
        </div>

        <ul className="playlist">
          {beats.map((beat, index) => (
            <li 
              key={index}
              className={`playlist-item ${index === currentBeatIndex ? 'active' : ''}`}
              onClick={() => playBeat(index)}
              data-index={index}
            >
              <div className="playlist-item-icon">
                {index === currentBeatIndex ? (
                  <span className="playlist-item-active">♫</span>
                ) : (
                  '♪'
                )}
              </div>
              <div className="playlist-item-content">
                <div className={`playlist-item-title ${index === currentBeatIndex ? 'playlist-item-active-title' : ''}`}>
                  {beat.title}
                </div>
                <div className="playlist-item-genre">{beat.genre}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default Beats;
