import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import './App.css';
import { CartProvider } from './context/CartContext';
import { CustomerAuthProvider } from './context/CustomerAuthContext';
import { AudioPlayerProvider } from './context/AudioPlayerContext';
import { NotificationProvider } from './context/NotificationContext';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import CartDrawer from './components/CartDrawer';
import ImpersonationBanner from './components/ImpersonationBanner';
import GlobalAudioPlayer from './components/GlobalAudioPlayer';
import ErrorBoundary from './components/ErrorBoundary';
import { Toaster } from './components/ui/toaster';
import HomePage from './pages/HomePage';
import ServicesPage from './pages/ServicesPage';
import BeatsPage from './pages/BeatsPage';
import TeamPage from './pages/TeamPage';
import ContactPage from './pages/ContactPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderConfirmationPage from './pages/OrderConfirmationPage';
import DownloadPage from './pages/DownloadPage';
import CustomerLoginPage from './pages/CustomerLoginPage';
import CustomerRegisterPage from './pages/CustomerRegisterPage';
import CustomerDashboard from './pages/CustomerDashboard';

function App() {
  const location = useLocation();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Section title animation observer
  useEffect(() => {
    const sectionTitleObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !entry.target.classList.contains('animate-sweep')) {
          entry.target.classList.add('animate-sweep');
        }
      });
    }, { threshold: 0.3, rootMargin: '0px 0px -100px 0px' });

    document.querySelectorAll('.section-title').forEach(title => {
      sectionTitleObserver.observe(title);
    });

    return () => {
      document.querySelectorAll('.section-title').forEach(title => {
        sectionTitleObserver.unobserve(title);
      });
    };
  }, [location.pathname]);

  return (
    <ErrorBoundary>
      <CustomerAuthProvider>
        <NotificationProvider>
          <CartProvider>
            <AudioPlayerProvider>
              <ImpersonationBanner />
              <Navigation />
              <CartDrawer />
              <Toaster />
            <main>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/services" element={<ServicesPage />} />
                <Route path="/beats" element={<BeatsPage />} />
                <Route path="/team" element={<TeamPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/order/:orderNumber" element={<OrderConfirmationPage />} />
                <Route path="/download/:token" element={<DownloadPage />} />
                <Route path="/login" element={<CustomerLoginPage />} />
                <Route path="/register" element={<CustomerRegisterPage />} />
                <Route path="/dashboard" element={<CustomerDashboard />} />
              </Routes>
            </main>
              <Footer />
              <GlobalAudioPlayer />
            </AudioPlayerProvider>
          </CartProvider>
        </NotificationProvider>
      </CustomerAuthProvider>
    </ErrorBoundary>
  );
}

export default App;
