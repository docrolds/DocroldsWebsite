import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../config.js';
import { useCart } from '../context/CartContext';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { useToast } from '../context/NotificationContext';

function BeatsPage() {
  const [beats, setBeats] = useState([]);
  const [activeGenre, setActiveGenre] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBeatForLicense, setSelectedBeatForLicense] = useState(null);

  const { licenseTiers, addToCart, setIsCartOpen } = useCart();
  const {
    currentBeat,
    isPlaying,
    currentTime,
    duration,
    playBeat,
    setQueue,
    seekTo,
  } = useAudioPlayer();
  const toast = useToast();

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
          // Set the queue for the audio player
          setQueue(data);
        } else {
          setBeats(defaultBeats);
          setQueue(defaultBeats);
        }
      })
      .catch(err => {
        console.error('Failed to fetch beats:', err);
        setBeats(defaultBeats);
        setQueue(defaultBeats);
      });
  }, []);

  // Update queue when beats change
  useEffect(() => {
    if (beats.length > 0) {
      setQueue(beats);
    }
  }, [beats, setQueue]);

  const genres = ['All', ...new Set(beats.map(b => b.genre))];

  const filteredBeats = beats.filter(beat => {
    const matchesGenre = activeGenre === 'All' || beat.genre === activeGenre;
    const matchesSearch = searchQuery === '' ||
      beat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      beat.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesGenre && matchesSearch;
  });

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLicenseClick = (beat) => {
    setSelectedBeatForLicense(beat);
  };

  const handleAddToCart = (license) => {
    if (selectedBeatForLicense) {
      const added = addToCart(selectedBeatForLicense, license);
      if (added) {
        toast.success(
          'Added to Cart',
          `${selectedBeatForLicense.title} - ${license.name}`,
          {
            action: () => setIsCartOpen(true),
            actionLabel: 'View Cart',
          }
        );
      } else {
        toast.warning(
          'Already in Cart',
          `${selectedBeatForLicense.title} with ${license.name} is already in your cart`
        );
      }
      setSelectedBeatForLicense(null);
      setIsCartOpen(true);
    }
  };

  const handlePlayBeat = (beatId) => {
    // Pass the full beats array so queue is set correctly
    playBeat(beatId, beats);
  };

  return (
    <div className="beats-page-v2">
      {/* Hero Section */}
      <section className="beats-hero-v2">
        <div className="beats-hero-bg-v2"></div>
        <div className="beats-hero-content-v2">
          <h1>Beat Store</h1>
          <p>Premium instrumentals for serious artists</p>

          {/* Search Bar */}
          <div className="beats-search-bar">
            <i className="fas fa-search" aria-hidden="true"></i>
            <input
              type="text"
              placeholder="Search beats by title, mood, or style..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search beats"
            />
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <div className="beats-toolbar">
        <div className="beats-genres" role="group" aria-label="Filter beats by genre">
          {genres.map(genre => (
            <button
              key={genre}
              className={`genre-btn ${activeGenre === genre ? 'active' : ''}`}
              onClick={() => setActiveGenre(genre)}
              aria-pressed={activeGenre === genre}
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
        <div className="beats-list-header" role="row" aria-hidden="true">
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
            const progress = isCurrentBeat && duration > 0 ? (currentTime / duration) * 100 : 0;

            return (
              <div key={beat.id} className={`beat-row-wrapper ${isCurrentBeat ? 'active' : ''}`}>
                <div className={`beat-row ${isCurrentBeat ? 'active' : ''}`}>
                  {/* Play Button / Index */}
                  <div className="col-play">
                    <button
                      className="row-play-btn"
                      onClick={() => handlePlayBeat(beat.id)}
                      aria-label={isThisPlaying ? `Pause ${beat.title}` : `Play ${beat.title}`}
                    >
                      {isThisPlaying ? (
                        <i className="fas fa-pause" aria-hidden="true"></i>
                      ) : (
                        <>
                          <span className="row-index">{index + 1}</span>
                          <i className="fas fa-play row-play-icon" aria-hidden="true"></i>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Title & Producer */}
                  <div className="col-title" onClick={() => handlePlayBeat(beat.id)}>
                    <div className="beat-artwork">
                      {beat.coverArt ? (
                        <img
                          src={beat.coverArt.startsWith('http') ? beat.coverArt : `${API_URL.replace('/api', '')}${beat.coverArt}`}
                          alt={beat.title}
                          className="artwork-image"
                        />
                      ) : (
                        <div className="artwork-placeholder" aria-hidden="true">
                          <i className="fas fa-music"></i>
                        </div>
                      )}
                    </div>
                    <div className="beat-info">
                      <span className="beat-title">{beat.title}</span>
                      <span className="beat-producer">Produced by: {beat.producedBy || beat.producer || 'Doc Rolds'}</span>
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
                    <button className="license-btn" onClick={() => handleLicenseClick(beat)} aria-label={`License ${beat.title}`}>
                      <i className="fas fa-shopping-cart" aria-hidden="true"></i>
                      License
                    </button>
                  </div>
                </div>

                {/* Progress Bar - only shows when this beat is current */}
                {isCurrentBeat && (
                  <div className="beat-row-progress-wrapper">
                    <span className="progress-time-current">{formatTime(currentTime)}</span>
                    <div
                      className="beat-row-progress"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const percent = clickX / rect.width;
                        const newTime = percent * (duration || beat.duration || 0);
                        seekTo(newTime);
                      }}
                    >
                      <div
                        className="beat-row-progress-fill"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    <span className="progress-time-duration">{formatTime(duration || beat.duration || 0)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filteredBeats.length === 0 && (
          <div className="no-beats">
            <i className="fas fa-search" aria-hidden="true"></i>
            <p>No beats found matching your criteria</p>
          </div>
        )}
      </div>

      {/* License Selection Modal */}
      {selectedBeatForLicense && (
        <div className="license-modal-overlay" onClick={() => setSelectedBeatForLicense(null)} role="dialog" aria-modal="true" aria-labelledby="license-modal-title">
          <div className="license-modal" onClick={e => e.stopPropagation()}>
            <div className="license-modal-header">
              <h3 id="license-modal-title">
                Select License for <span>"{selectedBeatForLicense.title}"</span>
              </h3>
              <button className="license-modal-close" onClick={() => setSelectedBeatForLicense(null)} aria-label="Close license selection">
                <i className="fas fa-times" aria-hidden="true"></i>
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
                        <i className="fas fa-check" aria-hidden="true"></i>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  {license.price ? (
                    <button
                      className="license-add-btn"
                      onClick={() => handleAddToCart(license)}
                      aria-label={`Add ${license.name} license to cart`}
                    >
                      <i className="fas fa-cart-plus" aria-hidden="true"></i> Add to Cart
                    </button>
                  ) : (
                    <Link
                      to="/contact"
                      className="license-add-btn contact"
                      onClick={() => setSelectedBeatForLicense(null)}
                    >
                      <i className="fas fa-envelope" aria-hidden="true"></i> Contact Us
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
