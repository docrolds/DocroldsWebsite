import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import NotificationBell from './NotificationBell';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { cartItems, setIsCartOpen } = useCart();
  const { customer, isAuthenticated } = useCustomerAuth();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Services', path: '/services' },
    { name: 'Beats', path: '/beats' },
    { name: 'Team', path: '/team' },
    { name: 'Contact', path: '/contact' }
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <>
      <nav className={cn(
        "fixed top-0 left-0 right-0 z-[1000] flex justify-between items-center backdrop-blur-xl transition-all duration-400",
        scrolled
          ? "py-3 px-4 md:px-12 bg-background/98 border-b border-primary/20"
          : "py-5 px-4 md:px-12 bg-background/85 border-b border-transparent"
      )}>
        {/* Logo */}
        <Link to="/">
          <img
            src="/logo.jpg"
            alt="Doc Rolds"
            className="h-[40px] md:h-[45px] w-auto object-contain rounded"
          />
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex gap-8 items-center">
          {navLinks.map(link => (
            <Link
              key={link.name}
              to={link.path}
              className={cn(
                "text-sm font-medium tracking-wide uppercase transition-colors duration-200 no-underline",
                isActive(link.path)
                  ? "text-primary"
                  : "text-foreground/80 hover:text-primary"
              )}
            >
              {link.name}
            </Link>
          ))}

          <Button asChild size="sm" className="uppercase tracking-wide">
            <Link to="/services">Book Now</Link>
          </Button>

          {/* Cart Icon */}
          <button
            className="bg-transparent border-none text-muted-foreground cursor-pointer text-lg relative p-2 transition-colors duration-200 hover:text-primary"
            onClick={() => setIsCartOpen(true)}
            aria-label="Open cart"
          >
            <i className="fas fa-shopping-cart" aria-hidden="true"></i>
            {cartItems.length > 0 && (
              <Badge className="absolute -top-1 -right-1 w-4 h-4 p-0 flex items-center justify-center text-[0.65rem]">
                {cartItems.length}
              </Badge>
            )}
          </button>

          {/* Notification Bell */}
          <NotificationBell />

          {/* Customer Account */}
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className={cn(
                "text-xs font-medium tracking-wide uppercase transition-colors duration-200 no-underline ml-2 flex items-center gap-2",
                isActive('/dashboard')
                  ? "text-primary"
                  : "text-foreground/80 hover:text-primary"
              )}
            >
              {customer?.profilePicture ? (
                <img
                  src={customer.profilePicture}
                  alt=""
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <i className="fas fa-user-circle" aria-hidden="true"></i>
              )}
              <span>{customer?.firstName || 'Account'}</span>
            </Link>
          ) : (
            <Link
              to="/login"
              className="text-muted-foreground text-xs font-medium tracking-wide uppercase transition-colors duration-200 no-underline ml-2 hover:text-primary"
            >
              Sign In
            </Link>
          )}

          {/* Admin Login */}
          <a
            href="/login.html"
            className="text-muted-foreground text-[0.7rem] font-medium tracking-wide uppercase transition-all duration-200 no-underline ml-2 opacity-60 hover:text-primary hover:opacity-100"
            title="Admin Login"
          >
            Admin
          </a>
        </div>

        {/* Mobile Controls */}
        <div className="flex md:hidden items-center gap-3">
          {/* Cart Icon (Mobile) */}
          <button
            className="bg-transparent border-none text-muted-foreground cursor-pointer text-lg relative p-2 transition-colors duration-200 hover:text-primary"
            onClick={() => setIsCartOpen(true)}
            aria-label="Open cart"
          >
            <i className="fas fa-shopping-cart" aria-hidden="true"></i>
            {cartItems.length > 0 && (
              <Badge className="absolute -top-1 -right-1 w-4 h-4 p-0 flex items-center justify-center text-[0.65rem]">
                {cartItems.length}
              </Badge>
            )}
          </button>

          {/* Notification Bell (Mobile) */}
          <NotificationBell />

          {/* Hamburger Button */}
          <button
            className="bg-transparent border-none text-foreground cursor-pointer p-2 transition-colors duration-200 hover:text-primary"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
          >
            <i className={`fas ${mobileMenuOpen ? 'fa-times' : 'fa-bars'} text-xl`} aria-hidden="true"></i>
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <div
        className={cn(
          "fixed inset-0 bg-background/95 backdrop-blur-xl z-[999] md:hidden transition-all duration-300",
          mobileMenuOpen ? "opacity-100 visible" : "opacity-0 invisible"
        )}
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation menu"
      >
        <div className={cn(
          "flex flex-col items-center justify-center h-full gap-6 transition-transform duration-300",
          mobileMenuOpen ? "translate-y-0" : "-translate-y-8"
        )}>
          {navLinks.map((link, index) => (
            <Link
              key={link.name}
              to={link.path}
              className={cn(
                "text-2xl font-semibold tracking-wide uppercase transition-all duration-200 no-underline",
                isActive(link.path)
                  ? "text-primary"
                  : "text-foreground/80 hover:text-primary"
              )}
              style={{ transitionDelay: `${index * 50}ms` }}
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.name}
            </Link>
          ))}

          <div className="h-px w-16 bg-border my-2"></div>

          <Button asChild size="lg" className="uppercase tracking-wide mt-2">
            <Link to="/services" onClick={() => setMobileMenuOpen(false)}>
              Book Now
            </Link>
          </Button>

          <div className="flex items-center gap-6 mt-4">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className={cn(
                  "text-sm font-medium tracking-wide uppercase transition-colors duration-200 no-underline flex items-center gap-2",
                  isActive('/dashboard')
                    ? "text-primary"
                    : "text-foreground/80 hover:text-primary"
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                {customer?.profilePicture ? (
                  <img
                    src={customer.profilePicture}
                    alt=""
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <i className="fas fa-user-circle" aria-hidden="true"></i>
                )}
                <span>{customer?.firstName || 'Account'}</span>
              </Link>
            ) : (
              <Link
                to="/login"
                className="text-muted-foreground text-sm font-medium tracking-wide uppercase transition-colors duration-200 no-underline hover:text-primary"
                onClick={() => setMobileMenuOpen(false)}
              >
                Sign In
              </Link>
            )}

            <a
              href="/login.html"
              className="text-muted-foreground text-xs font-medium tracking-wide uppercase transition-all duration-200 no-underline opacity-60 hover:text-primary hover:opacity-100"
              title="Admin Login"
            >
              Admin
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

export default Navigation;
