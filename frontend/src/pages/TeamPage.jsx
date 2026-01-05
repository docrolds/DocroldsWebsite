import { useState, useEffect } from 'react';
import { API_URL } from '../config.js';

function TeamPage() {
  const [teamMembers, setTeamMembers] = useState([]);
  const [expandedBios, setExpandedBios] = useState(new Set());

  useEffect(() => {
    // Fetch team members from API
    fetch(`${API_URL}/team`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          setTeamMembers(data);
        }
      })
      .catch(err => {
        console.error('Failed to fetch team members:', err);
      });
  }, []);

  const toggleBio = (id) => {
    setExpandedBios(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <div className="page-container">
      <section className="team-section">
        <h1 className="page-title">Meet The Team</h1>
        <p className="page-subtitle">The creative minds behind Doc Rolds Productions</p>

        {teamMembers.length > 0 ? (
          <div className="team-grid">
            {teamMembers.map((member) => {
              // Parse roles
              let roles = [];
              if (typeof member.role === 'string') {
                try { roles = JSON.parse(member.role); } catch { roles = [member.role]; }
              } else if (Array.isArray(member.role)) {
                roles = member.role;
              }
              const roleDisplay = roles.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(' / ');

              // Parse credits
              let credits = [];
              if (typeof member.credits === 'string') {
                try { credits = JSON.parse(member.credits); } catch { credits = []; }
              } else if (Array.isArray(member.credits)) {
                credits = member.credits;
              }

              // Parse placements
              let placements = [];
              if (typeof member.placements === 'string') {
                try { placements = JSON.parse(member.placements); } catch { placements = []; }
              } else if (Array.isArray(member.placements)) {
                placements = member.placements;
              }

              // Get photo source - prioritize photoData (base64)
              const photoSrc = member.photoData || (member.photoUrl ? (member.photoUrl.startsWith('http') ? member.photoUrl : `${API_URL.replace('/api', '')}/${member.photoUrl}`) : null);

              return (
                <div key={member.id} className="team-card">
                  {/* Photo */}
                  <div className="team-photo-wrapper">
                    {photoSrc ? (
                      <img src={photoSrc} alt={member.name} className="team-photo" />
                    ) : (
                      <div className="team-photo-placeholder">
                        <i className="fas fa-user"></i>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="team-info">
                    <h3 className="team-name">{member.name}</h3>
                    <div className="team-role">{roleDisplay}</div>

                    {/* Credits */}
                    {credits.length > 0 && (
                      <div className="team-credits" style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem', justifyContent: 'center' }}>
                        {credits.map((credit, i) => (
                          <span key={i} style={{ background: 'rgba(232,54,40,0.2)', color: '#E83628', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>{credit}</span>
                        ))}
                      </div>
                    )}

                    {/* Placements */}
                    {placements.length > 0 && (
                      <div className="team-placements" style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#aaa' }}>
                        <strong>Placements:</strong> {placements.join(', ')}
                      </div>
                    )}

                    <div className={`team-bio ${expandedBios.has(member.id) ? 'expanded' : ''}`}>
                      {member.bio}
                    </div>

                    {member.bio && member.bio.length > 150 && (
                      <button
                        className="bio-toggle"
                        onClick={() => toggleBio(member.id)}
                      >
                        {expandedBios.has(member.id) ? 'Show Less' : 'Read More'}
                        <i className={`fas fa-chevron-${expandedBios.has(member.id) ? 'up' : 'down'}`}></i>
                      </button>
                    )}
                  </div>

                  {/* Social Links (if available) */}
                  {member.socials && (
                    <div className="team-socials">
                      {member.socials.instagram && (
                        <a href={member.socials.instagram} target="_blank" rel="noopener noreferrer">
                          <i className="fab fa-instagram"></i>
                        </a>
                      )}
                      {member.socials.spotify && (
                        <a href={member.socials.spotify} target="_blank" rel="noopener noreferrer">
                          <i className="fab fa-spotify"></i>
                        </a>
                      )}
                      {member.socials.soundcloud && (
                        <a href={member.socials.soundcloud} target="_blank" rel="noopener noreferrer">
                          <i className="fab fa-soundcloud"></i>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="team-empty">
            <div className="team-empty-icon">
              <i className="fas fa-users"></i>
            </div>
            <h3>Team Coming Soon</h3>
            <p>We're working on adding our amazing team members. Check back soon!</p>
          </div>
        )}

        {/* Join the Team CTA */}
        <div className="join-team-section">
          <h3>Interested in Joining the Team?</h3>
          <p>We're always looking for talented producers and engineers to collaborate with.</p>
          <a href="/contact" className="join-team-btn">
            Get in Touch
          </a>
        </div>
      </section>
    </div>
  );
}

export default TeamPage;
