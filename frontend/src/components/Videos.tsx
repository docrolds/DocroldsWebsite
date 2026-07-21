import { useState, useEffect, JSX } from 'react';
import { API_URL } from '../config';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

// ============================================================================
// Facade (click-to-load) player - avoids mounting YouTube's full embed
// (which pulls down its own heavy JS/CSS player chrome) until the visitor
// actually wants to watch, instead of eagerly loading all of them on page
// load. Shows YouTube's static thumbnail + a play button; only swaps in
// the real iframe once clicked.
// ============================================================================

interface VideoFacadeProps {
  id: string;
  start?: number;
  title: string;
}

function VideoFacade({ id, start, title }: VideoFacadeProps): JSX.Element {
  const [loaded, setLoaded] = useState(false);

  if (loaded) {
    return (
      <iframe
        src={`https://www.youtube.com/embed/${id}?autoplay=1${start ? `&start=${start}` : ''}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      ></iframe>
    );
  }

  return (
    <button
      type="button"
      className="video-facade"
      onClick={() => setLoaded(true)}
      style={{ backgroundImage: `url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)` }}
      aria-label={`Play ${title}`}
    >
      <span className="video-facade-play">
        <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
      </span>
    </button>
  );
}

// ============================================================================
// Type Definitions
// ============================================================================

interface VideoItem {
  id: string;
  start?: number;
}

interface VideosContent {
  videoIds: VideoItem[];
}

interface ContentApiResponse {
  videos?: VideosContent;
  [key: string]: unknown;
}

// ============================================================================
// Component
// ============================================================================

function Videos(): JSX.Element {
  const { ref: sectionRef, isVisible: sectionVisible } = useScrollAnimation<HTMLElement>({ threshold: 0.1, rootMargin: '0px' });
  const [videosContent, setVideosContent] = useState<VideosContent>({
    videoIds: [
      { id: 'ot8ujvHU7J4' },
      { id: '_bsS4sXNrsQ' },
      { id: 'BbNIph4Ta5Y', start: 155 },
      { id: 'Jq0eXzAqJkI', start: 1337 }
    ]
  });
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    setIsAdmin(!!token);

    fetch(`${API_URL}/content`)
      .then((res: Response) => {
        if (!res.ok) throw new Error('Failed to load videos');
        return res.json();
      })
      .then((data: ContentApiResponse) => {
        if (data?.videos) {
          setVideosContent(data.videos);
        }
        setLoading(false);
      })
      .catch((err: Error) => {
        console.error('Failed to fetch videos content:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Loading state
  if (loading) {
    return (
      <section id="videos" ref={sectionRef}>
        <h2 className={`section-title animate-on-scroll fade-up ${sectionVisible ? 'visible' : ''}`}>Featured Videos</h2>
        <div className="videos-container">
          {[1, 2, 3, 4].map((i: number) => (
            <div key={i} className="video-card">
              <div className="video-wrapper skeleton" style={{ background: 'var(--muted)', borderRadius: 'var(--radius)' }}></div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Error state (still show default videos)
  if (error) {
    console.warn('Videos: Using default content due to error:', error);
  }

  return (
    <section id="videos" ref={sectionRef} style={{ position: 'relative' }}>
      {isAdmin && (
        <button
          onClick={() => alert('Videos editing coming soon')}
          className="admin-edit-btn"
          aria-label="Edit Videos section"
        >
          <span aria-hidden="true">✏️</span>
        </button>
      )}

      <h2 className={`section-title animate-on-scroll fade-up ${sectionVisible ? 'visible' : ''}`}>Featured Videos</h2>
      <div
        className={`videos-container animate-on-scroll fade-up ${sectionVisible ? 'visible' : ''}`}
      >
        {videosContent.videoIds.map((video: VideoItem, index: number) => (
          <div
            key={video.id}
            className="video-card"
          >
            <div className="video-wrapper">
              <VideoFacade id={video.id} start={video.start} title={`Featured video ${index + 1}`} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default Videos;
