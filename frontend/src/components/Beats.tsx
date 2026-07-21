import { useState, useEffect, JSX, MouseEvent, KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../config';
import { useAudioPlayer, Beat as AudioBeat } from '../context/AudioPlayerContext';
import { useCart, LicenseTier, LicensePricing, getLicenseTiersForBeat } from '../context/CartContext';
import { useToast } from '../context/NotificationContext';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import { getGradientClass } from '../utils/beatDisplay';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Extended Beat interface for the Beats component
 * Includes additional properties used in the beats listing
 */
interface Beat extends AudioBeat {
  producedBy?: string;
  displayProducer?: string;
  producer?: string;
  soldExclusively?: boolean;
  audioFile: string | null;
  coverArtThumb?: string | null;
  licensePricing?: LicensePricing;
  [key: string]: unknown; // Index signature for cart compatibility
}

// ============================================================================
// Component
// ============================================================================

function Beats(): JSX.Element {
  const { ref: sectionRef, isVisible: sectionVisible } = useScrollAnimation<HTMLElement>({ threshold: 0.1 });
  const [beats, setBeats] = useState<Beat[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedBeatForLicense, setSelectedBeatForLicense] = useState<Beat | null>(null);

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
    // Only ever shows 4 beats and doesn't render like/comment counts, so
    // ask the API for exactly that instead of downloading the full catalog
    // (with per-beat count aggregation) and slicing client-side.
    fetch(`${API_URL}/beats?limit=4&minimal=true`)
      .then((res: Response) => res.json())
      .then((data: Beat[]) => {
        if (data && data.length > 0) {
          setBeats(data);
        }
        setLoading(false);
      })
      .catch((err: Error) => {
        console.error('Failed to fetch beats:', err);
        setLoading(false);
      });
  }, []);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayBeat = (beatId: string | number): void => {
    // Set full beats list as queue and play the selected beat
    playBeat(beatId, beats as AudioBeat[]);
  };

  const handleLicenseClick = (e: MouseEvent<HTMLButtonElement>, beat: Beat): void => {
    e.stopPropagation(); // Prevent triggering play
    setSelectedBeatForLicense(beat);
  };

  const handleAddToCart = (license: LicenseTier): void => {
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
  const currentBeatInList = beats.find((b: Beat) => b.id === currentBeat?.id);
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

          <div className="home-player-controls" role="group" aria-label="Audio player controls">
            <button
              className="home-player-btn"
              onClick={playPrev}
              title="Previous"
              aria-label="Previous track"
              disabled={currentIndex <= 0}
            >
              <i className="fas fa-step-backward" aria-hidden="true"></i>
            </button>
            <button
              className="home-player-btn home-play-btn-main"
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
              className="home-player-btn"
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
              <div className="beat-info-value">{displayBeat?.displayProducer || displayBeat?.producedBy || displayBeat?.producer || 'Doc Rolds'}</div>
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

        <div className="home-beats-list" role="list" aria-label="Beat playlist">
          {beats.map((beat: Beat, index: number) => {
            const isThisBeatPlaying = currentBeat?.id === beat.id;
            const isThisPlaying = isThisBeatPlaying && isPlaying;
            return (
              <div
                key={beat.id}
                className={`home-beat-row ${isThisBeatPlaying ? 'active' : ''}`}
                onClick={() => handlePlayBeat(beat.id)}
                role="button"
                tabIndex={0}
                aria-current={isThisBeatPlaying ? 'true' : undefined}
                aria-label={`${beat.title} by ${beat.displayProducer || beat.producedBy || beat.producer || 'Doc Rolds'}, ${beat.genre}, ${beat.bpm || '-'} BPM, $${beat.price || 50}`}
                onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handlePlayBeat(beat.id);
                  }
                }}
              >
                <div className="col-play">
                  <button
                    className="row-play-btn"
                    onClick={(e: MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); handlePlayBeat(beat.id); }}
                    aria-label={isThisPlaying ? `Pause ${beat.title}` : `Play ${beat.title}`}
                    tabIndex={-1}
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

                <div className="col-title">
                  <div className="beat-artwork">
                    {beat.coverArt ? (
                      <img
                        src={(() => {
                          const src = beat.coverArtThumb || beat.coverArt || '';
                          return src.startsWith('http') ? src : `${API_URL.replace('/api', '')}${src}`;
                        })()}
                        alt={beat.title}
                        className="artwork-image"
                        width={40}
                        height={40}
                      />
                    ) : (
                      <div className={`artwork-placeholder ${getGradientClass(beat.id)}`} aria-hidden="true">
                        <i className="fas fa-music"></i>
                      </div>
                    )}
                    {isThisPlaying && (
                      <div className="artwork-play-overlay visible">
                        <i className="fas fa-pause"></i>
                      </div>
                    )}
                    {beat.soldExclusively && (
                      <div className="sold-badge-overlay" aria-label="This beat has been sold exclusively">
                        SOLD
                      </div>
                    )}
                  </div>
                  <div className="beat-info">
                    <span className="beat-title">
                      {beat.title}
                      {beat.soldExclusively && <span className="sold-inline-badge">SOLD</span>}
                    </span>
                    <span className="beat-producer">{beat.displayProducer || beat.producedBy || beat.producer || 'Doc Rolds'} · {beat.genre} · {beat.bpm || '-'} BPM</span>
                  </div>
                </div>

                <div className="home-beat-price">
                  {!beat.soldExclusively && `$${beat.price || 50}`}
                </div>

                {beat.soldExclusively ? (
                  <span className="license-btn sold" title="This beat has been sold exclusively" aria-label="Sold exclusively">
                    <i className="fas fa-check-circle" aria-hidden="true"></i>
                  </span>
                ) : (
                  <button
                    className="license-btn"
                    onClick={(e: MouseEvent<HTMLButtonElement>) => handleLicenseClick(e, beat)}
                    title="License this beat"
                    aria-label={`License ${beat.title}`}
                  >
                    <i className="fas fa-shopping-cart" aria-hidden="true"></i>
                  </button>
                )}
              </div>
            );
          })}
        </div>

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
            onMouseEnter={(e: MouseEvent<HTMLAnchorElement>) => {
              const target = e.target as HTMLAnchorElement;
              target.style.background = 'var(--primary)';
              target.style.color = '#fff';
            }}
            onMouseLeave={(e: MouseEvent<HTMLAnchorElement>) => {
              const target = e.target as HTMLAnchorElement;
              target.style.background = 'transparent';
              target.style.color = 'var(--primary)';
            }}
          >
            View All Beats <i className="fas fa-arrow-right"></i>
          </Link>
        </div>
      </div>

      {/* License Selection Modal */}
      {selectedBeatForLicense && (
        <div className="license-modal-overlay" onClick={() => setSelectedBeatForLicense(null)}>
          <div className="license-modal" onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}>
            <div className="license-modal-header">
              <h3>
                Select License for <span>"{selectedBeatForLicense.title}"</span>
              </h3>
              <button className="license-modal-close" onClick={() => setSelectedBeatForLicense(null)}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="license-options">
              {getLicenseTiersForBeat(selectedBeatForLicense, licenseTiers).map((license: LicenseTier) => (
                <div
                  key={license.id}
                  className={`license-option ${license.id === 'unlimited' ? 'popular' : ''}`}
                >
                  <h4>{license.name}</h4>
                  <div className="license-price">
                    {license.price ? `$${license.price}` : 'Contact Us'}
                  </div>
                  <ul className="license-features">
                    {license.features.map((feature: string, idx: number) => (
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
                      to={`/contact?message=${encodeURIComponent(
                        `Hi, I'm interested in Exclusive Rights licensing for "${selectedBeatForLicense?.title}". Please reach out with pricing and details.`
                      )}`}
                      className="license-add-btn contact"
                      onClick={() => setSelectedBeatForLicense(null)}
                    >
                      <i className="fas fa-envelope"></i> Contact Us
                    </Link>
                  )}
                  <Link
                    to={`/licenses?type=${license.id}&beatId=${selectedBeatForLicense.id}`}
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
