import { useState, useEffect } from 'react';

function Footer() {
  const [footerContent, setFooterContent] = useState({
    description: 'Connect with Doc Rolds on social media',
    subscribeText: 'Get updates on new beats and services.'
  });
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    setIsAdmin(!!token);
    
    fetch('https://doc-rolds-api.onrender.com/api/content')
      .then(res => res.json())
      .then(data => {
        setFooterContent(data.footer);
      })
      .catch(err => console.error('Failed to fetch footer content:', err));
  }, []);

  const handleNewsletterSignup = (event) => {
    event.preventDefault();
    const email = event.target.querySelector('input[type="email"]').value;
    alert(`Thanks for subscribing with ${email}! Check your inbox for exclusive content.`);
    event.target.reset();
  };

  const socialLinks = [
    { icon: 'fab fa-instagram', url: 'https://instagram.com', title: 'Instagram' },
    { icon: 'fab fa-facebook', url: 'https://facebook.com', title: 'Facebook' },
    { icon: 'fab fa-youtube', url: 'https://youtube.com', title: 'YouTube' },
    { icon: 'fab fa-tiktok', url: 'https://tiktok.com', title: 'TikTok' },
    { icon: 'fab fa-x', url: 'https://x.com', title: 'X' },
    { icon: 'fab fa-discord', url: 'https://discord.gg', title: 'Discord' }
  ];

  return (
    <footer style={{ position: 'relative' }}>
      {isAdmin && (
        <button
          onClick={() => alert('Footer editing coming soon')}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: '#E83628',
            color: 'white',
            border: 'none',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: '1.2rem',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ✏️
        </button>
      )}
      
      <div className="footer-content">
        <div className="footer-section">
          <p style={{ lineHeight: '1.6', color: '#aaa', fontSize: '0.95rem' }}>
            {footerContent.description}
          </p>
          <div className="social-links">
            {socialLinks.map((link, index) => (
              <a key={index} href={link.url} target="_blank" rel="noopener noreferrer" title={link.title}>
                <i className={link.icon}></i>
              </a>
            ))}
          </div>

          <div style={{ marginTop: '2.5rem' }}>
            <h3>Subscribe</h3>
            <p style={{ lineHeight: '1.6', color: '#aaa', fontSize: '0.95rem', marginBottom: '1rem' }}>
              Get updates on new beats and services.
            </p>
            <form className="newsletter-form" onSubmit={handleNewsletterSignup}>
              <input type="email" placeholder="your@email.com" required />
              <button type="submit">Subscribe</button>
            </form>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p>&copy; 2025 Doc Rolds. All rights reserved. Dreams Over Careers.</p>
        <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
          Crafted with passion for independent artists
        </p>
      </div>
    </footer>
  );
}

export default Footer;
