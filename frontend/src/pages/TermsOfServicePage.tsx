import { Link } from 'react-router-dom';

export default function TermsOfServicePage(): JSX.Element {
  return (
    <div className="license-agreement-page">
      <div className="license-agreement-container">
        <div className="license-header">
          <h1>Terms of Service</h1>
          <p>Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        <div className="license-section legal-section">
          <div className="legal-terms">
            <div className="legal-clause">
              <h4>1. Acceptance of Terms</h4>
              <p>These Terms of Service ("Terms") govern your access to and use of docrolds.com (the "Site"), operated by Doc Rolds LLC, a Florida limited liability company ("Doc Rolds," "we," "us," or "our"). By accessing or using the Site, including creating an account, purchasing a beat license, or booking a studio session, you agree to these Terms and our <Link to="/privacy">Privacy Policy</Link>.</p>
            </div>

            <div className="legal-clause">
              <h4>2. Description of Service</h4>
              <p>Doc Rolds sells non-exclusive and exclusive beat licenses and offers music production studio booking (recording, mixing, mastering, and consulting services).</p>
            </div>

            <div className="legal-clause">
              <h4>3. Accounts</h4>
              <p>You may check out as a guest or create an account. If you create an account, you're responsible for keeping your login credentials secure and for all activity under your account. Notify us immediately if you suspect unauthorized access.</p>
            </div>

            <div className="legal-clause">
              <h4>4. Account Deletion</h4>
              <p>You may request deletion of your account at any time by contacting us. We will delete your account and profile information upon request; however, financial and order records may be retained as required by applicable law.</p>
            </div>

            <div className="legal-clause">
              <h4>5. Purchases &amp; Payment</h4>
              <p>All payments are processed securely through Square. Prices are as displayed at checkout at the time of purchase. By completing a purchase, you authorize the charge to your selected payment method.</p>
            </div>

            <div className="legal-clause">
              <h4>6. Beat Licenses</h4>
              <p>Purchased beat licenses are governed by our <Link to="/licenses">License Agreement</Link>, which sets out usage rights, distribution limits, credit requirements, and other terms specific to each license tier. Please review it before purchasing.</p>
            </div>

            <div className="legal-clause">
              <h4>7. Studio Bookings</h4>
              <p>Studio session bookings require a deposit to confirm the reservation. Cancellation, rescheduling, and balance-payment terms are provided in your booking confirmation email at the time of booking.</p>
            </div>

            <div className="legal-clause">
              <h4>8. Community Guidelines</h4>
              <p>Beat comments are public and visible to other users. Comments must not contain harassment, hate speech, spam, or impersonation. We may remove any comment that violates these guidelines, and you may report a comment you believe is in violation using the report option available on the Site.</p>
            </div>

            <div className="legal-clause">
              <h4>9. Prohibited Conduct</h4>
              <p>You agree not to:</p>
              <ul>
                <li>Use the Site for any unlawful purpose or in violation of these terms</li>
                <li>Attempt to gain unauthorized access to any part of the Site or its systems</li>
                <li>Interfere with or disrupt the Site's operation</li>
                <li>Use purchased beats or booked services in violation of the applicable License Agreement</li>
                <li>Scrape, crawl, or bulk-download Site content or catalog data through automated means</li>
                <li>Use Site content to train, fine-tune, or build AI or machine learning models without our express written consent</li>
                <li>Impersonate Doc Rolds, another user, or any person or entity</li>
                <li>Use the Site, its content, or its design to build or operate a competing product or service</li>
              </ul>
            </div>

            <div className="legal-clause">
              <h4>10. Intellectual Property</h4>
              <p>All content on the Site - including beats, artwork, branding, and site design - is owned by Doc Rolds or its licensors and is protected by copyright and other intellectual property laws, except as expressly licensed to you under the License Agreement.</p>
            </div>

            <div className="legal-clause">
              <h4>11. Disclaimer of Warranties</h4>
              <p>The Site and its services are provided "as is" without warranties of any kind, express or implied, to the fullest extent permitted by law.</p>
            </div>

            <div className="legal-clause">
              <h4>12. Limitation of Liability</h4>
              <p>To the fullest extent permitted by law, Doc Rolds shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Site or its services. In no event shall Doc Rolds' total liability to you for any claim arising from your use of the Site exceed the amount you paid for the applicable order or booking giving rise to the claim.</p>
            </div>

            <div className="legal-clause">
              <h4>13. Termination</h4>
              <p>We may suspend or terminate your account at any time, without notice, for violation of these Terms, including the Prohibited Conduct clause above. You may terminate your account at any time by contacting us.</p>
            </div>

            <div className="legal-clause">
              <h4>14. Governing Law</h4>
              <p>These terms are governed by the laws of the State of Florida, without regard to its conflict-of-law principles.</p>
            </div>

            <div className="legal-clause">
              <h4>15. Miscellaneous</h4>
              <p>These Terms, together with the License Agreement and Privacy Policy, constitute the entire agreement between you and Doc Rolds regarding the Site. Our failure to enforce any provision of these Terms is not a waiver of that provision. You may not assign these Terms without our consent; Doc Rolds may assign these Terms freely, including in connection with a merger, acquisition, or sale of assets.</p>
            </div>

            <div className="legal-clause">
              <h4>16. Changes to These Terms</h4>
              <p>We may update these terms from time to time. Continued use of the Site after changes take effect constitutes acceptance of the revised terms.</p>
            </div>

            <div className="legal-clause">
              <h4>17. Contact Us</h4>
              <p>Questions about these terms? <Link to="/contact">Contact us</Link> or reach out at <a href="mailto:info@docrolds.com" style={{ color: '#E83628' }}>info@docrolds.com</a>.</p>
            </div>
          </div>
        </div>

        <div className="license-cta">
          <Link to="/" className="cta-button primary">
            <i className="fas fa-home"></i>
            Back to Home
          </Link>
          <Link to="/privacy" className="cta-button secondary">
            <i className="fas fa-user-shield"></i>
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
