import { useEffect, useState } from 'react';

function Team() {
  const [teamMembers, setTeamMembers] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expandedCards, setExpandedCards] = useState(new Set());
  const cardsPerView = 3;

  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/photos');
        const photos = await response.json();
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
    <section id="team" style={{maxWidth: '1200px', margin: '4rem auto'}}>
      <h2 className="section-title">Meet the Team</h2>
      <div style={{position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2rem'}}>
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          style={{
            background: currentIndex === 0 ? 'rgba(230, 54, 40, 0.3)' : 'rgba(232, 54, 40, 0.6)',
            color: 'white',
            border: '2px solid rgba(232, 54, 40, 0.5)',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            minWidth: '40px',
            cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
            fontSize: '1.2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s cubic-bezier(0.23, 1, 0.320, 1)',
            opacity: currentIndex === 0 ? 0.5 : 1
          }}
          onMouseEnter={(e) => currentIndex !== 0 && (e.target.style.background = '#E83628')}
          onMouseLeave={(e) => (e.target.style.background = currentIndex === 0 ? 'rgba(230, 54, 40, 0.3)' : 'rgba(232, 54, 40, 0.6)')}
        >
          ❮
        </button>

        <div className="team-container" style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', maxWidth: '1000px', width: '100%', justifyItems: 'center'}}>
          {visibleMembers.map((member) => (
            <div key={member.id} className="team-member" style={{background: 'rgba(26, 26, 26, 0.8)', border: '1px solid rgba(232, 54, 40, 0.2)', width: '100%', maxWidth: '280px'}}>
              <div className="team-member-avatar">
                <img src={member.photoFile} alt={member.name} style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%'}} />
              </div>
              <div className="team-member-name">{member.name}</div>
              <div className="team-member-role" style={{fontSize: '0.9rem'}}>
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
                <div style={{marginTop: '8px', textAlign: 'center', fontSize: '0.85rem', color: '#ccc'}}>
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
                <div>
                  <button
                    onClick={() => toggleBio(member.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#E83628',
                      cursor: 'pointer',
                      fontSize: '1.2rem',
                      padding: '8px',
                      marginTop: '8px',
                      transition: 'transform 0.3s ease',
                      transform: expandedCards.has(member.id) ? 'rotate(180deg)' : 'rotate(0deg)'
                    }}
                  >
                    ▼
                  </button>
                  {expandedCards.has(member.id) && (
                    <div className="team-member-bio" style={{marginTop: '8px'}}>
                      {member.description}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={handleNext}
          disabled={currentIndex + cardsPerView >= teamMembers.length}
          style={{
            background: currentIndex + cardsPerView >= teamMembers.length ? 'rgba(230, 54, 40, 0.3)' : 'rgba(232, 54, 40, 0.6)',
            color: 'white',
            border: '2px solid rgba(232, 54, 40, 0.5)',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            minWidth: '40px',
            cursor: currentIndex + cardsPerView >= teamMembers.length ? 'not-allowed' : 'pointer',
            fontSize: '1.2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s cubic-bezier(0.23, 1, 0.320, 1)',
            opacity: currentIndex + cardsPerView >= teamMembers.length ? 0.5 : 1
          }}
          onMouseEnter={(e) => currentIndex + cardsPerView < teamMembers.length && (e.target.style.background = '#E83628')}
          onMouseLeave={(e) => (e.target.style.background = currentIndex + cardsPerView >= teamMembers.length ? 'rgba(230, 54, 40, 0.3)' : 'rgba(232, 54, 40, 0.6)')}
        >
          ❯
        </button>
      </div>
    </section>
  );
}

export default Team;
