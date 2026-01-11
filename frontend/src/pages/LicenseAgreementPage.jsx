import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCart } from '../context/CartContext';

export default function LicenseAgreementPage() {
  const [searchParams] = useSearchParams();
  const { licenseTiers } = useCart();
  const [activeTab, setActiveTab] = useState('standard');

  // Check URL params for initial tab
  useEffect(() => {
    const type = searchParams.get('type');
    if (type && ['standard', 'unlimited', 'exclusive'].includes(type)) {
      setActiveTab(type);
    }
  }, [searchParams]);

  const licenseDetails = {
    standard: {
      title: 'Standard Lease Agreement',
      subtitle: 'Basic License for Independent Artists',
      price: '$50',
      overview: 'The Standard Lease grants you a non-exclusive license to use the beat for your musical composition. This license is ideal for artists who are starting out or releasing singles with moderate distribution expectations. Producer retains all master rights.',
      deliverables: [
        'High-Quality MP3 File (320kbps)',
        'Tagged beat preview removed',
      ],
      terms: {
        distribution: {
          title: 'Distribution Rights',
          items: [
            { label: 'Audio Streams', value: 'Up to 100,000 streams', icon: 'fa-headphones' },
            { label: 'Music Videos', value: 'Up to 1 music video', icon: 'fa-video' },
            { label: 'Video Streams', value: 'Up to 100,000 video streams', icon: 'fa-play-circle' },
            { label: 'Radio Broadcasting', value: 'Prohibited', icon: 'fa-broadcast-tower', prohibited: true },
            { label: 'Paid Performances', value: 'Up to 1 paid performance', icon: 'fa-microphone' },
          ]
        },
        usage: {
          title: 'Usage Rights',
          items: [
            { label: 'Monetization', value: 'Allowed on all platforms', allowed: true },
            { label: 'Streaming Platforms', value: 'Spotify, Apple Music, etc.', allowed: true },
            { label: 'Social Media', value: 'YouTube, Instagram, TikTok', allowed: true },
            { label: 'Publishing Split', value: '50% Producer / 50% Artist', allowed: true },
            { label: 'Sync Licensing', value: 'Not included', allowed: false },
            { label: 'Master Ownership', value: 'Producer retains master rights', allowed: false },
          ]
        },
        requirements: {
          title: 'Requirements',
          items: [
            'MUST credit producer: "Prod. by Doc Rolds" in song title',
            'Credit required in metadata, liner notes, and all platforms',
            'Credit required on ALL versions (remixes, edits, live performances)',
            'Do not register beat with a PRO (Producer retains publishing)',
            'Do not resell, transfer, or sub-license the beat',
            'Cannot claim ownership of the instrumental or master',
          ]
        }
      },
      validity: 'Perpetual (lifetime license, does not expire)',
      exclusivity: 'Non-Exclusive - Producer may continue to sell this beat to other artists',
    },
    unlimited: {
      title: 'Unlimited Lease Agreement',
      subtitle: 'Premium License for Serious Artists',
      price: '$150',
      popular: true,
      overview: 'The Unlimited Lease provides maximum flexibility with no stream caps or distribution limits. Perfect for artists expecting significant reach or planning major releases. Includes high-quality WAV files for professional mixing. Producer retains all master rights.',
      deliverables: [
        'High-Quality WAV File (24-bit)',
        'High-Quality MP3 File (320kbps)',
        'Track Stems (Trackouts)',
        'Untagged/Clean version',
      ],
      terms: {
        distribution: {
          title: 'Distribution Rights',
          items: [
            { label: 'Audio Streams', value: 'Unlimited', icon: 'fa-headphones', unlimited: true },
            { label: 'Music Videos', value: 'Unlimited', icon: 'fa-video', unlimited: true },
            { label: 'Video Streams', value: 'Unlimited', icon: 'fa-play-circle', unlimited: true },
            { label: 'Radio Broadcasting', value: 'Unlimited stations', icon: 'fa-broadcast-tower', unlimited: true },
            { label: 'Paid Performances', value: 'Unlimited performances', icon: 'fa-microphone', unlimited: true },
          ]
        },
        usage: {
          title: 'Usage Rights',
          items: [
            { label: 'Monetization', value: 'Allowed on all platforms', allowed: true },
            { label: 'Streaming Platforms', value: 'Spotify, Apple Music, etc.', allowed: true },
            { label: 'Social Media', value: 'YouTube, Instagram, TikTok', allowed: true },
            { label: 'Sync Licensing', value: 'TV, Film, Commercials allowed', allowed: true },
            { label: 'Physical Sales', value: 'CDs, Vinyl allowed', allowed: true },
            { label: 'Publishing Split', value: '50% Producer / 50% Artist', allowed: true },
            { label: 'Master Ownership', value: 'Producer retains master rights', allowed: false },
          ]
        },
        requirements: {
          title: 'Requirements',
          items: [
            'MUST credit producer: "Prod. by Doc Rolds" in song title',
            'Credit required in metadata, liner notes, and all platforms',
            'Credit required on ALL versions (remixes, edits, live performances)',
            'Do not register beat melody/composition with a PRO',
            'Do not resell, transfer, or sub-license the beat',
            'Cannot claim ownership of the instrumental or master',
          ]
        }
      },
      validity: 'Perpetual (lifetime license, does not expire)',
      exclusivity: 'Non-Exclusive - Producer may continue to sell this beat to other artists',
    },
    exclusive: {
      title: 'Exclusive Rights Agreement',
      subtitle: 'Exclusive Usage Rights',
      price: 'Contact for Pricing',
      overview: 'The Exclusive Rights license grants you exclusive usage rights to the beat. Once purchased, the beat is removed from the store and will no longer be sold to other artists. Producer retains master ownership and must be credited on all releases.',
      deliverables: [
        'High-Quality WAV File (24-bit)',
        'High-Quality MP3 File (320kbps)',
        'Track Stems (individual instrument files)',
        'Project file (upon request)',
        'Beat removed from all platforms',
      ],
      terms: {
        distribution: {
          title: 'Distribution Rights',
          items: [
            { label: 'Audio Streams', value: 'Unlimited', icon: 'fa-headphones', unlimited: true },
            { label: 'Music Videos', value: 'Unlimited', icon: 'fa-video', unlimited: true },
            { label: 'Video Streams', value: 'Unlimited', icon: 'fa-play-circle', unlimited: true },
            { label: 'Radio Broadcasting', value: 'Unlimited', icon: 'fa-broadcast-tower', unlimited: true },
            { label: 'Paid Performances', value: 'Unlimited', icon: 'fa-microphone', unlimited: true },
          ]
        },
        usage: {
          title: 'Usage Rights',
          items: [
            { label: 'Exclusive Use', value: 'Only you can use this beat', allowed: true },
            { label: 'Beat Status', value: 'Removed from store (marked SOLD)', allowed: true },
            { label: 'Sync Licensing', value: 'Full sync rights included', allowed: true },
            { label: 'Publishing Split', value: '50% Producer / 50% Artist (negotiable)', allowed: true },
            { label: 'Master Ownership', value: 'Producer retains master rights', allowed: false },
            { label: 'Transfer Rights', value: 'Cannot resell or transfer beat', allowed: false },
          ]
        },
        requirements: {
          title: 'Requirements',
          items: [
            'MUST credit producer: "Prod. by Doc Rolds" in song title',
            'Credit required in metadata, liner notes, and all platforms',
            'Credit required on ALL versions (remixes, edits, live performances)',
            'Written agreement/contract required',
            'Payment must clear before delivery',
            'Cannot claim ownership of the master recording',
          ]
        }
      },
      validity: 'Perpetual - Exclusive usage rights (Producer retains master)',
      exclusivity: 'Exclusive - Beat removed from store, but master owned by producer',
    }
  };

  const currentLicense = licenseDetails[activeTab];

  return (
    <div className="license-agreement-page">
      <div className="license-agreement-container">
        {/* Header */}
        <div className="license-header">
          <h1>Beat License Agreements</h1>
          <p>Choose the license that fits your needs. All licenses are legally binding agreements.</p>
        </div>

        {/* License Tabs */}
        <div className="license-tabs">
          <button
            className={`license-tab ${activeTab === 'standard' ? 'active' : ''}`}
            onClick={() => setActiveTab('standard')}
          >
            <i className="fas fa-file-alt"></i>
            Standard Lease
          </button>
          <button
            className={`license-tab ${activeTab === 'unlimited' ? 'active' : ''}`}
            onClick={() => setActiveTab('unlimited')}
          >
            <i className="fas fa-infinity"></i>
            Unlimited Lease
            <span className="popular-badge">Popular</span>
          </button>
          <button
            className={`license-tab ${activeTab === 'exclusive' ? 'active' : ''}`}
            onClick={() => setActiveTab('exclusive')}
          >
            <i className="fas fa-crown"></i>
            Exclusive Rights
          </button>
        </div>

        {/* License Content */}
        <div className="license-content">
          {/* Title Card */}
          <div className="license-title-card">
            <div className="license-title-info">
              <h2>{currentLicense.title}</h2>
              <p>{currentLicense.subtitle}</p>
            </div>
            <div className="license-price-badge">
              {currentLicense.price}
            </div>
          </div>

          {/* Overview */}
          <div className="license-section">
            <h3><i className="fas fa-info-circle"></i> Overview</h3>
            <p className="license-overview">{currentLicense.overview}</p>
          </div>

          {/* What You Get */}
          <div className="license-section">
            <h3><i className="fas fa-box-open"></i> What You Get</h3>
            <ul className="deliverables-list">
              {currentLicense.deliverables.map((item, idx) => (
                <li key={idx}>
                  <i className="fas fa-check-circle"></i>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Distribution Rights */}
          <div className="license-section">
            <h3><i className="fas fa-share-alt"></i> {currentLicense.terms.distribution.title}</h3>
            <div className="rights-grid">
              {currentLicense.terms.distribution.items.map((item, idx) => (
                <div key={idx} className={`rights-item ${item.unlimited ? 'unlimited' : ''} ${item.prohibited ? 'prohibited' : ''}`}>
                  <div className="rights-icon">
                    <i className={`fas ${item.icon}`}></i>
                  </div>
                  <div className="rights-info">
                    <span className="rights-label">{item.label}</span>
                    <span className="rights-value">{item.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Usage Rights */}
          <div className="license-section">
            <h3><i className="fas fa-check-double"></i> {currentLicense.terms.usage.title}</h3>
            <div className="usage-list">
              {currentLicense.terms.usage.items.map((item, idx) => (
                <div key={idx} className={`usage-item ${item.allowed ? 'allowed' : 'not-allowed'}`}>
                  <i className={`fas ${item.allowed ? 'fa-check' : 'fa-times'}`}></i>
                  <div>
                    <span className="usage-label">{item.label}</span>
                    <span className="usage-value">{item.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Requirements */}
          <div className="license-section requirements-section">
            <h3><i className="fas fa-exclamation-triangle"></i> {currentLicense.terms.requirements.title}</h3>
            <ul className="requirements-list">
              {currentLicense.terms.requirements.items.map((item, idx) => (
                <li key={idx}>
                  <i className="fas fa-arrow-right"></i>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* License Info Cards */}
          <div className="license-info-cards">
            <div className="info-card">
              <div className="info-card-icon">
                <i className="fas fa-clock"></i>
              </div>
              <div className="info-card-content">
                <span className="info-card-label">License Validity</span>
                <span className="info-card-value">{currentLicense.validity}</span>
              </div>
            </div>
            <div className="info-card">
              <div className="info-card-icon">
                <i className="fas fa-users"></i>
              </div>
              <div className="info-card-content">
                <span className="info-card-label">Exclusivity</span>
                <span className="info-card-value">{currentLicense.exclusivity}</span>
              </div>
            </div>
          </div>

          {/* Legal Terms */}
          <div className="license-section legal-section">
            <h3><i className="fas fa-gavel"></i> Legal Terms & Conditions</h3>
            <div className="legal-terms">
              <div className="legal-clause">
                <h4>1. Master Ownership & No Transfer Clause</h4>
                <p className="legal-quote">"Licensor (Doc Rolds) hereby reserves and retains all right, title, and interest in and to the Beat, including but not limited to the Master Recording copyright and the Underlying Musical Composition. This agreement is a non-exclusive license and not a sale of the Master. Licensee shall not own any portion of the Beat."</p>
                <p>This applies to ALL license tiers including Exclusive Rights. The Exclusive license grants exclusive USAGE rights only - not ownership of the master recording.</p>
              </div>

              <div className="legal-clause">
                <h4>2. Derivative Work Definition</h4>
                <p className="legal-quote">"The new song created by the Artist (the 'Track') is a Derivative Work. Artist owns the copyright to their lyrics and vocal performance only. The musical portion of the Track remains the property of the Licensor."</p>
                <p>Your finished song is a derivative work combining your original elements (lyrics, vocals) with the Producer's beat. You own your creative contributions; the Producer owns the instrumental.</p>
              </div>

              <div className="legal-clause">
                <h4>3. Buy-Out & Exclusivity Protection</h4>
                <p className="legal-quote">"Purchasing an 'Unlimited Lease' does not grant exclusivity. Licensor may continue to license the Beat to other parties. Only an 'Exclusive Rights' purchase (subject to a separate agreement) will result in the Beat being removed from the store."</p>
                <p>Standard and Unlimited leases are non-exclusive. Only Exclusive Rights removes the beat from sale to other artists.</p>
              </div>

              <div className="legal-clause">
                <h4>4. Termination of License (Stream Limit Enforcement)</h4>
                <p className="legal-quote">"If the Licensee exceeds the stream limits of the Standard Lease without upgrading to an Unlimited or Exclusive license, this license shall automatically terminate. Any continued distribution of the Track after termination constitutes willful copyright infringement."</p>
                <p>Monitor your streams. If you're approaching 100,000 streams on a Standard Lease, upgrade to Unlimited before exceeding the limit.</p>
              </div>

              <div className="legal-clause">
                <h4>5. Mandatory Credit Clause</h4>
                <p className="legal-quote">"Licensee MUST credit 'Prod. by Doc Rolds' in the song title, metadata, and all distribution platforms for ALL releases using the Beat. This requirement applies to all derivative versions including remixes, edits, acoustic versions, and live recordings. Failure to provide proper credit constitutes a material breach of this agreement."</p>
                <p>Credit format: <strong>"Song Title (Prod. by Doc Rolds)"</strong> - This is required on ALL platforms, ALL versions, and ALL license types without exception.</p>
              </div>

              <div className="legal-clause">
                <h4>6. Publishing Split</h4>
                <p>Standard publishing split is <strong>50% Producer / 50% Artist</strong>. This is negotiable for Exclusive Rights purchases via written agreement. Artist may not register the beat composition or melody with a Performance Rights Organization (PRO) without prior written consent.</p>
              </div>

              <div className="legal-clause">
                <h4>7. Prohibited Uses</h4>
                <p>The Licensee may NOT:</p>
                <ul>
                  <li>Resell, lease, or transfer the Beat to any third party</li>
                  <li>Claim ownership of the instrumental or master recording</li>
                  <li>Register the Beat melody/composition with a PRO</li>
                  <li>Use the Beat without proper producer credit</li>
                  <li>Use the Beat for hate speech, illegal activities, or defamatory content</li>
                  <li>Sub-license the Beat to others</li>
                </ul>
              </div>

              <div className="legal-clause">
                <h4>8. Refund Policy</h4>
                <p>Due to the digital nature of the product, <strong>all sales are final</strong>. No refunds will be issued once the files have been delivered or downloaded.</p>
              </div>

              <div className="legal-clause">
                <h4>9. Breach & Enforcement</h4>
                <p>Failure to credit the producer, exceeding stream limits without upgrading, or violation of any terms may result in immediate license termination and legal action for damages including but not limited to lost revenue, legal fees, and statutory damages under copyright law.</p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="license-cta">
            <Link to="/beats" className="cta-button primary">
              <i className="fas fa-music"></i>
              Browse Beats
            </Link>
            <Link to="/contact" className="cta-button secondary">
              <i className="fas fa-envelope"></i>
              Contact for Custom Terms
            </Link>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="license-comparison">
          <h2>License Comparison</h2>
          <div className="comparison-table-wrapper">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Standard</th>
                  <th className="popular">Unlimited</th>
                  <th>Exclusive</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Price</td>
                  <td>$50</td>
                  <td className="popular">$150</td>
                  <td>Contact Us</td>
                </tr>
                <tr>
                  <td>Audio Streams</td>
                  <td>100,000</td>
                  <td className="popular"><i className="fas fa-infinity"></i> Unlimited</td>
                  <td><i className="fas fa-infinity"></i> Unlimited</td>
                </tr>
                <tr>
                  <td>Video Streams</td>
                  <td>100,000</td>
                  <td className="popular"><i className="fas fa-infinity"></i> Unlimited</td>
                  <td><i className="fas fa-infinity"></i> Unlimited</td>
                </tr>
                <tr>
                  <td>Music Videos</td>
                  <td>1</td>
                  <td className="popular"><i className="fas fa-infinity"></i> Unlimited</td>
                  <td><i className="fas fa-infinity"></i> Unlimited</td>
                </tr>
                <tr>
                  <td>Radio Airplay</td>
                  <td><i className="fas fa-times"></i> Prohibited</td>
                  <td className="popular"><i className="fas fa-infinity"></i> Unlimited</td>
                  <td><i className="fas fa-infinity"></i> Unlimited</td>
                </tr>
                <tr>
                  <td>Paid Performances</td>
                  <td>1</td>
                  <td className="popular"><i className="fas fa-infinity"></i> Unlimited</td>
                  <td><i className="fas fa-infinity"></i> Unlimited</td>
                </tr>
                <tr>
                  <td>MP3 File</td>
                  <td><i className="fas fa-check"></i></td>
                  <td className="popular"><i className="fas fa-check"></i></td>
                  <td><i className="fas fa-check"></i></td>
                </tr>
                <tr>
                  <td>WAV File</td>
                  <td><i className="fas fa-times"></i></td>
                  <td className="popular"><i className="fas fa-check"></i></td>
                  <td><i className="fas fa-check"></i></td>
                </tr>
                <tr>
                  <td>Track Stems</td>
                  <td><i className="fas fa-times"></i></td>
                  <td className="popular"><i className="fas fa-check"></i></td>
                  <td><i className="fas fa-check"></i></td>
                </tr>
                <tr>
                  <td>Sync License (TV/Film)</td>
                  <td><i className="fas fa-times"></i></td>
                  <td className="popular"><i className="fas fa-check"></i></td>
                  <td><i className="fas fa-check"></i></td>
                </tr>
                <tr>
                  <td>Publishing Split</td>
                  <td>50/50</td>
                  <td className="popular">50/50</td>
                  <td>50/50 (negotiable)</td>
                </tr>
                <tr>
                  <td>Credit Required</td>
                  <td>Yes (Mandatory)</td>
                  <td className="popular">Yes (Mandatory)</td>
                  <td>Yes (Mandatory)</td>
                </tr>
                <tr>
                  <td>Master Ownership</td>
                  <td>Producer</td>
                  <td className="popular">Producer</td>
                  <td>Producer</td>
                </tr>
                <tr>
                  <td>Exclusivity</td>
                  <td>Non-Exclusive</td>
                  <td className="popular">Non-Exclusive</td>
                  <td>Exclusive Use</td>
                </tr>
                <tr>
                  <td>License Duration</td>
                  <td>Lifetime</td>
                  <td className="popular">Lifetime</td>
                  <td>Lifetime</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="license-faq">
          <h2>Frequently Asked Questions</h2>
          <div className="faq-grid">
            <div className="faq-item">
              <h4><i className="fas fa-question-circle"></i> What happens if I exceed my stream limit?</h4>
              <p>If your song exceeds the distribution limits of your license, you'll need to upgrade to a higher tier (e.g., Standard to Unlimited). We'll work with you to ensure a smooth transition. Upgrading is always recommended before release if you anticipate significant reach.</p>
            </div>
            <div className="faq-item">
              <h4><i className="fas fa-question-circle"></i> Can I use the beat commercially?</h4>
              <p>Yes! All our licenses (Standard, Unlimited, and Exclusive) allow for commercial use. You can monetize your music on Spotify, Apple Music, YouTube, and other platforms. The only difference is the distribution limits.</p>
            </div>
            <div className="faq-item">
              <h4><i className="fas fa-question-circle"></i> What does "non-exclusive" mean?</h4>
              <p>Non-exclusive means the producer can continue selling the same beat to other artists. Your license is still valid and legal - you're essentially sharing the beat with other artists. Only Exclusive Rights remove the beat from sale.</p>
            </div>
            <div className="faq-item">
              <h4><i className="fas fa-question-circle"></i> Do I need to credit the producer?</h4>
              <p><strong>Yes, credit is MANDATORY on ALL license types.</strong> You must credit "Prod. by Doc Rolds" in the song title, metadata, and all platforms. This applies to all versions including remixes, edits, and live performances. Failure to credit may result in license termination.</p>
            </div>
            <div className="faq-item">
              <h4><i className="fas fa-question-circle"></i> Can I upgrade my license later?</h4>
              <p>Absolutely! If you purchased a Standard Lease and want to upgrade to Unlimited or Exclusive, contact us and we'll work out a fair upgrade price based on what you've already paid.</p>
            </div>
            <div className="faq-item">
              <h4><i className="fas fa-question-circle"></i> What's included in track stems?</h4>
              <p>Track stems are individual audio files for each instrument/element (drums, bass, melody, etc.). This allows you to remix, adjust levels, or use only certain elements. Available with Unlimited Lease and Exclusive Rights.</p>
            </div>
            <div className="faq-item">
              <h4><i className="fas fa-question-circle"></i> Who owns the master rights?</h4>
              <p><strong>The producer (Doc Rolds) retains master rights on ALL license types</strong>, including Exclusive Rights. When you purchase a license, you're buying the right to USE the beat - not ownership of the master recording. Even with Exclusive Rights, you get exclusive USAGE rights, not master ownership.</p>
            </div>
            <div className="faq-item">
              <h4><i className="fas fa-question-circle"></i> What if I don't credit the producer?</h4>
              <p>Credit is mandatory on all licenses. Releasing music without proper producer credit is a breach of the license agreement and may result in: license termination, takedown requests, and potential legal action. Always credit "Prod. by Doc Rolds" in your releases.</p>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="license-footer-note">
          <p>
            <i className="fas fa-shield-alt"></i>
            All licenses are governed by these terms and conditions. By purchasing a license, you agree to abide by all terms stated above. For custom licensing needs or questions, please <Link to="/contact">contact us</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
