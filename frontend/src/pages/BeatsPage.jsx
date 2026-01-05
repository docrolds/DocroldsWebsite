import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../config.js';
import { useCart } from '../context/CartContext';

function BeatsPage() {
  const [beats, setBeats] = useState([]);
  const [currentBeatIndex, setCurrentBeatIndex] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeGenre, setActiveGenre] = useState('All');
  const [volume, setVolume] = useState(0.8);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBeatForLicense, setSelectedBeatForLicense] = useState(null);
  const audioRef = useRef(null);

  const { licenseTiers, addToCart, setIsCartOpen } = useCart();

  // Default beats for demo
  const defaultBeats = [
    { id: 1, title: 'Midnight Dreams', producer: 'Doc Rolds', genre: 'Hip-Hop', bpm: 92, key: 'C Minor', duration: 165, price: 50, tags: ['dark', 'melodic', 'trap'], audioFile: null },
    { id: 2, title: 'Summer Vibes', producer: 'Doc Rolds', genre: 'R&B', bpm: 85, key: 'G Major', duration: 180, price: 50, tags: ['smooth', 'chill', 'vibes'], audioFile: null },
    { id: 3, title: 'Trap Soul', producer: 'Doc Rolds', genre: 'Trap', bpm: 140, key: 'A Minor', duration: 195, price: 75, tags: ['hard', 'bass', '808'], audioFile: null },
    { id: 4, title: 'West Coast Flow', producer: 'Doc Rolds', genre: 'West Coast', bpm: 98, key: 'F Minor', duration: 210, price: 50, tags: ['g-funk', 'west', 'bounce'], audioFile: null },
    { id: 5, title: 'Dark Matter', producer: 'Doc Rolds', genre: 'Trap', bpm: 145, key: 'D Minor', duration: 188, price: 100, tags: ['dark', 'aggressive', 'drill'], audioFile: null },
    { id: 6, title: 'Smooth Operator', producer: 'Doc Rolds', genre: 'R&B', bpm: 78, key: 'Bb Major', duration: 205, price: 75, tags: ['smooth', 'jazz', 'soul'], audioFile: null },
    { id: 7, title: 'Night Rider', producer: 'Doc Rolds', genre: 'Hip-Hop', bpm: 88, key: 'E Minor', duration: 192, price: 50, tags: ['night', 'dark', 'ambient'], audioFile: null },
    { id: 8, title: 'Cloud Nine', producer: 'Doc Rolds', genre: 'R&B', bpm: 72, key: 'Ab Major', duration: 178, price: 75, tags: ['dreamy', 'floating', 'soft'], audioFile: null }
  ];

  useEffect(() => {
    fetch(`${API_URL}/beats`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setBeats(data);
        } else {
          setBeats(defaultBeats);
        }
      })
      .catch(err => {
        console.error('Failed to fetch beats:', err);
        setBeats(defaultBeats);
      });
  }, []);

  const genres = ['All', ...new Set(beats.map(b => b.genre))];

  const filteredBeats = beats.filter(beat => {
    const matchesGenre = activeGenre === 'All' || beat.genre === activeGenre;
    const matchesSearch = searchQuery === '' ||
      beat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      beat.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesGenre && matchesSearch;
  });

  const currentBeat = currentBeatIndex !== null ? beats[currentBeatIndex] : null;

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => {
      // Auto-play next
      const currentFilteredIndex = filteredBeats.findIndex(b => b.id === currentBeat?.id);
      if (currentFilteredIndex < filteredBeats.length - 1) {
        const nextBeat = filteredBeats[currentFilteredIndex + 1];
        const nextIndex = beats.findIndex(b => b.id === nextBeat.id);
        setCurrentBeatIndex(nextIndex);
      } else {
        setIsPlaying(false);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [currentBeatIndex, beats.length, filteredBeats, currentBeat]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying && currentBeat?.audioFile) {
      audio.play().catch(console.error);
    } else {
      audio.pause();
    }
  }, [isPlaying, currentBeat]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const togglePlayBeat = (beatId) => {
    const beatIndex = beats.findIndex(b => b.id === beatId);
    const beat = beats[beatIndex];

    if (currentBeatIndex === beatIndex) {
      // Toggle play/pause for current beat
      if (!beat.audioFile) {
        alert('Audio preview coming soon! Contact us to hear the full track.');
        return;
      }
      setIsPlaying(!isPlaying);
    } else {
      // Play new beat
      setCurrentBeatIndex(beatIndex);
      setCurrentTime(0);
      if (beat.audioFile) {
        setIsPlaying(true);
      } else {
        alert('Audio preview coming soon! Contact us to hear the full track.');
      }
    }
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    audio.currentTime = percentage * duration;
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleLicenseClick = (beat) => {
    setSelectedBeatForLicense(beat);
  };

  const handleAddToCart = (license) => {
    if (selectedBeatForLicense) {
      addToCart(selectedBeatForLicense, license);
      setSelectedBeatForLicense(null);
      setIsCartOpen(true);
    }
  };

  return (
    <div className="beats-page-v2">
      {/* Hidden Audio Element */}
      {currentBeat?.audioFile && (
        <audio
          ref={audioRef}
          src={currentBeat.audioFile.startsWith('http') ? currentBeat.audioFile : `${API_URL.replace('/api', '')}/${currentBeat.audioFile}`}
          preload="metadata"
        />
      )}

      {/* Hero Section */}
      <section className="beats-hero-v2">
        <div className="beats-hero-bg-v2"></div>
        <div className="beats-hero-content-v2">
          <h1>Beat Store</h1>
          <p>Premium instrumentals for serious artists</p>

          {/* Search Bar */}
          <div className="beats-search-bar">
            <i className="fas fa-search"></i>
            <input
              type="text"
              placeholder="Search beats by title, mood, or style..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <div className="beats-toolbar">
        <div className="beats-genres">
          {genres.map(genre => (
            <button
              key={genre}
              className={`genre-btn ${activeGenre === genre ? 'active' : ''}`}
              onClick={() => setActiveGenre(genre)}
            >
              {genre}
            </button>
          ))}
        </div>
        <div className="beats-count">
          {filteredBeats.length} beat{filteredBeats.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Beats List */}
      <div className="beats-list-container">
        {/* List Header */}
        <div className="beats-list-header">
          <div className="col-play">#</div>
          <div className="col-title">Title</div>
          <div className="col-time"><i className="far fa-clock"></i></div>
          <div className="col-bpm">BPM</div>
          <div className="col-key">Key</div>
          <div className="col-tags">Tags</div>
          <div className="col-price">Price</div>
          <div className="col-actions"></div>
        </div>

        {/* Beats Rows */}
        <div className="beats-list">
          {filteredBeats.map((beat, index) => {
            const isCurrentBeat = currentBeat?.id === beat.id;
            const isThisPlaying = isCurrentBeat && isPlaying;

            return (
              <div
                key={beat.id}
                className={`beat-row ${isCurrentBeat ? 'active' : ''}`}
              >
                {/* Play Button / Index */}
                <div className="col-play">
                  <button
                    className="row-play-btn"
                    onClick={() => togglePlayBeat(beat.id)}
                  >
                    {isThisPlaying ? (
                      <i className="fas fa-pause"></i>
                    ) : isCurrentBeat ? (
                      <i className="fas fa-play"></i>
                    ) : (
                      <span className="row-index">{index + 1}</span>
                    )}
                  </button>
                  {isThisPlaying && (
                    <div className="playing-bars">
                      <span></span><span></span><span></span>
                    </div>
                  )}
                </div>

                {/* Title & Producer */}
                <div className="col-title" onClick={() => togglePlayBeat(beat.id)}>
                  <div className="beat-artwork">
                    {beat.coverArt ? (
                      <img
                        src={beat.coverArt.startsWith('http') ? beat.coverArt : `${API_URL.replace('/api', '')}${beat.coverArt}`}
                        alt={beat.title}
                        className="artwork-image"
                      />
                    ) : (
                      <div className="artwork-placeholder">
                        <i className="fas fa-music"></i>
                      </div>
                    )}
                  </div>
                  <div className="beat-info">
                    <span className="beat-title">{beat.title}</span>
                    <span className="beat-producer">{beat.producer || 'Doc Rolds'}</span>
                  </div>
                </div>

                {/* Duration */}
                <div className="col-time">
                  {formatTime(beat.duration || 0)}
                </div>

                {/* BPM */}
                <div className="col-bpm">
                  {beat.bpm}
                </div>

                {/* Key */}
                <div className="col-key">
                  {beat.key}
                </div>

                {/* Tags */}
                <div className="col-tags">
                  {beat.tags?.slice(0, 3).map((tag, i) => (
                    <span key={i} className="beat-tag">#{tag}</span>
                  ))}
                </div>

                {/* Price */}
                <div className="col-price">
                  <span className="price-value">${beat.price || 50}</span>
                </div>

                {/* Actions */}
                <div className="col-actions">
                  <button className="license-btn" onClick={() => handleLicenseClick(beat)}>
                    <i className="fas fa-shopping-cart"></i>
                    License
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredBeats.length === 0 && (
          <div className="no-beats">
            <i className="fas fa-search"></i>
            <p>No beats found matching your criteria</p>
          </div>
        )}
      </div>

      {/* Fixed Bottom Player */}
      {currentBeat && (
        <div className="beats-player-bar">
          {/* Progress */}
          <div className="player-progress-bar" onClick={handleSeek}>
            <div className="player-progress-fill" style={{ width: `${progressPercentage}%` }} />
          </div>

          <div className="player-bar-content">
            {/* Track Info */}
            <div className="player-track-info">
              <div className="player-artwork">
                {currentBeat.coverArt ? (
                  <img
                    src={currentBeat.coverArt.startsWith('http') ? currentBeat.coverArt : `${API_URL.replace('/api', '')}${currentBeat.coverArt}`}
                    alt={currentBeat.title}
                    className="player-artwork-img"
                  />
                ) : (
                  <i className="fas fa-music"></i>
                )}
              </div>
              <div className="player-track-text">
                <span className="player-track-title">{currentBeat.title}</span>
                <span className="player-track-artist">{currentBeat.producer || 'Doc Rolds'}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="player-controls">
              <button className="player-btn" onClick={() => {
                const currentFilteredIndex = filteredBeats.findIndex(b => b.id === currentBeat.id);
                if (currentFilteredIndex > 0) {
                  const prevBeat = filteredBeats[currentFilteredIndex - 1];
                  setCurrentBeatIndex(beats.findIndex(b => b.id === prevBeat.id));
                }
              }}>
                <i className="fas fa-step-backward"></i>
              </button>

              <button className="player-btn main" onClick={() => currentBeat.audioFile ? setIsPlaying(!isPlaying) : alert('Audio preview coming soon!')}>
                <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
              </button>

              <button className="player-btn" onClick={() => {
                const currentFilteredIndex = filteredBeats.findIndex(b => b.id === currentBeat.id);
                if (currentFilteredIndex < filteredBeats.length - 1) {
                  const nextBeat = filteredBeats[currentFilteredIndex + 1];
                  setCurrentBeatIndex(beats.findIndex(b => b.id === nextBeat.id));
                }
              }}>
                <i className="fas fa-step-forward"></i>
              </button>

              <span className="player-time">
                {formatTime(currentTime)} / {formatTime(duration || currentBeat.duration || 0)}
              </span>
            </div>

            {/* Volume & License */}
            <div className="player-right">
              <div className="player-volume">
                <i className={`fas ${volume === 0 ? 'fa-volume-mute' : 'fa-volume-up'}`}></i>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                />
              </div>
              <button className="player-license-btn" onClick={() => handleLicenseClick(currentBeat)}>
                <i className="fas fa-shopping-cart"></i>
                <span>License This Beat</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* License Selection Modal */}
      {selectedBeatForLicense && (
        <div className="license-modal-overlay" onClick={() => setSelectedBeatForLicense(null)}>
          <div className="license-modal" onClick={e => e.stopPropagation()}>
            <div className="license-modal-header">
              <h3>
                Select License for <span>"{selectedBeatForLicense.title}"</span>
              </h3>
              <button className="license-modal-close" onClick={() => setSelectedBeatForLicense(null)}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="license-options">
              {licenseTiers.map(license => (
                <div
                  key={license.id}
                  className={`license-option ${license.id === 'unlimited' ? 'popular' : ''}`}
                >
                  <h4>{license.name}</h4>
                  <div className="license-price">
                    {license.price ? `$${license.price}` : 'Contact Us'}
                  </div>
                  <ul className="license-features">
                    {license.features.map((feature, idx) => (
                      <li key={idx}>
                        <i className="fas fa-check"></i>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  {license.price ? (
                    <button
                      className="license-add-btn"
                      onClick={() => handleAddToCart(license)}
                    >
                      <i className="fas fa-cart-plus"></i> Add to Cart
                    </button>
                  ) : (
                    <Link
                      to="/contact"
                      className="license-add-btn contact"
                      onClick={() => setSelectedBeatForLicense(null)}
                    >
                      <i className="fas fa-envelope"></i> Contact Us
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BeatsPage;
