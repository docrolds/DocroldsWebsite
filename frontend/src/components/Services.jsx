function Services() {
  const studioSessions = [
    { duration: '2 Hours', price: '$160' },
    { duration: '3 Hours', price: '$240' },
    { duration: '4 Hours', price: '$320' },
    { duration: '5 Hours', price: '$400' },
    { duration: '6 Hours', price: '$480' },
    { duration: '7 Hours', price: '$560' },
    { duration: '8 Hours', price: '$640' },
    { duration: '9 Hours', price: '$720' },
    { duration: '10 Hours', price: '$800' }
  ];

  const beatLeases = [
    {
      tier: 'Standard Lease',
      price: '$50',
      features: [
        'MP3 File',
        'Up to 2,500 Streams',
        'Non-Exclusive Rights',
        'Must Credit Producer',
        'For Mixtapes & Non-Profit',
        'Tagged Beat'
      ]
    },
    {
      tier: 'Unlimited Lease',
      price: '$150',
      features: [
        'WAV + MP3 Files',
        'Unlimited Streams',
        'Non-Exclusive Rights',
        'Untagged Beat',
        'Radio & TV Ready',
        'Music Videos Allowed',
        'Paid Performances'
      ],
      popular: true
    },
    {
      tier: 'Exclusive Rights',
      price: 'Send Offer',
      features: [
        'Full Ownership Transfer',
        'WAV + MP3 + Stems',
        'Unlimited Commercial Use',
        'Beat Removed from Store',
        'Full Publishing Rights',
        'Unlimited Distribution',
        'Radio, TV & Film Use'
      ]
    }
  ];

  const mixingServices = [
    {
      tier: 'Basic Mix',
      price: '$75',
      description: 'MP3 or WAV Master',
      features: [
        'Professional Mix',
        'MP3 or WAV Delivery',
        '2 Revisions Included',
        '3-5 Day Turnaround'
      ]
    },
    {
      tier: 'Standard Mix',
      price: '$100',
      description: 'Vocal Stems + Beat Track',
      features: [
        'Professional Mix',
        'Vocal Stems Processing',
        'Beat Track Integration',
        'MP3 & WAV Delivery',
        '2 Revisions Included',
        '3-5 Day Turnaround'
      ]
    },
    {
      tier: 'Pro Mix',
      price: '$200',
      description: 'Full Stems + Vocal Stems',
      features: [
        'Professional Mix & Master',
        'Full Stems Processing',
        'Vocal Stems Included',
        'MP3 & WAV Delivery',
        'Stems Delivery (Optional)',
        '2 Revisions Included',
        '2-3 Day Turnaround'
      ],
      popular: true
    },
    {
      tier: 'Premium Mix',
      price: '$300',
      description: 'Complete Package',
      features: [
        'Professional Mix & Master',
        'Vocal Stems Processing',
        'Beat Stems Processing',
        'Clean Version Included',
        'All File Formats',
        'Stems Delivery (Optional)',
        '2 Revisions Included',
        '24-48hr Priority Turnaround'
      ]
    }
  ];

  const businessConsultation = {
    tier: 'Business Consultation',
    price: '$750',
    description: 'Music Publishing Setup',
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
  };

  const handleServiceClick = (serviceName) => {
    alert(`${serviceName} - Square payment integration coming soon!`);
  };

  return (
    <section id="services" className="services-section">
      <h2 className="section-title">Our Services</h2>

      {/* Studio Sessions */}
      <div className="services-category">
        <h3 className="category-title">
          <i className="fas fa-microphone"></i>
          Studio Sessions
          <span className="rate-badge">$80/hr</span>
        </h3>
        <div className="sessions-grid">
          {studioSessions.map((session, index) => (
            <div key={index} className="studio-session-card">
              <div className="session-duration">{session.duration}</div>
              <div className="session-price">{session.price}</div>
              <button
                className="service-cta"
                onClick={() => handleServiceClick(`${session.duration} Studio Session`)}
              >
                Book Now
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Beat Leasing */}
      <div className="services-category">
        <h3 className="category-title">
          <i className="fas fa-music"></i>
          Beat Leasing
        </h3>
        <div className="services-grid">
          {beatLeases.map((lease, index) => (
            <div key={index} className={`service-card ${lease.popular ? 'popular' : ''}`}>
              {lease.popular && <div className="popular-badge">Most Popular</div>}
              <div className="service-tier">{lease.tier}</div>
              <div className="service-price">{lease.price}</div>
              <ul className="service-features">
                {lease.features.map((feature, idx) => (
                  <li key={idx}><i className="fas fa-check"></i> {feature}</li>
                ))}
              </ul>
              <button
                className="service-cta"
                onClick={() => handleServiceClick(lease.tier)}
              >
                {lease.price === 'Send Offer' ? 'Contact Us' : 'Get License'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Mixing Services */}
      <div className="services-category">
        <h3 className="category-title">
          <i className="fas fa-sliders-h"></i>
          Mixing Services
          <span className="revision-badge">2 Revisions Included</span>
        </h3>
        <div className="services-grid four-col">
          {mixingServices.map((mix, index) => (
            <div key={index} className={`service-card ${mix.popular ? 'popular' : ''}`}>
              {mix.popular && <div className="popular-badge">Best Value</div>}
              <div className="service-tier">{mix.tier}</div>
              <div className="service-price">{mix.price}</div>
              <div className="service-description">{mix.description}</div>
              <ul className="service-features">
                {mix.features.map((feature, idx) => (
                  <li key={idx}><i className="fas fa-check"></i> {feature}</li>
                ))}
              </ul>
              <button
                className="service-cta"
                onClick={() => handleServiceClick(mix.tier)}
              >
                Order Now
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Business Consultation */}
      <div className="services-category">
        <h3 className="category-title">
          <i className="fas fa-briefcase"></i>
          Business Consultation
        </h3>
        <div className="consultation-container">
          <div className="service-card consultation-card">
            <div className="service-tier">{businessConsultation.tier}</div>
            <div className="service-price">{businessConsultation.price}</div>
            <div className="service-description">{businessConsultation.description}</div>
            <ul className="service-features two-column">
              {businessConsultation.features.map((feature, idx) => (
                <li key={idx}><i className="fas fa-check"></i> {feature}</li>
              ))}
            </ul>
            <button
              className="service-cta"
              onClick={() => handleServiceClick('Business Consultation')}
            >
              Book Consultation
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Services;
