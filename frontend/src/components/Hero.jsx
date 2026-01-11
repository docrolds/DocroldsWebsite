import { useState, useEffect } from 'react';
import { API_URL } from '../config.js';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

function Hero() {
  const [heroContent, setHeroContent] = useState({
    title: 'The Journey to Professional Sound Starts with a Dream',
    tagline: 'Dreams Over Careers',
    description: 'Professional recording studio and mixing services for artists who are serious about their craft. Book your session today and bring your music to life.',
    imageUrl: ''
  });
  const [_isAdmin, setIsAdmin] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    setIsAdmin(!!token);

    fetch(`${API_URL}/content`)
      .then(res => res.json())
      .then(data => {
        if (data?.hero) {
          setHeroContent(data.hero);
        }
      })
      .catch(err => console.error('Failed to fetch hero content:', err));

    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleBookNow = () => {
    alert('Booking functionality to be implemented');
  };

  const navLinks = [
    { name: 'Home', href: '#home' },
    { name: 'Services', href: '#services' },
    { name: 'Beats', href: '#beats' },
    { name: 'Team', href: '#team' },
    { name: 'Contact', href: '#contact' }
  ];

  return (
    <>
      {/* Navigation */}
      <nav className={cn(
        "fixed top-0 left-0 right-0 z-[1000] flex justify-between items-center transition-all duration-400",
        scrolled
          ? "py-3 px-12 bg-background/98 backdrop-blur-xl border-b border-primary/15"
          : "py-5 px-12 bg-transparent border-b border-transparent"
      )}>
        {/* Logo */}
        <a href="#home">
          <img
            src="/logo.jpg"
            alt="Doc Rolds"
            className="h-[45px] w-auto object-contain rounded"
          />
        </a>

        {/* Nav Links */}
        <div className="flex gap-8 items-center">
          {navLinks.map(link => (
            <a
              key={link.name}
              href={link.href}
              className="text-white text-sm font-medium tracking-wide uppercase transition-colors duration-200 no-underline hover:text-primary"
            >
              {link.name}
            </a>
          ))}
          <Button onClick={handleBookNow} size="sm" className="uppercase tracking-wide">
            Book Now
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center brightness-[0.55]"
          style={{ backgroundImage: 'url("/studio-hero.jpg")' }}
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/50" />

        {/* Content */}
        <div className="relative z-[2] text-center max-w-[900px] mx-auto px-8">
          {/* Tagline */}
          <div className="flex items-center justify-center gap-6 mb-8">
            <div className="w-[60px] h-px bg-gradient-to-r from-transparent to-primary" />
            <span className="text-white text-[clamp(1rem,2vw,1.25rem)] font-light tracking-[0.3em] uppercase">
              {heroContent.tagline}
            </span>
            <div className="w-[60px] h-px bg-gradient-to-l from-transparent to-primary" />
          </div>

          {/* Title */}
          <h1 className="text-[clamp(2rem,4.5vw,3.5rem)] font-bold leading-tight mb-5 text-white">
            {heroContent.title.split(' ').map((word, i) => (
              <span
                key={i}
                className={word.toLowerCase() === 'dream' ? 'text-primary' : 'text-white'}
              >
                {word}{' '}
              </span>
            ))}
          </h1>

          {/* Description */}
          <p className="text-lg leading-relaxed text-white/70 max-w-[600px] mx-auto mb-8">
            {heroContent.description}
          </p>

          {/* Buttons */}
          <div className="flex justify-center gap-4 flex-wrap mb-12">
            <Button onClick={handleBookNow} size="lg">
              Book a Session →
            </Button>

            <Button
              variant="outline"
              size="lg"
              asChild
              className="border-white/30 text-white hover:bg-white/10 hover:border-white/50 hover:text-white"
            >
              <a
                href="https://open.spotify.com/playlist/6lQ3qQ34fxkf8roPLdbMYH?si=089e5d2c0b404e58"
                target="_blank"
                rel="noopener noreferrer"
              >
                ▶ View My Work
              </a>
            </Button>
          </div>

          {/* Stats */}
          <div className="flex justify-center gap-12 pt-8 border-t border-white/10">
            {[
              { number: '500+', label: 'Sessions' },
              { number: '50+', label: 'Artists' },
              { number: '10+', label: 'Years' }
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl font-bold text-white">
                  {stat.number}
                </div>
                <div className="text-white/50 text-xs uppercase tracking-wider">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export default Hero;
