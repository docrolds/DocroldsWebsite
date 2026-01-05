import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';

function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { cartItems, setIsCartOpen } = useCart();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Services', path: '/services' },
    { name: 'Beats', path: '/beats' },
    { name: 'Team', path: '/team' },
    { name: 'Contact', path: '/contact' }
  ];

  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      padding: scrolled ? '0.75rem 3rem' : '1.25rem 3rem',
      background: scrolled ? 'rgba(0, 0, 0, 0.98)' : 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(20px)',
      borderBottom: scrolled ? '1px solid rgba(232, 54, 40, 0.15)' : '1px solid transparent',
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }}>
      {/* Logo */}
      <Link to="/">
        <img
          src="/logo.jpg"
          alt="Doc Rolds"
          style={{
            height: '45px',
            width: 'auto',
            objectFit: 'contain',
            borderRadius: '4px'
          }}
        />
      </Link>

      {/* Nav Links */}
      <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
        {navLinks.map(link => (
          <Link
            key={link.name}
            to={link.path}
            style={{
              color: location.pathname === link.path ? '#E83628' : '#ffffff',
              textDecoration: 'none',
              fontSize: '0.85rem',
              fontWeight: '500',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              transition: 'color 0.2s ease'
            }}
            onMouseEnter={e => e.target.style.color = '#E83628'}
            onMouseLeave={e => e.target.style.color = location.pathname === link.path ? '#E83628' : '#ffffff'}
          >
            {link.name}
          </Link>
        ))}
        <Link
          to="/services"
          style={{
            background: '#E83628',
            color: 'white',
            border: 'none',
            padding: '0.6rem 1.5rem',
            borderRadius: '4px',
            fontSize: '0.85rem',
            fontWeight: '600',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            transition: 'all 0.2s ease',
            textDecoration: 'none'
          }}
          onMouseEnter={e => e.target.style.background = '#c42d22'}
          onMouseLeave={e => e.target.style.background = '#E83628'}
        >
          Book Now
        </Link>

        {/* Cart Icon */}
        <button
          className="nav-cart-btn"
          onClick={() => setIsCartOpen(true)}
          aria-label="Open cart"
        >
          <i className="fas fa-shopping-cart"></i>
          {cartItems.length > 0 && (
            <span className="nav-cart-badge">{cartItems.length}</span>
          )}
        </button>

        {/* Admin Login */}
        <a
          href="/login.html"
          style={{
            color: '#888',
            textDecoration: 'none',
            fontSize: '0.8rem',
            fontWeight: '500',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            transition: 'color 0.2s ease',
            marginLeft: '0.5rem'
          }}
          onMouseEnter={e => e.target.style.color = '#E83628'}
          onMouseLeave={e => e.target.style.color = '#888'}
        >
          Login
        </a>
      </div>
    </nav>
  );
}

export default Navigation;
