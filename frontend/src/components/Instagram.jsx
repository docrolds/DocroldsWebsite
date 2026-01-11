import { useEffect, useRef } from 'react';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

function Instagram() {
  const { ref: sectionRef, isVisible: sectionVisible } = useScrollAnimation({ threshold: 0.1 });
  const heartsContainerRef = useRef(null);
  const profileLinkRef = useRef(null);
  const heartIntervalRef = useRef(null);

  useEffect(() => {
    const createHeart = () => {
      const heartsContainer = heartsContainerRef.current;
      if (!heartsContainer) return;

      const heart = document.createElement('div');
      heart.className = 'heart';

      const drift = (Math.random() - 0.5) * 120;
      heart.style.setProperty('--drift', `${drift}px`);
      heart.style.left = `${20 + (Math.random() * 60)}%`;
      heart.style.animationDelay = `${Math.random() * 0.5}s`;

      heartsContainer.appendChild(heart);

      setTimeout(() => {
        heart.remove();
      }, 3500);
    };

    const observerOptions = {
      threshold: 0.3,
      rootMargin: '0px'
    };

    const instagramObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const button = profileLinkRef.current;
          if (button && !button.classList.contains('splash-in')) {
            button.classList.add('splash-in');
          }

          // Create initial burst of hearts
          for (let i = 0; i < 5; i++) {
            setTimeout(() => createHeart(), i * 300);
          }

          // Start continuous heart creation (only if not already running)
          if (!heartIntervalRef.current) {
            heartIntervalRef.current = setInterval(() => {
              if (Math.random() > 0.7) {
                createHeart();
              }
            }, 800);
          }
        } else {
          // Clear interval when section leaves viewport
          if (heartIntervalRef.current) {
            clearInterval(heartIntervalRef.current);
            heartIntervalRef.current = null;
          }
        }
      });
    }, observerOptions);

    const section = document.querySelector('#instagram');
    if (section) {
      instagramObserver.observe(section);
    }

    // Cleanup on unmount
    return () => {
      if (section) {
        instagramObserver.unobserve(section);
      }
      if (heartIntervalRef.current) {
        clearInterval(heartIntervalRef.current);
        heartIntervalRef.current = null;
      }
    };
  }, []);

  const posts = [
    'DNYNxdBRCfT',
    'CJjYI9VBYji',
    'DNOcw3uRDbY'
  ];

  return (
    <section id="instagram" ref={sectionRef}>
      <h2 className={`section-title animate-on-scroll fade-up ${sectionVisible ? 'visible' : ''}`}>Follow on Instagram</h2>
      <div className={`instagram-header animate-on-scroll fade-up ${sectionVisible ? 'visible' : ''}`} style={{ transitionDelay: '0.1s' }}>
        <div className="hearts-container" ref={heartsContainerRef}></div>
        <a
          href="https://www.instagram.com/docrolds/"
          target="_blank"
          rel="noopener noreferrer"
          className="instagram-profile-link"
          ref={profileLinkRef}
          aria-label="Follow @docrolds on Instagram (opens in new tab)"
        >
          <i className="fab fa-instagram" aria-hidden="true"></i>
          <span>@docrolds</span>
        </a>
      </div>
      <div className={`instagram-posts-grid animate-on-scroll fade-up ${sectionVisible ? 'visible' : ''}`} style={{ transitionDelay: '0.2s' }}>
        {posts.map((postId, index) => (
          <div key={postId} className="instagram-post-wrapper" style={{ transitionDelay: `${0.25 + index * 0.1}s` }}>
            <iframe
              src={`https://www.instagram.com/p/${postId}/embed`}
              title={`Instagram post ${postId}`}
              loading="lazy"
              style={{ border: 'none' }}
            ></iframe>
          </div>
        ))}
      </div>
    </section>
  );
}

export default Instagram;
