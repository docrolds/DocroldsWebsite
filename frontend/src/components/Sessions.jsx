import { Check, Minus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

// Comparison table data
const comparisonFeatures = [
  { name: 'Professional Studio Recording', starter: true, professional: true, premium: true, business: false },
  { name: 'Initial Mix', starter: true, professional: true, premium: false, business: false },
  { name: 'Full Mix', starter: false, professional: false, premium: true, business: false },
  { name: 'Studio Master', starter: true, professional: true, premium: true, business: false },
  { name: 'Beat Selection from Catalog', starter: false, professional: true, premium: true, business: false },
  { name: 'Clean Version', starter: false, professional: true, premium: true, business: false },
  { name: 'Stems', starter: false, professional: false, premium: true, business: false },
  { name: 'MP3 & WAV Formats', starter: true, professional: true, premium: true, business: false },
  { name: 'Revisions Included', starter: false, professional: true, premium: true, business: false },
  { name: 'Copyright Registration Guidance', starter: false, professional: false, premium: false, business: true },
  { name: 'LLC Formation & Tax ID/EIN', starter: false, professional: false, premium: false, business: true },
  { name: 'Distribution & PRO Setup', starter: false, professional: false, premium: false, business: true },
  { name: 'MLC & SoundExchange Setup', starter: false, professional: false, premium: false, business: true },
  { name: 'Ongoing Email Support', starter: false, professional: false, premium: false, business: true },
];

// Package data
const packages = [
  { name: 'Starter', price: '$80', unit: '/hr', key: 'starter' },
  { name: 'Professional', price: '$150', unit: '', key: 'professional' },
  { name: 'Premium', price: '$300', unit: '', key: 'premium', recommended: true },
  { name: 'Business', price: '$750', unit: '', key: 'business' },
];

function Sessions() {
  const { ref: sectionRef, isVisible: sectionVisible } = useScrollAnimation({ threshold: 0.1 });
  const { ref: tableRef, isVisible: tableVisible } = useScrollAnimation({ threshold: 0.1 });

  const sessions = [
    {
      type: 'Starter Session',
      price: '$80/hour',
      duration: 'Professional Studio Recording',
      features: [
        'Professional Studio Recording',
        'Initial Mix',
        'Studio Master',
        'MP3 & WAV Formats'
      ]
    },
    {
      type: 'Professional Session',
      price: '$150',
      duration: '1 Hour Studio Session',
      features: [
        'Professional Studio Recording',
        'Beat Selection from Catalog',
        'Initial Mix',
        'Studio Master',
        'Clean Version',
        'MP3 & WAV Formats',
        '1-2 Revisions Included'
      ]
    },
    {
      type: 'Premium Package',
      price: '$300',
      duration: '2 Hours Studio Session',
      features: [
        'Professional Studio Recording',
        'Beat Selection from Catalog',
        'Full Mix',
        'Studio Master',
        'Stems',
        'MP3, WAV & Stems',
        'Clean & Explicit Versions',
        '3-5 Revisions Included'
      ]
    },
    {
      type: 'Business Consultation',
      price: '$750',
      duration: 'Music Publishing Setup',
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
      ]
    }
  ];

  // Session booking navigates to contact page with pre-selected session type
  const getBookingUrl = (sessionType) => {
    const sessionParam = encodeURIComponent(sessionType);
    return `/contact?session=${sessionParam}`;
  };

  // Render feature cell value - clean and visible
  const renderFeatureValue = (value) => {
    return value ? (
      <Check size={18} strokeWidth={2.5} className="check-icon" />
    ) : (
      <Minus size={16} strokeWidth={1.5} className="minus-icon" />
    );
  };

  return (
    <section id="sessions" ref={sectionRef}>
      <h2 className={`section-title animate-on-scroll fade-up ${sectionVisible ? 'visible' : ''}`}>Book Your Session</h2>

      {/* Session Cards */}
      <div className={`sessions-container animate-on-scroll fade-up ${sectionVisible ? 'visible' : ''}`} style={{ transitionDelay: '0.1s' }}>
        {sessions.map((session, index) => (
          <div key={index} className="session-card" style={{ transitionDelay: `${0.15 + index * 0.1}s` }}>
            <div className="session-type">{session.type}</div>
            <div className="session-price">{session.price}</div>
            <div className="session-duration">{session.duration}</div>
            <ul className="session-features">
              {session.features.map((feature, idx) => (
                <li key={idx}>{feature}</li>
              ))}
            </ul>
            <Link
              to={getBookingUrl(session.type)}
              className="book-session-btn"
            >
              {session.type.includes('Business') ? 'Book Consultation' : 'Book Session'}
            </Link>
          </div>
        ))}
      </div>

      {/* Comparison Table */}
      <div ref={tableRef} className={`comparison-wrapper animate-on-scroll fade-up ${tableVisible ? 'visible' : ''}`}>
        <h3 className="comparison-header">Compare Packages</h3>
        <p className="comparison-subtitle">Find the right option for your project</p>

        <div className="comparison-table-container">
          <table className="comparison-table">
            {/* Header */}
            <thead>
              <tr>
                <th className="comparison-th">Features</th>
                {packages.map((pkg) => (
                  <th
                    key={pkg.key}
                    className={`comparison-th-package ${pkg.recommended ? 'recommended' : ''}`}
                  >
                    {pkg.recommended && <div className="package-badge">Popular</div>}
                    <div className="package-name">{pkg.name}</div>
                    <div className="package-price">
                      {pkg.price}
                      {pkg.unit && <span className="package-price-unit">{pkg.unit}</span>}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {comparisonFeatures.map((feature, index) => {
                const isLast = index === comparisonFeatures.length - 1;
                return (
                  <tr key={index} className="comparison-row">
                    <td className={`comparison-td-feature ${isLast ? 'last' : ''}`}>
                      {feature.name}
                    </td>
                    <td className={`comparison-td-value ${isLast ? 'last' : ''}`}>
                      {renderFeatureValue(feature.starter)}
                    </td>
                    <td className={`comparison-td-value ${isLast ? 'last' : ''}`}>
                      {renderFeatureValue(feature.professional)}
                    </td>
                    <td className={`comparison-td-value ${isLast ? 'last' : ''}`}>
                      {renderFeatureValue(feature.premium)}
                    </td>
                    <td className={`comparison-td-value ${isLast ? 'last' : ''}`}>
                      {renderFeatureValue(feature.business)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default Sessions;
