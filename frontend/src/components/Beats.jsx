import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../config';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/NotificationContext';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

function Beats() {
  const { ref: sectionRef, isVisible: sectionVisible } = useScrollAnimation({ threshold: 0.1 });
  const [beats, setBeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBeatForLicense, setSelectedBeatForLicense] = useState(null);

  const {
    currentBeat,
    isPlaying,
    currentTime,
    duration,
    playBeat,
    togglePlayPause,
    playNext,
    playPrev,
  } = useAudioPlayer();

  const { licenseTiers, addToCart, setIsCartOpen } = useCart();
  const toast = useToast();

  useEffect(() => {
    fetch(`${API_URL}/beats`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          // Only show first 4 beats on homepage
          setBeats(data.slice(0, 4));
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch beats:', err);
        setLoading(false);
      });
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayBeat = (beatId) => {
    // Set full beats list as queue and play the selected beat
    playBeat(beatId, beats);
  };

  const handleLicenseClick = (e, beat) => {
    e.stopPropagation(); // Prevent triggering play
    setSelectedBeatForLicense(beat);
  };

  const handleAddToCart = (license) => {
    if (selectedBeatForLicense) {
      const added = addToCart(selectedBeatForLicense, license);
      if (added) {
        toast.success('Added to Cart', `${selectedBeatForLicense.title} - ${license.name}`, {
          action: () => setIsCartOpen(true),
          actionLabel: 'View Cart',
        });
      } else {
        toast.warning('Already in Cart', `${selectedBeatForLicense.title} with ${license.name} is already in your cart`);
      }
      setSelectedBeatForLicense(null);
    }
  };

  // Find which beat in our list is currently playing
  const currentBeatInList = beats.find(b => b.id === currentBeat?.id);
  const currentIndex = currentBeatInList ? beats.indexOf(currentBeatInList) : -1;
  const displayBeat = currentBeatInList || beats[0];
  const progress = displayBeat && duration > 0 ? (currentTime / duration) * 100 : 0;

  if (loading) {
    return (
      <section id="beats" ref={sectionRef} className="beats-section">
        <h2 className={`section-title animate-on-scroll fade-up ${sectionVisible ? 'visible' : ''}`}>Recent Beats</h2>
        <div className={`playlist-container animate-on-scroll fade-up ${sectionVisible ? 'visible' : ''}`} style={{ textAlign: 'center', padding: '3rem', transitionDelay: '150ms' }}>
          <div className="skeleton" style={{ height: '200px', borderRadius: 'var(--radius-lg)' }}></div>
        </div>
      </section>
    );
  }

  if (beats.length === 0) {
    return (
      <section id="beats" ref={sectionRef} className="beats-section">
        <h2 className={`section-title animate-on-scroll fade-up ${sectionVisible ? 'visible' : ''}`}>Recent Beats</h2>
        <div className={`playlist-container animate-on-scroll fade-up ${sectionVisible ? 'visible' : ''}`} style={{ textAlign: 'center', padding: '3rem', transitionDelay: '150ms' }}>
          <p style={{ color: 'var(--muted-foreground)' }}>No beats available yet.</p>
          <Link to="/beats" className="view-all-beats-btn" style={{ marginTop: 'var(--space-sm)', display: 'inline-block' }}>
            Visit Beat Store
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section id="beats" ref={sectionRef} className="beats-section">
      <div className={`playlist-container animate-on-scroll fade-up ${sectionVisible ? 'visible' : ''}`} style={{ transitionDelay: '150ms' }}>
        <h2 className="beats-container-title">Recent Beats</h2>

        <div className="now-playing">
          <div className="now-playing-title">Now Playing</div>
          <div className="now-playing-beat">{displayBeat?.title || 'Select a beat'}</div>

          <div className="player-controls" role="group" aria-label="Audio player controls">
            <button
              className="player-btn"
              onClick={playPrev}
              title="Previous"
              aria-label="Previous track"
              disabled={currentIndex <= 0}
            >
              <i className="fas fa-step-backward" aria-hidden="true"></i>
            </button>
            <button
              className="player-btn play-btn-main"
              onClick={() => {
                if (currentBeatInList) {
                  togglePlayPause();
                } else if (beats[0]) {
                  handlePlayBeat(beats[0].id);
                }
              }}
              title={isPlaying && currentBeatInList ? 'Pause' : 'Play'}
              aria-label={isPlaying && currentBeatInList ? 'Pause' : 'Play'}
            >
              <i className={`fas ${isPlaying && currentBeatInList ? 'fa-pause' : 'fa-play'}`} aria-hidden="true"></i>
            </button>
            <button
              className="player-btn"
              onClick={playNext}
              title="Next"
              aria-label="Next track"
              disabled={currentIndex === -1 || currentIndex >= beats.length - 1}
            >
              <i className="fas fa-step-forward" aria-hidden="true"></i>
            </button>
          </div>

          <div className="now-playing-genre">{displayBeat?.genre || ''}</div>

          <div className="beat-info-grid">
            <div className="beat-info-item">
              <div className="beat-info-label">Producer</div>
              <div className="beat-info-value">{displayBeat?.producedBy || displayBeat?.producer || 'Doc Rolds'}</div>
            </div>
            <div className="beat-info-item">
              <div className="beat-info-label">BPM</div>
              <div className="beat-info-value">{displayBeat?.bpm || '-'}</div>
            </div>
            <div className="beat-info-item">
              <div className="beat-info-label">Key</div>
              <div className="beat-info-value">{displayBeat?.key || '-'}</div>
            </div>
          </div>

          {currentBeatInList && (
            <div className="progress-container">
              <div className="progress-bar-wrapper">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <div className="progress-time">
                  {formatTime(currentTime)} / {formatTime(duration || displayBeat?.duration || 0)}
                </div>
              </div>
            </div>
          )}
        </div>

        <ul className="playlist" role="list" aria-label="Beat playlist">
          {beats.map((beat) => {
            const isThisBeatPlaying = currentBeat?.id === beat.id;
            return (
              <li
                key={beat.id}
                className={`playlist-item ${isThisBeatPlaying ? 'active' : ''}`}
                onClick={() => handlePlayBeat(beat.id)}
                role="button"
                tabIndex={0}
                aria-current={isThisBeatPlaying ? 'true' : undefined}
                aria-label={`${beat.title} by ${beat.producedBy || beat.producer || 'Doc Rolds'}, ${beat.genre}, ${beat.bpm || '-'} BPM, $${beat.price || 50}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handlePlayBeat(beat.id);
                  }
                }}
              >
                <div className="playlist-item-icon" aria-hidden="true">
                  {isThisBeatPlaying && isPlaying ? (
                    <span className="playlist-item-active"><i className="fas fa-pause"></i></span>
                  ) : isThisBeatPlaying ? (
                    <span className="playlist-item-active"><i className="fas fa-play"></i></span>
                  ) : (
                    <i className="fas fa-music"></i>
                  )}
                </div>
                <div className="playlist-item-content">
                  <div className={`playlist-item-title ${isThisBeatPlaying ? 'playlist-item-active-title' : ''}`}>
                    {beat.title}
                  </div>
                  <div className="playlist-item-producer">
                    <span className="playlist-item-producer-label">Produced By:</span> {beat.producedBy || beat.producer || 'Doc Rolds'}
                  </div>
                  <div className="playlist-item-meta">
                    <span className="playlist-item-genre">{beat.genre}</span>
                    <span className="playlist-item-separator" aria-hidden="true">•</span>
                    <span className="playlist-item-bpm">{beat.bpm || '-'} BPM</span>
                  </div>
                </div>
                <div className="playlist-item-price">
                  {beat.soldExclusively ? (
                    <span className="sold-badge-small">SOLD</span>
                  ) : (
                    `$${beat.price || 50}`
                  )}
                </div>
                {beat.soldExclusively ? (
                  <span
                    className="playlist-item-license-btn sold"
                    title="This beat has been sold exclusively"
                    aria-label="Sold exclusively"
                  >
                    <i className="fas fa-check-circle" aria-hidden="true"></i>
                  </span>
                ) : (
                  <button
                    className="playlist-item-license-btn"
                    onClick={(e) => handleLicenseClick(e, beat)}
                    title="License this beat"
                    aria-label={`License ${beat.title}`}
                  >
                    <i className="fas fa-shopping-cart" aria-hidden="true"></i>
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link
            to="/beats"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--primary)',
              textDecoration: 'none',
              fontSize: '0.95rem',
              fontWeight: '600',
              padding: '0.75rem 1.5rem',
              border: '1px solid var(--primary)',
              borderRadius: '4px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={e => {
              e.target.style.background = 'var(--primary)';
              e.target.style.color = '#fff';
            }}
            onMouseLeave={e => {
              e.target.style.background = 'transparent';
              e.target.style.color = 'var(--primary)';
            }}
          >
            View All Beats <i className="fas fa-arrow-right"></i>
          </Link>
        </div>
      </div>

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
                  <Link
                    to={`/licenses?type=${license.id}`}
                    className="license-terms-link"
                    onClick={() => setSelectedBeatForLicense(null)}
                  >
                    View Full Terms <i className="fas fa-external-link-alt"></i>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default Beats;
