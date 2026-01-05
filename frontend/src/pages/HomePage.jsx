import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../config.js';
import Sessions from '../components/Sessions';
import Videos from '../components/Videos';
import Instagram from '../components/Instagram';
import Team from '../components/Team';
import Beats from '../components/Beats';
import Discord from '../components/Discord';
import FAQ from '../components/FAQ';

function HomePage() {
  const [heroContent, setHeroContent] = useState({
    title: 'The Journey to Professional Sound Starts with a Dream',
    tagline: 'Dreams Over Careers',
    description: 'Professional recording studio and mixing services for artists who are serious about their craft. Book your session today and bring your music to life.',
    imageUrl: ''
  });

  useEffect(() => {
    fetch(`${API_URL}/content`)
      .then(res => res.json())
      .then(data => {
        if (data?.hero) {
          setHeroContent(data.hero);
        }
      })
      .catch(err => console.error('Failed to fetch hero content:', err));
  }, []);

  return (
    <>
      {/* Hero Section */}
      <section id="home" style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      }}>
        {/* Background Image */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'url("/studio-hero.jpg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center 20%',
          filter: 'brightness(0.55)'
        }} />

        {/* Gradient Overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.5) 100%)'
        }} />

        {/* Content */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            textAlign: 'center',
            maxWidth: '900px',
            margin: '0 auto',
            padding: '0 2rem'
          }}
        >
          {/* Tagline */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            <div style={{
              width: '60px',
              height: '1px',
              background: 'linear-gradient(to right, transparent, #E83628)'
            }} />
            <span style={{
              color: '#ffffff',
              fontSize: 'clamp(1rem, 2vw, 1.25rem)',
              fontWeight: '300',
              letterSpacing: '0.3em',
              textTransform: 'uppercase'
            }}>
              {heroContent.tagline}
            </span>
            <div style={{
              width: '60px',
              height: '1px',
              background: 'linear-gradient(to left, transparent, #E83628)'
            }} />
          </div>

          {/* Title */}
          <h1 style={{
            fontSize: 'clamp(2rem, 4.5vw, 3.5rem)',
            fontWeight: '700',
            lineHeight: '1.2',
            marginBottom: '1.25rem',
            color: '#ffffff'
          }}>
            {heroContent.title.split(' ').map((word, i) => (
              <span
                key={i}
                style={{
                  color: word.toLowerCase() === 'dream' ? '#E83628' : '#ffffff'
                }}
              >
                {word}{' '}
              </span>
            ))}
          </h1>

          {/* Description */}
          <p style={{
            fontSize: '1.05rem',
            lineHeight: '1.7',
            color: 'rgba(255,255,255,0.7)',
            maxWidth: '600px',
            margin: '0 auto 2rem'
          }}>
            {heroContent.description}
          </p>

          {/* Buttons */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '3rem' }}>
            <Link
              to="/services"
              style={{
                background: '#E83628',
                color: 'white',
                border: 'none',
                padding: '1rem 2rem',
                borderRadius: '4px',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
                textDecoration: 'none'
              }}
              onMouseEnter={e => e.target.style.background = '#c42d22'}
              onMouseLeave={e => e.target.style.background = '#E83628'}
            >
              Book a Session
            </Link>

            <a
              href="https://open.spotify.com/playlist/6lQ3qQ34fxkf8roPLdbMYH?si=089e5d2c0b404e58"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: 'transparent',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.3)',
                padding: '1rem 2rem',
                borderRadius: '4px',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
                textDecoration: 'none'
              }}
              onMouseEnter={e => {
                e.target.style.background = 'rgba(255,255,255,0.1)';
                e.target.style.borderColor = 'rgba(255,255,255,0.5)';
              }}
              onMouseLeave={e => {
                e.target.style.background = 'transparent';
                e.target.style.borderColor = 'rgba(255,255,255,0.3)';
              }}
            >
              View My Work
            </a>
          </div>

          {/* Stats */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '3rem',
            paddingTop: '2rem',
            borderTop: '1px solid rgba(255,255,255,0.1)'
          }}>
            {[
              { number: '500+', label: 'Sessions' },
              { number: '50+', label: 'Artists' },
              { number: '10+', label: 'Years' }
            ].map((stat, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: '1.75rem',
                  fontWeight: '700',
                  color: '#ffffff'
                }}>
                  {stat.number}
                </div>
                <div style={{
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '0.8rem',
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* All other sections */}
      <Sessions />
      <Videos />
      <Instagram />
      <Team />
      <Beats />
      <Discord />
      <FAQ />
    </>
  );
}

export default HomePage;
