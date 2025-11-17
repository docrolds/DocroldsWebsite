import { useState, useEffect } from 'react';

function Sessions() {
  const [sessions, setSessions] = useState([
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
  ]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editForm, setEditForm] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    setIsAdmin(!!token);
  }, []);

  const handleSessionBook = (sessionType) => {
    alert(`Booking ${sessionType} session - functionality to be implemented`);
  };

  const handleEditSession = (index) => {
    setEditingIndex(index);
    setEditForm({ ...sessions[index] });
  };

  const handleSaveSession = () => {
    if (editForm && editingIndex !== null) {
      const updatedSessions = [...sessions];
      updatedSessions[editingIndex] = editForm;
      setSessions(updatedSessions);
      setEditingIndex(null);
      setEditForm(null);
    }
  };

  return (
    <section id="sessions">
      <h2 className="section-title">Book Your Session</h2>
      <div className="sessions-container">
        {sessions.map((session, index) => (
          <div key={index} className="session-card">
            <div className="session-type">{session.type}</div>
            <div className="session-price">{session.price}</div>
            <div className="session-duration">{session.duration}</div>
            <ul className="session-features">
              {session.features.map((feature, idx) => (
                <li key={idx}>{feature}</li>
              ))}
            </ul>
            <button 
              className="book-session-btn" 
              onClick={() => handleSessionBook(session.type)}
            >
              {session.type.includes('Business') ? 'Book Consultation' : 'Book Session'}
            </button>
          </div>
        ))}
      </div>

      <div className="comparison-table">
        <table>
          <thead>
            <tr>
              <th>Features</th>
              <th className="package-name">Starter</th>
              <th className="package-name">Professional</th>
              <th className="package-name">Premium</th>
              <th className="package-name">Business</th>
            </tr>
            <tr>
              <td></td>
              <td className="package-price">$80/Hr</td>
              <td className="package-price">$150</td>
              <td className="package-price">$300</td>
              <td className="package-price">$750</td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Professional Studio Recording</td>
              <td><span className="check">✓</span></td>
              <td><span className="check">✓</span></td>
              <td><span className="check">✓</span></td>
              <td><span className="x">—</span></td>
            </tr>
            <tr>
              <td>Initial Mix</td>
              <td><span className="check">✓</span></td>
              <td><span className="check">✓</span></td>
              <td><span className="x">—</span></td>
              <td><span className="x">—</span></td>
            </tr>
            <tr>
              <td>Full Mix</td>
              <td><span className="x">—</span></td>
              <td><span className="x">—</span></td>
              <td><span className="check">✓</span></td>
              <td><span className="x">—</span></td>
            </tr>
            <tr>
              <td>Studio Master</td>
              <td><span className="check">✓</span></td>
              <td><span className="check">✓</span></td>
              <td><span className="check">✓</span></td>
              <td><span className="x">—</span></td>
            </tr>
            <tr>
              <td>Beat Selection from Catalog</td>
              <td><span className="x">—</span></td>
              <td><span className="check">✓</span></td>
              <td><span className="check">✓</span></td>
              <td><span className="x">—</span></td>
            </tr>
            <tr>
              <td>Clean Version</td>
              <td><span className="x">—</span></td>
              <td><span className="check">✓</span></td>
              <td><span className="check">✓</span></td>
              <td><span className="x">—</span></td>
            </tr>
            <tr>
              <td>Stems</td>
              <td><span className="x">—</span></td>
              <td><span className="x">—</span></td>
              <td><span className="check">✓</span></td>
              <td><span className="x">—</span></td>
            </tr>
            <tr>
              <td>MP3 & WAV Formats</td>
              <td><span className="check">✓</span></td>
              <td><span className="check">✓</span></td>
              <td><span className="check">✓</span></td>
              <td><span className="x">—</span></td>
            </tr>
            <tr>
              <td>Revisions Included</td>
              <td><span className="x">—</span></td>
              <td>1-2<span className="check">✓</span></td>
              <td>3-5<span className="check">✓</span></td>
              <td><span className="x">—</span></td>
            </tr>
            <tr>
              <td>Copyright Registration Guidance</td>
              <td><span className="x">—</span></td>
              <td><span className="x">—</span></td>
              <td><span className="x">—</span></td>
              <td><span className="check">✓</span></td>
            </tr>
            <tr>
              <td>LLC Formation & Tax ID/EIN</td>
              <td><span className="x">—</span></td>
              <td><span className="x">—</span></td>
              <td><span className="x">—</span></td>
              <td><span className="check">✓</span></td>
            </tr>
            <tr>
              <td>Distribution & PRO Setup</td>
              <td><span className="x">—</span></td>
              <td><span className="x">—</span></td>
              <td><span className="x">—</span></td>
              <td><span className="check">✓</span></td>
            </tr>
            <tr>
              <td>MLC & SoundExchange Setup</td>
              <td><span className="x">—</span></td>
              <td><span className="x">—</span></td>
              <td><span className="x">—</span></td>
              <td><span className="check">✓</span></td>
            </tr>
            <tr>
              <td>Ongoing Email Support</td>
              <td><span className="x">—</span></td>
              <td><span className="x">—</span></td>
              <td><span className="x">—</span></td>
              <td><span className="check">✓</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default Sessions;
