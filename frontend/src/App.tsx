import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './App.css';
import { CartProvider } from './context/CartContext';
import { CustomerAuthProvider } from './context/CustomerAuthContext';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
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
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import CustomerDashboard from './pages/CustomerDashboard';
import LicenseAgreementPage from './pages/LicenseAgreementPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import AdminDashboard from './pages/AdminDashboard';
import AdminLoginPage from './pages/AdminLoginPage';
import BookPage from './pages/BookPage';
import ReschedulePage from './pages/ReschedulePage';
import StemsUploadPage from './pages/StemsUploadPage';
import { Link } from 'react-router-dom';

function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8">
      <h1 className="text-4xl font-semibold mb-2">404</h1>
      <p className="text-muted-foreground mb-6">This page doesn't exist.</p>
      <Link to="/" className="text-primary underline">
        Back to home
      </Link>
    </div>
  );
}

// Single entry point for /admin/*: shows the login form while logged out
// and the dashboard once authenticated, so there's one URL to bookmark
// instead of a separate /admin/login page redirecting back and forth.
function AdminGate() {
  const { isAuthenticated, loading } = useAdminAuth();

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner"></div>
      </div>
    );
  }

  return isAuthenticated ? <AdminDashboard /> : <AdminLoginPage />;
}

function App() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

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

  // Admin routes - separate layout without main site nav/footer
  if (isAdminRoute) {
    return (
      <ErrorBoundary>
        <AdminAuthProvider>
          <Toaster />
          <Routes>
            <Route path="/admin/login" element={<Navigate to="/admin" replace />} />
            <Route path="/admin/*" element={<AdminGate />} />
          </Routes>
        </AdminAuthProvider>
      </ErrorBoundary>
    );
  }

  // Regular site routes
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
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/dashboard" element={<CustomerDashboard />} />
                <Route path="/licenses" element={<LicenseAgreementPage />} />
                <Route path="/privacy" element={<PrivacyPolicyPage />} />
                <Route path="/terms" element={<TermsOfServicePage />} />
                <Route path="/book" element={<BookPage />} />
                <Route path="/reschedule/:bookingNumber" element={<ReschedulePage />} />
                <Route path="/booking/:bookingNumber/stems" element={<StemsUploadPage />} />
                <Route path="*" element={<NotFoundPage />} />
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
