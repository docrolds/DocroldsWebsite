import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
    <div className="team-page-v2">
      {/* Hero Section */}
      <section className="team-hero-v2">
        <div className="team-hero-bg-v2"></div>
        <div className="team-hero-content-v2">
          <h1>The Team</h1>
          <p>The producers, engineers, and creatives shaping the sound</p>
        </div>
      </section>

      <section className="team-section">
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
                      <img src={photoSrc} alt={`${member.name} - ${roleDisplay}`} className="team-photo" />
                    ) : (
                      <div className="team-photo-placeholder" aria-label={`No photo available for ${member.name}`}>
                        <i className="fas fa-user" aria-hidden="true"></i>
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
                        aria-expanded={expandedBios.has(member.id)}
                        aria-label={expandedBios.has(member.id) ? `Show less about ${member.name}` : `Read more about ${member.name}`}
                      >
                        {expandedBios.has(member.id) ? 'Show Less' : 'Read More'}
                        <i className={`fas fa-chevron-${expandedBios.has(member.id) ? 'up' : 'down'}`} aria-hidden="true"></i>
                      </button>
                    )}
                  </div>

                  {/* Social Links (if available) */}
                  {member.socials && (
                    <div className="team-socials">
                      {member.socials.instagram && (
                        <a href={member.socials.instagram} target="_blank" rel="noopener noreferrer" aria-label={`Follow ${member.name} on Instagram (opens in new tab)`}>
                          <i className="fab fa-instagram" aria-hidden="true"></i>
                        </a>
                      )}
                      {member.socials.spotify && (
                        <a href={member.socials.spotify} target="_blank" rel="noopener noreferrer" aria-label={`Listen to ${member.name} on Spotify (opens in new tab)`}>
                          <i className="fab fa-spotify" aria-hidden="true"></i>
                        </a>
                      )}
                      {member.socials.soundcloud && (
                        <a href={member.socials.soundcloud} target="_blank" rel="noopener noreferrer" aria-label={`Listen to ${member.name} on SoundCloud (opens in new tab)`}>
                          <i className="fab fa-soundcloud" aria-hidden="true"></i>
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
            <div className="team-empty-icon" aria-hidden="true">
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
          <Link to="/contact" className="join-team-btn">
            Get in Touch
          </Link>
        </div>
      </section>
    </div>
  );
}

export default TeamPage;
