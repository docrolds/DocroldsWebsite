import { Link } from 'react-router-dom';

export default function PrivacyPolicyPage(): JSX.Element {
  return (
    <div className="license-agreement-page">
      <div className="license-agreement-container">
        <div className="license-header">
          <h1>Privacy Policy</h1>
          <p>Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        <div className="license-section legal-section">
          <div className="legal-terms">
            <div className="legal-clause">
              <h4>1. Who We Are</h4>
              <p>Doc Rolds ("we," "us," "our") operates docrolds.com, a beat-selling and music production studio booking website. This policy explains what information we collect, how we use it, and the choices you have.</p>
            </div>

            <div className="legal-clause">
              <h4>2. Information We Collect</h4>
              <p>We collect information you provide directly:</p>
              <ul>
                <li>Account information: name, email, phone number, and (optionally) stage name, city, and state if you create an account</li>
                <li>Order and booking details: what you purchase or book, and contact details needed to fulfill it</li>
                <li>Payment information: your card details are entered directly into Square's secure payment form and processed by Square - we never see or store your full card number</li>
                <li>Communications: messages you send us via the contact form or email</li>
              </ul>
            </div>

            <div className="legal-clause">
              <h4>3. How We Use Your Information</h4>
              <p>We use the information we collect to:</p>
              <ul>
                <li>Process orders and studio bookings, and deliver purchased files</li>
                <li>Send transactional emails (order confirmations, download links, booking confirmations and reminders, password resets)</li>
                <li>Respond to support and contact requests</li>
                <li>Maintain the security of accounts and prevent fraud</li>
              </ul>
              <p>We do not sell your personal information to third parties.</p>
            </div>

            <div className="legal-clause">
              <h4>4. Third-Party Services</h4>
              <p>We rely on the following third-party services to operate the site:</p>
              <ul>
                <li><strong>Square</strong> - processes all payments. Square's own privacy policy governs how they handle your payment information.</li>
                <li><strong>Brevo</strong> - sends transactional emails (order/booking confirmations, reminders, password resets) on our behalf.</li>
                <li>Our hosting providers, who process data as necessary to run the site and store order/account records.</li>
              </ul>
            </div>

            <div className="legal-clause">
              <h4>5. Cookies &amp; Local Storage</h4>
              <p>We use your browser's local storage (not tracking cookies) to keep your cart contents and keep you signed in between visits. This data stays on your device and is not used for advertising or cross-site tracking.</p>
            </div>

            <div className="legal-clause">
              <h4>6. Data Retention</h4>
              <p>We retain order, booking, and account information for as long as your account is active or as needed to provide services, comply with legal obligations, resolve disputes, and enforce our agreements.</p>
            </div>

            <div className="legal-clause">
              <h4>7. Data Security</h4>
              <p>We implement reasonable administrative, technical, and physical safeguards designed to protect your information. However, no method of transmission over the internet or electronic storage is completely secure, and we cannot guarantee absolute security.</p>
            </div>

            <div className="legal-clause">
              <h4>8. Your Rights</h4>
              <p>You can review and update your account information from your dashboard at any time. To request deletion of your account or personal data, or to ask any question about how your information is used, contact us using the details below.</p>
            </div>

            <div className="legal-clause">
              <h4>9. Children's Privacy</h4>
              <p>Our services are not directed to individuals under 13, and we do not knowingly collect personal information from children under 13.</p>
            </div>

            <div className="legal-clause">
              <h4>10. Changes to This Policy</h4>
              <p>We may update this policy from time to time. Material changes will be reflected by an updated "last updated" date above.</p>
            </div>

            <div className="legal-clause">
              <h4>11. Contact Us</h4>
              <p>Questions about this policy? <Link to="/contact">Contact us</Link> or reach out at <a href="mailto:info@docrolds.com" style={{ color: '#E83628' }}>info@docrolds.com</a>.</p>
            </div>
          </div>
        </div>

        <div className="license-cta">
          <Link to="/" className="cta-button primary">
            <i className="fas fa-home"></i>
            Back to Home
          </Link>
          <Link to="/terms" className="cta-button secondary">
            <i className="fas fa-file-contract"></i>
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
