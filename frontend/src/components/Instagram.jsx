import { useEffect, useRef, useState } from 'react';

function Instagram() {
  const heartsContainerRef = useRef(null);
  const profileLinkRef = useRef(null);
  const [instagramContent, setInstagramContent] = useState({
    username: '@docrolds',
    instagramUrl: 'https://www.instagram.com/docrolds/',
    postIds: ['DNYNxdBRCfT', 'CJjYI9VBYji', 'DNOcw3uRDbY']
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ ...instagramContent });

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

          for (let i = 0; i < 5; i++) {
            setTimeout(() => createHeart(), i * 300);
          }
          
          const heartInterval = setInterval(() => {
            if (Math.random() > 0.7) {
              createHeart();
            }
          }, 800);

          return () => clearInterval(heartInterval);
        }
      });
    }, observerOptions);

    const section = document.querySelector('#instagram');
    if (section) {
      instagramObserver.observe(section);
    }

    return () => {
      if (section) {
        instagramObserver.unobserve(section);
      }
    };
  }, []);

  const posts = [
    'DNYNxdBRCfT',
    'CJjYI9VBYji',
    'DNOcw3uRDbY'
  ];

  return (
    <section id="instagram">
      <h2 className="section-title">Follow on Instagram</h2>
      <div className="instagram-header">
        <div className="hearts-container" ref={heartsContainerRef}></div>
        <a 
          href="https://www.instagram.com/docrolds/" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="instagram-profile-link"
          ref={profileLinkRef}
        >
          <i className="fab fa-instagram"></i>
          <span>@docrolds</span>
        </a>
      </div>
      <div className="instagram-posts-grid">
        {posts.map((postId, index) => (
          <div key={index} className="instagram-post-wrapper">
            <iframe 
              src={`https://www.instagram.com/p/${postId}/embed`}
              frameBorder="0" 
              scrolling="no" 
              allowTransparency="true"
            ></iframe>
          </div>
        ))}
      </div>
    </section>
  );
}

export default Instagram;
