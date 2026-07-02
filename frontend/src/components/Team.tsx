import { useEffect, useState, JSX } from 'react';
import { API_URL } from '../config';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

// ============================================================================
// Type Definitions
// ============================================================================

interface TeamMember {
  id: string | number;
  name: string;
  role: string | string[];
  credits?: string | string[];
  description?: string;
  photoData?: string;
  photoFile?: string;
  category?: string;
  displayOnHome?: boolean;
}

// ============================================================================
// Component
// ============================================================================

function Team(): JSX.Element {
  const { ref: sectionRef, isVisible: sectionVisible } = useScrollAnimation<HTMLElement>({ threshold: 0.1 });
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [expandedCards, setExpandedCards] = useState<Set<string | number>>(new Set());
  const cardsPerView = 3;

  useEffect(() => {
    const fetchPhotos = async (): Promise<void> => {
      try {
        const response = await fetch(`${API_URL}/photos`);
        const photos: TeamMember[] = await response.json();
        if (!Array.isArray(photos)) return;
        const teamPhotos = photos.filter(
          (photo: TeamMember) => photo.category === 'team' && photo.displayOnHome === true
        );
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

  const handleNext = (): void => {
    if (currentIndex + cardsPerView < teamMembers.length) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = (): void => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const toggleBio = (memberId: string | number): void => {
    setExpandedCards((prev: Set<string | number>) => {
      const newSet = new Set(prev);
      if (newSet.has(memberId)) {
        newSet.delete(memberId);
      } else {
        newSet.add(memberId);
      }
      return newSet;
    });
  };

  const formatRole = (role: string | string[]): string => {
    try {
      const roles: string[] = typeof role === 'string' ? JSON.parse(role) : (Array.isArray(role) ? role : [role]);
      return roles.map((r: string) => r.charAt(0).toUpperCase() + r.slice(1).toLowerCase()).join(' / ');
    } catch {
      return role && typeof role === 'string'
        ? role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()
        : '';
    }
  };

  const formatCredits = (credits: string | string[]): string => {
    try {
      const parsedCredits = typeof credits === 'string' ? JSON.parse(credits) : credits;
      const creditsArray: string[] = Array.isArray(parsedCredits) ? parsedCredits : [parsedCredits];
      return creditsArray.join(', ');
    } catch {
      return typeof credits === 'string' ? credits : '';
    }
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
          {visibleMembers.map((member: TeamMember) => (
            <div key={member.id} className="team-member">
              <div className="team-member-avatar">
                <img src={member.photoData || member.photoFile} alt={member.name} />
              </div>
              <div className="team-member-name">{member.name}</div>
              <div className="team-member-role">
                {formatRole(member.role)}
              </div>
              {member.credits && (
                <div className="team-member-credits">
                  {formatCredits(member.credits)}
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
