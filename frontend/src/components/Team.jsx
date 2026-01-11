import { useEffect, useState } from 'react';
import { API_URL } from '../config.js';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

function Team() {
  const { ref: sectionRef, isVisible: sectionVisible } = useScrollAnimation({ threshold: 0.1 });
  const [teamMembers, setTeamMembers] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expandedCards, setExpandedCards] = useState(new Set());
  const cardsPerView = 3;

  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        const response = await fetch(`${API_URL}/photos`);
        const photos = await response.json();
        if (!Array.isArray(photos)) return;
        const teamPhotos = photos.filter(photo => photo.category === 'team' && photo.displayOnHome === true);
        if (teamPhotos.length > 0) {
          setTeamMembers(teamPhotos);
          setCurrentIndex(0);
        }
      } catch (error) {
        console.error('Failed to fetch team photos:', error);
      }
    };

    fetchPhotos();
  }, []);

  const handleNext = () => {
    if (currentIndex + cardsPerView < teamMembers.length) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const toggleBio = (memberId) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(memberId)) {
        newSet.delete(memberId);
      } else {
        newSet.add(memberId);
      }
      return newSet;
    });
  };

  const visibleMembers = teamMembers.slice(currentIndex, currentIndex + cardsPerView);

  return (
    <section id="team" ref={sectionRef} className="team-carousel-section">
      <h2 className={`section-title animate-on-scroll fade-up ${sectionVisible ? 'visible' : ''}`}>Meet the Team</h2>
      <div
        className={`team-carousel-wrapper animate-on-scroll fade-up ${sectionVisible ? 'visible' : ''}`}
        style={{ transitionDelay: '150ms' }}
      >
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className={`team-carousel-btn ${currentIndex === 0 ? 'disabled' : ''}`}
          aria-label="Previous"
        >
          ❮
        </button>

        <div className="team-carousel-grid">
          {visibleMembers.map((member) => (
            <div key={member.id} className="team-member">
              <div className="team-member-avatar">
                <img src={member.photoData || member.photoFile} alt={member.name} />
              </div>
              <div className="team-member-name">{member.name}</div>
              <div className="team-member-role">
                {(() => {
                  try {
                    const roles = typeof member.role === 'string' ? JSON.parse(member.role) : (Array.isArray(member.role) ? member.role : [member.role]);
                    return roles.map(role => role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()).join(' / ');
                  } catch {
                    return member.role && member.role.charAt(0).toUpperCase() + member.role.slice(1).toLowerCase();
                  }
                })()}
              </div>
              {member.credits && (
                <div className="team-member-credits">
                  {(() => {
                    try {
                      const credits = typeof member.credits === 'string' ? JSON.parse(member.credits) : member.credits;
                      const creditsArray = Array.isArray(credits) ? credits : [credits];
                      return creditsArray.join(', ');
                    } catch {
                      return member.credits;
                    }
                  })()}
                </div>
              )}
              {member.description && (
                <div className="team-member-bio-wrapper">
                  <button
                    onClick={() => toggleBio(member.id)}
                    className={`team-bio-toggle ${expandedCards.has(member.id) ? 'expanded' : ''}`}
                  >
                    ▼
                  </button>
                  {expandedCards.has(member.id) && (
                    <div className="team-member-bio">{member.description}</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={handleNext}
          disabled={currentIndex + cardsPerView >= teamMembers.length}
          className={`team-carousel-btn ${currentIndex + cardsPerView >= teamMembers.length ? 'disabled' : ''}`}
          aria-label="Next"
        >
          ❯
        </button>
      </div>
    </section>
  );
}

export default Team;
