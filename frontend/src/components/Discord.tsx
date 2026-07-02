import { useState, useEffect, JSX, ChangeEvent } from 'react';
import { API_URL } from '../config';
import { useScrollAnimation, useStaggerAnimation } from '../hooks/useScrollAnimation';

// ============================================================================
// Type Definitions
// ============================================================================

interface DiscordStats {
  activeMembers: string;
  support: string;
}

interface DiscordContent {
  description: string;
  discordLink: string;
  stats: DiscordStats;
}

interface DiscordChannel {
  icon: string;
  title: string;
  desc: string;
}

interface ContentApiResponse {
  discord?: DiscordContent;
  [key: string]: unknown;
}

// ============================================================================
// Component
// ============================================================================

function Discord(): JSX.Element {
  const { ref: sectionRef, isVisible: sectionVisible } = useScrollAnimation<HTMLElement>({ threshold: 0.1 });
  const { containerRef: statsRef, isVisible: statsVisible } = useStaggerAnimation<HTMLDivElement>({ threshold: 0.2 });
  const { containerRef: channelsRef, isVisible: channelsVisible } = useStaggerAnimation<HTMLDivElement>({ threshold: 0.1 });
  const [discordContent, setDiscordContent] = useState<DiscordContent>({
    description: 'Connect with the Doc Rolds community and unlock exclusive opportunities. Get early access to beats, direct support, and collaborate with producers worldwide.',
    discordLink: 'https://discord.gg',
    stats: { activeMembers: '500+', support: '24/7' }
  });
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<DiscordContent>({ ...discordContent });

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    setIsAdmin(!!token);

    fetch(`${API_URL}/content`)
      .then((res: Response) => res.json())
      .then((data: ContentApiResponse) => {
        if (data?.discord) {
          setDiscordContent(data.discord);
          setEditForm(data.discord);
        }
      })
      .catch((err: Error) => console.error('Failed to fetch discord content:', err));
  }, []);

  const handleEditClick = (): void => {
    setEditMode(true);
    setEditForm({ ...discordContent });
  };

  const handleSave = async (): Promise<void> => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(`${API_URL}/content/discord`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editForm)
      });

      if (response.ok) {
        const updated: DiscordContent = await response.json();
        setDiscordContent(updated);
        setEditMode(false);
      }
    } catch (error) {
      console.error('Failed to save discord content:', error);
      alert('Failed to save changes');
    }
  };

  const channels: DiscordChannel[] = [
    { icon: '🎵', title: 'Exclusive Beats', desc: 'First access to new beats and exclusive drops' },
    { icon: '🎧', title: 'Live Sessions', desc: 'Live studio sessions for mixing and mastering' },
    { icon: '👤', title: '1 on 1 Feedback', desc: 'Direct one-on-one sessions with Doc Rolds' },
    { icon: '🤝', title: 'Collabs', desc: 'Collaborate with producers worldwide' },
    { icon: '🛠️', title: 'Drumkits & Presets', desc: 'Exclusive drumkits, presets and templates' },
    { icon: '📚', title: 'Lessons', desc: 'Production tips, tutorials & masterclasses' }
  ];

  const perks: string[] = [
    'Early access to new beats & services before release',
    'Direct messaging with Doc Rolds for feedback',
    'Exclusive beat packs & member-only discounts',
    'Community challenges & contests with prizes',
    'Live production streams & monthly Q&A sessions'
  ];

  return (
    <section id="discord" ref={sectionRef} className="discord-section">
      {isAdmin && !editMode && (
        <button onClick={handleEditClick} className="admin-edit-btn" aria-label="Edit Discord section">
          <span aria-hidden="true">✏️</span>
        </button>
      )}

      <h2 className={`section-title animate-on-scroll fade-up ${sectionVisible ? 'visible' : ''}`}>Join Our Discord Community</h2>
      <div className="discord-container">
        {editMode ? (
          <div style={{ background: 'rgba(26, 31, 38, 0.9)', padding: '2rem', borderRadius: '8px', marginBottom: '2rem' }}>
            <h3 style={{ color: '#fff', marginBottom: '1.5rem' }}>Edit Discord Section</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Description</label>
              <textarea
                value={editForm.description}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setEditForm({ ...editForm, description: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#0f1419',
                  border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
                  borderRadius: '6px',
                  color: '#e0e0e0',
                  minHeight: '100px',
                  resize: 'vertical'
                }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Discord Link</label>
              <input
                type="text"
                value={editForm.discordLink}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, discordLink: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#0f1419',
                  border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
                  borderRadius: '6px',
                  color: '#e0e0e0'
                }}
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Active Members</label>
              <input
                type="text"
                value={editForm.stats.activeMembers}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEditForm({ ...editForm, stats: { ...editForm.stats, activeMembers: e.target.value } })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#0f1419',
                  border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
                  borderRadius: '6px',
                  color: '#e0e0e0'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={handleSave}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: 'var(--primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Save
              </button>
              <button
                onClick={() => setEditMode(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#e0e0e0',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="discord-description">{discordContent.description}</p>
        )}

        <div ref={statsRef} className="discord-stats stagger-children">
          <div className={`discord-stat-card animate-on-scroll fade-up ${statsVisible ? 'visible' : ''}`}>
            <div className="discord-stat-number">{discordContent.stats?.activeMembers || '500+'}</div>
            <div className="discord-stat-label">Active Members</div>
          </div>
          <div className={`discord-stat-card animate-on-scroll fade-up ${statsVisible ? 'visible' : ''}`} style={{ transitionDelay: '100ms' }}>
            <div className="discord-stat-number">{discordContent.stats?.support || '24/7'}</div>
            <div className="discord-stat-label">Community Support</div>
          </div>
        </div>

        <div>
          <h3 className="discord-channels-title">Featured Channels</h3>
          <div ref={channelsRef} className="discord-channels stagger-children">
            {channels.map((channel: DiscordChannel, index: number) => (
              <div
                key={index}
                className={`discord-channel animate-on-scroll fade-up ${channelsVisible ? 'visible' : ''}`}
                style={{ transitionDelay: `${index * 75}ms` }}
              >
                <div className="discord-channel-title">{channel.icon} {channel.title}</div>
                <div className="discord-channel-desc">{channel.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="discord-perks-title">Member Perks</h3>
          <ul className="discord-perks">
            {perks.map((perk: string, index: number) => (
              <li key={index} className="discord-perk">{perk}</li>
            ))}
          </ul>
        </div>

        <div className="discord-cta">
          <a
            href={discordContent.discordLink || 'https://discord.gg'}
            target="_blank"
            rel="noopener noreferrer"
            className="discord-join-btn"
            aria-label="Join Doc Rolds Discord community (opens in new tab)"
          >
            <i className="fab fa-discord" aria-hidden="true"></i>
            Join Discord
          </a>
        </div>
      </div>
    </section>
  );
}

export default Discord;
