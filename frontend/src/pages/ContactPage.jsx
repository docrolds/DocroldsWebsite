import { useState } from 'react';
import { API_URL } from '../config.js';

function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const response = await fetch(`${API_URL}/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setSubmitStatus('success');
        setFormData({ name: '', email: '', phone: '', message: '' });
      } else {
        setSubmitStatus('error');
      }
    } catch (err) {
      console.error('Failed to submit form:', err);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="contact-page-v2">
      {/* Hero Section */}
      <section className="contact-hero-v2">
        <div className="contact-hero-content-v2">
          <h1>Contact</h1>
          <p>Let's talk about your next project</p>
        </div>
      </section>

      <section className="contact-section">
        <div className="contact-container">
          {/* Contact Info */}
          <div className="contact-info">
            <h3>Get In Touch</h3>
            <p>Have questions about our services? Want to book a session? We'd love to hear from you!</p>

            <div className="contact-details">
              <div className="contact-item">
                <div className="contact-icon" aria-hidden="true">
                  <i className="fas fa-envelope"></i>
                </div>
                <div className="contact-text">
                  <span className="contact-label">Email</span>
                  <a href="mailto:Docroldsllc@gmail.com" aria-label="Email us at Docroldsllc@gmail.com">Docroldsllc@gmail.com</a>
                </div>
              </div>

              <div className="contact-item">
                <div className="contact-icon" aria-hidden="true">
                  <i className="fas fa-phone"></i>
                </div>
                <div className="contact-text">
                  <span className="contact-label">Phone</span>
                  <a href="tel:7272825449" aria-label="Call us at (727) 282-5449">(727) 282-5449</a>
                </div>
              </div>

              <div className="contact-item">
                <div className="contact-icon" aria-hidden="true">
                  <i className="fas fa-clock"></i>
                </div>
                <div className="contact-text">
                  <span className="contact-label">Hours</span>
                  <span>Mon - Sat: 10AM - 10PM</span>
                </div>
              </div>
            </div>

            {/* Social Links */}
            <div className="contact-socials">
              <h4>Follow Us</h4>
              <div className="social-icons">
                <a href="https://instagram.com/docrolds" target="_blank" rel="noopener noreferrer" title="Instagram" aria-label="Follow us on Instagram (opens in new tab)">
                  <i className="fab fa-instagram" aria-hidden="true"></i>
                </a>
                <a href="https://open.spotify.com/playlist/6lQ3qQ34fxkf8roPLdbMYH" target="_blank" rel="noopener noreferrer" title="Spotify" aria-label="Listen on Spotify (opens in new tab)">
                  <i className="fab fa-spotify" aria-hidden="true"></i>
                </a>
                <a href="https://www.youtube.com/@RealDocrolds" target="_blank" rel="noopener noreferrer" title="YouTube" aria-label="Subscribe on YouTube (opens in new tab)">
                  <i className="fab fa-youtube" aria-hidden="true"></i>
                </a>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="contact-form-wrapper">
            <h3>Send a Message</h3>

            {submitStatus === 'success' && (
              <div className="form-success" role="alert">
                <i className="fas fa-check-circle" aria-hidden="true"></i>
                <p>Message sent successfully! We'll get back to you soon.</p>
              </div>
            )}

            {submitStatus === 'error' && (
              <div className="form-error" role="alert">
                <i className="fas fa-exclamation-circle" aria-hidden="true"></i>
                <p>Failed to send message. Please try again or email us directly.</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="contact-form">
              <div className="form-group">
                <label htmlFor="name">Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Your Name"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone">Phone</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="(555) 555-5555"
                />
              </div>

              <div className="form-group">
                <label htmlFor="message">Message *</label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Tell us about your project..."
                  rows="5"
                  required
                ></textarea>
              </div>

              <button
                type="submit"
                className="submit-btn"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
                    Sending...
                  </>
                ) : (
                  <>
                    <i className="fas fa-paper-plane" aria-hidden="true"></i>
                    Send Message
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ContactPage;
