import { useState, useEffect, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../config';
import Sessions from '../components/Sessions';
import Videos from '../components/Videos';
import Instagram from '../components/Instagram';
import Team from '../components/Team';
import Beats from '../components/Beats';
import Discord from '../components/Discord';
import FAQ from '../components/FAQ';
import { useParallaxRef, useScrollAnimation, useCountUp } from '../hooks/useScrollAnimation';

// ============================================
// Type Definitions
// ============================================

interface HeroContent {
  title: string;
  tagline: string;
  description: string;
  imageUrl: string;
}

interface ContentApiResponse {
  hero?: HeroContent;
}

interface WordCyclerProps {
  words?: string[];
  interval?: number;
}

type AnimState = 'visible' | 'exiting' | 'entering';

interface AnimatedStatProps {
  number: string;
  label: string;
  delay?: number;
}

interface Stat {
  number: string;
  label: string;
}

// ============================================
// WordCycler Component
// ============================================

/**
 * Word cycler - top-down slide, "n" fades in with "Idea"
 */
function WordCycler({ words = ['Dream', 'Goal', 'Idea'], interval = 3000 }: WordCyclerProps): ReactNode {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [animState, setAnimState] = useState<AnimState>('visible');

  useEffect(() => {
    const timer = setInterval(() => {
      // Start exit animation (push down)
      setAnimState('exiting');

      // After exit, change word and enter from top
      setTimeout(() => {
        setCurrentIndex((prev: number) => (prev + 1) % words.length);
        setAnimState('entering');

        // Small delay then settle into visible
        setTimeout(() => {
          setAnimState('visible');
        }, 50);
      }, 500);
    }, interval);

    return () => clearInterval(timer);
  }, [words.length, interval]);

  const word = words[currentIndex];
  const needsN = word === 'Idea';

  return (
    <span className="word-cycler-wrapper">
      <span className="word-cycler-article">a</span>
      <span className={`word-cycler-n ${needsN && animState === 'visible' ? 'visible' : ''}`}>n</span>{' '}
      <span className="word-cycler-word-container">
        <span className={`word-cycler-word ${animState === 'visible' ? 'visible' : ''} ${animState === 'exiting' ? 'exiting' : ''}`}>
          {word}
        </span>
      </span>
    </span>
  );
}

// ============================================
// AnimatedStat Component
// ============================================

/**
 * Animated stat component with count-up animation
 */
function AnimatedStat({ number, label, delay = 0 }: AnimatedStatProps): ReactNode {
  const { ref, isVisible } = useScrollAnimation({ threshold: 0.5 });
  const numericValue = parseInt(number.replace(/\D/g, ''), 10);
  const suffix = number.replace(/\d/g, '');
  const count = useCountUp(numericValue, 2000, isVisible);

  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className="hero-stat" style={{ transitionDelay: `${delay}ms` }}>
      <div className="hero-stat-number">
        <span className="counter-animate">{isVisible ? count : 0}</span>{suffix}
      </div>
      <div className="hero-stat-label">{label}</div>
    </div>
  );
}

// ============================================
// HomePage Component
// ============================================

function HomePage(): ReactNode {
  const [heroContent, setHeroContent] = useState<HeroContent>({
    title: 'The Journey to Professional Sound Starts with a Dream',
    tagline: 'Dreams Over Careers',
    description: 'Professional recording studio and mixing services for artists who are serious about their craft. Book your session today and bring your music to life.',
    imageUrl: ''
  });

  // Parallax effect for hero background - writes directly to the DOM via
  // this ref, so scrolling never triggers a React re-render of HomePage
  // (which would otherwise cascade to every section below it, none of
  // which are memoized).
  const parallaxRef = useParallaxRef<HTMLDivElement>(0.4);

  useEffect(() => {
    fetch(`${API_URL}/content`)
      .then((res: Response) => res.json())
      .then((data: ContentApiResponse) => {
        if (data?.hero) {
          setHeroContent(data.hero);
        }
      })
      .catch((err: Error) => console.error('Failed to fetch hero content:', err));
  }, []);

  const stats: Stat[] = [
    { number: '500+', label: 'Sessions' },
    { number: '50+', label: 'Artists' },
    { number: '10+', label: 'Years' }
  ];

  return (
    <>
      {/* Hero Section */}
      <section id="home" className="hero-fullscreen">
        {/* Parallax Background Image */}
        <div
          ref={parallaxRef}
          className="hero-bg-parallax parallax-bg"
          style={{ backgroundImage: 'url("/studio-hero.jpg")' }}
        />

        {/* Gradient Overlay */}
        <div className="hero-gradient-overlay" />

        {/* Content */}
        <div className="hero-content-wrapper">
          {/* Tagline */}
          <div className="hero-tagline-wrapper">
            <div className="hero-tagline-line left" />
            <span className="hero-tagline-text">{heroContent.tagline}</span>
            <div className="hero-tagline-line right" />
          </div>

          {/* Title */}
          <h1 className="hero-title">
            {heroContent.title.replace(/a Dream$/i, '').trim()}{' '}
            <WordCycler words={['Dream', 'Goal', 'Idea']} interval={3000} />
          </h1>

          {/* Description */}
          <p className="hero-description">{heroContent.description}</p>

          {/* Buttons */}
          <div className="hero-buttons">
            <Link to="/services" className="hero-btn hero-btn-primary btn-press">
              Book a Session
            </Link>

            <a
              href="https://open.spotify.com/playlist/6lQ3qQ34fxkf8roPLdbMYH?si=089e5d2c0b404e58"
              target="_blank"
              rel="noopener noreferrer"
              className="hero-btn hero-btn-secondary btn-press"
            >
              View My Work
            </a>
          </div>

          {/* Stats with animated counters */}
          <div className="hero-stats">
            {stats.map((stat: Stat, i: number) => (
              <AnimatedStat
                key={i}
                number={stat.number}
                label={stat.label}
                delay={i * 200}
              />
            ))}
          </div>
        </div>
      </section>

      {/* All sections */}
      <Beats />
      <Sessions />
      <Videos />
      <Instagram />
      <Team />
      <Discord />
      <FAQ />
    </>
  );
}

export default HomePage;
