import { useState } from 'react';
import { Link } from 'react-router-dom';

function ServicesPage() {
  const [activeTab, setActiveTab] = useState('recording');
  const [showAllHours, setShowAllHours] = useState(false);

  const serviceTabs = [
    { id: 'recording', label: 'Recording', icon: 'fa-microphone' },
    { id: 'mixing', label: 'Mixing', icon: 'fa-sliders-h' },
    { id: 'consulting', label: 'Consulting', icon: 'fa-briefcase' }
  ];

  // Recording packages - 3 main + all hours option
  const recordingPackages = [
    {
      title: 'Quick Session',
      subtitle: '2 Hours',
      price: '$160',
      priceNote: '$80/hr',
      features: [
        'Perfect for singles & demos',
        'Engineer included',
        'Acoustically treated room',
        'Premium microphones'
      ]
    },
    {
      title: 'Half Day',
      subtitle: '4 Hours',
      price: '$320',
      priceNote: '$80/hr',
      popular: true,
      features: [
        'Most popular choice',
        'Record multiple tracks',
        'Engineer included',
        'Analog & digital processing',
        'Session files included'
      ]
    },
    {
      title: 'Full Day',
      subtitle: '8 Hours',
      price: '$640',
      priceNote: '$80/hr',
      features: [
        'Complete EP/album sessions',
        'Extended creative time',
        'Engineer included',
        'Full studio access',
        'Priority booking'
      ]
    }
  ];

  const allHourlyRates = [
    { hours: 2, price: '$160' },
    { hours: 3, price: '$240' },
    { hours: 4, price: '$320' },
    { hours: 5, price: '$400' },
    { hours: 6, price: '$480' },
    { hours: 7, price: '$560' },
    { hours: 8, price: '$640' },
    { hours: 9, price: '$720' },
    { hours: 10, price: '$800' }
  ];

  const mixingServices = [
    {
      title: 'Basic Mix',
      subtitle: 'MP3 or WAV Master',
      price: '$75',
      features: [
        'Professional Mix',
        'MP3 or WAV Delivery',
        '2 Revisions Included',
        '3-5 Day Turnaround'
      ],
      cta: 'Order Now'
    },
    {
      title: 'Standard Mix',
      subtitle: 'Vocal Stems + Beat Track',
      price: '$100',
      features: [
        'Professional Mix',
        'Vocal Stems Processing',
        'Beat Track Integration',
        'MP3 & WAV Delivery',
        '2 Revisions Included',
        '3-5 Day Turnaround'
      ],
      cta: 'Order Now'
    },
    {
      title: 'Pro Mix',
      subtitle: 'Full Stems + Vocal Stems',
      price: '$200',
      popular: true,
      features: [
        'Professional Mix & Master',
        'Full Stems Processing',
        'Vocal Stems Included',
        'MP3 & WAV Delivery',
        'Stems Delivery (Optional)',
        '2 Revisions Included',
        '2-3 Day Turnaround'
      ],
      cta: 'Order Now'
    },
    {
      title: 'Premium Mix',
      subtitle: 'Complete Package',
      price: '$300',
      features: [
        'Professional Mix & Master',
        'Vocal Stems Processing',
        'Beat Stems Processing',
        'Clean Version Included',
        'All File Formats',
        'Stems Delivery (Optional)',
        '2 Revisions Included',
        '24-48hr Priority Turnaround'
      ],
      cta: 'Order Now'
    }
  ];

  const consultingService = {
    title: 'Business Consultation',
    subtitle: 'Music Publishing Setup',
    price: '$750',
    features: [
      'Copyright Registration Guidance',
      'LLC Formation Consultation',
      'Tax ID/EIN Setup',
      'Distribution Setup (DSPs)',
      'PRO Registration (ASCAP/BMI/SESAC)',
      'MLC (Mechanical License) Setup',
      'SoundExchange Registration',
      'Metadata Best Practices',
      'Publishing Administration Overview',
      'Royalty Tracking Education',
      'Contract Review Basics',
      'Ongoing Email Support'
    ],
    cta: 'Book Consultation'
  };

  const handleServiceClick = (serviceName) => {
    alert(`${serviceName} - Square payment integration coming soon!`);
  };

  // Service Card Component
  const ServiceCard = ({ title, subtitle, price, priceNote, features, popular, cta, isWide }) => (
    <div className={`unified-card ${popular ? 'popular' : ''} ${isWide ? 'wide-card' : ''}`}>
      {popular && <div className="card-badge">Most Popular</div>}
      <div className="card-header">
        <h3 className="card-title">{title}</h3>
        {subtitle && <p className="card-subtitle">{subtitle}</p>}
      </div>
      <div className="card-price">
        <span className="price-main">{price}</span>
        {priceNote && <span className="price-note">{priceNote}</span>}
      </div>
      <ul className={`card-features ${isWide ? 'two-col' : ''}`}>
        {features.map((feature, idx) => (
          <li key={idx}><i className="fas fa-check" aria-hidden="true"></i>{feature}</li>
        ))}
      </ul>
      <button className="card-cta" onClick={() => handleServiceClick(title)} aria-label={`${cta} for ${title}`}>
        {cta}
      </button>
    </div>
  );

  return (
    <div className="services-page-v2">
      {/* Hero Banner */}
      <section className="services-hero-v2">
        <div className="hero-bg"></div>
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <h1>Elevate Your Sound</h1>
          <p>World-class recording, mixing, and production services powered by industry-standard analog and digital gear</p>
        </div>
      </section>

      {/* Sticky Tab Navigation */}
      <nav className="service-tabs" role="tablist" aria-label="Service categories">
        {serviceTabs.map((tab) => (
          <button
            key={tab.id}
            className={`service-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`${tab.id}-panel`}
          >
            <i className={`fas ${tab.icon}`} aria-hidden="true"></i>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      <div className="tab-content">
        {/* Recording Tab */}
        {activeTab === 'recording' && (
          <section className="service-section" role="tabpanel" id="recording-panel" aria-label="Recording services">
            <div className="section-header">
              <div className="section-icon">
                <i className="fas fa-microphone" aria-hidden="true"></i>
              </div>
              <h2>Studio Sessions</h2>
              <p>Step into our professionally treated recording space and capture your vision with pristine clarity. Our sessions include access to premium microphones, preamps, and outboard gear.</p>
              <div className="rate-badge">
                <span className="rate-value">$80</span>
                <span className="rate-label">/hour</span>
              </div>
            </div>

            <div className="cards-grid three-col">
              {recordingPackages.map((pkg, index) => (
                <ServiceCard
                  key={index}
                  title={pkg.title}
                  subtitle={pkg.subtitle}
                  price={pkg.price}
                  priceNote={pkg.priceNote}
                  features={pkg.features}
                  popular={pkg.popular}
                  cta="Book Session"
                />
              ))}
            </div>

            {/* All Hours Dropdown */}
            <div className="hours-dropdown">
              <button
                className="dropdown-toggle"
                onClick={() => setShowAllHours(!showAllHours)}
                aria-expanded={showAllHours}
                aria-controls="hours-content"
              >
                <span>View All Hourly Options</span>
                <i className={`fas fa-chevron-${showAllHours ? 'up' : 'down'}`} aria-hidden="true"></i>
              </button>

              {showAllHours && (
                <div className="dropdown-content" id="hours-content">
                  <div className="hours-grid" role="list">
                    {allHourlyRates.map((rate, index) => (
                      <button
                        key={index}
                        className={`hour-option ${rate.hours === 4 ? 'popular' : ''}`}
                        onClick={() => handleServiceClick(`${rate.hours} Hour Session`)}
                        aria-label={`Book ${rate.hours} hour session for ${rate.price}`}
                      >
                        <span className="hour-duration">{rate.hours} Hours</span>
                        <span className="hour-price">{rate.price}</span>
                        {rate.hours === 4 && <span className="hour-badge">Popular</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Mixing Tab */}
        {activeTab === 'mixing' && (
          <section className="service-section" role="tabpanel" id="mixing-panel" aria-label="Mixing services">
            <div className="section-header">
              <div className="section-icon">
                <i className="fas fa-sliders-h" aria-hidden="true"></i>
              </div>
              <h2>Mixing Services</h2>
              <p>Transform your raw recordings into polished, radio-ready tracks. Our mixing process combines vintage analog warmth with modern digital precision using gear like the 1176, LA-2A, and Neve 1073.</p>
            </div>

            <div className="cards-grid four-col">
              {mixingServices.map((service, index) => (
                <ServiceCard
                  key={index}
                  title={service.title}
                  subtitle={service.subtitle}
                  price={service.price}
                  features={service.features}
                  popular={service.popular}
                  cta={service.cta}
                />
              ))}
            </div>
          </section>
        )}

        {/* Consulting Tab */}
        {activeTab === 'consulting' && (
          <section className="service-section" role="tabpanel" id="consulting-panel" aria-label="Consulting services">
            <div className="section-header">
              <div className="section-icon">
                <i className="fas fa-briefcase" aria-hidden="true"></i>
              </div>
              <h2>Business Consultation</h2>
              <p>Navigate the business side of music with expert guidance. From copyright registration to distribution setup, we'll help you build a solid foundation for your music career.</p>
            </div>

            <div className="cards-grid single">
              <ServiceCard
                title={consultingService.title}
                subtitle={consultingService.subtitle}
                price={consultingService.price}
                features={consultingService.features}
                cta={consultingService.cta}
                isWide={true}
              />
            </div>
          </section>
        )}
      </div>

      {/* Contact CTA */}
      <section className="services-cta-v2">
        <div className="cta-bg"></div>
        <div className="cta-content">
          <h2>Ready to Elevate Your Sound?</h2>
          <p>Let's discuss your project and find the perfect solution for your needs.</p>
          <div className="cta-buttons">
            <Link to="/contact" className="cta-primary">
              <i className="fas fa-envelope" aria-hidden="true"></i> Get in Touch
            </Link>
            <a href="tel:7272825449" className="cta-secondary" aria-label="Call us at (727) 282-5449">
              <i className="fas fa-phone" aria-hidden="true"></i> (727) 282-5449
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ServicesPage;
