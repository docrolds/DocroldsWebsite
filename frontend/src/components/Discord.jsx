import { useState, useEffect } from 'react';

function Discord() {
  const [discordContent, setDiscordContent] = useState({
    description: 'Connect with the Doc Rolds community and unlock exclusive opportunities. Get early access to beats, direct support, and collaborate with producers worldwide.',
    discordLink: 'https://discord.gg',
    stats: { activeMembers: '500+', support: '24/7' }
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ ...discordContent });

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    setIsAdmin(!!token);
    
    fetch('https://docrolds-api.onrender.com/api/content')
      .then(res => res.json())
      .then(data => {
        setDiscordContent(data.discord);
        setEditForm(data.discord);
      })
      .catch(err => console.error('Failed to fetch discord content:', err));
  }, []);

  const handleEditClick = () => {
    setEditMode(true);
    setEditForm({ ...discordContent });
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('https://docrolds-api.onrender.com/api/content/discord', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editForm)
      });

      if (response.ok) {
        const updated = await response.json();
        setDiscordContent(updated);
        setEditMode(false);
      }
    } catch (error) {
      console.error('Failed to save discord content:', error);
      alert('Failed to save changes');
    }
  };

  return (
    <section id="discord" style={{ margin: '4rem 0', position: 'relative' }}>
      {isAdmin && !editMode && (
        <button
          onClick={handleEditClick}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: '#E83628',
            color: 'white',
            border: 'none',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: '1.2rem',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ✏️
        </button>
      )}
      
      <h2 className="section-title">Join Our Discord Community</h2>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 2rem' }}>
        {editMode ? (
          <div style={{ background: 'rgba(26, 31, 38, 0.9)', padding: '2rem', borderRadius: '8px', marginBottom: '2rem' }}>
            <h3 style={{ color: '#fff', marginBottom: '1.5rem' }}>Edit Discord Section</h3>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Description</label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#0f1419',
                  border: '1px solid rgba(232, 54, 40, 0.3)',
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
                onChange={(e) => setEditForm({ ...editForm, discordLink: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#0f1419',
                  border: '1px solid rgba(232, 54, 40, 0.3)',
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
                onChange={(e) => setEditForm({ ...editForm, stats: { ...editForm.stats, activeMembers: e.target.value } })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#0f1419',
                  border: '1px solid rgba(232, 54, 40, 0.3)',
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
                  background: '#E83628',
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
          <p style={{ textAlign: 'center', color: '#aaa', fontSize: '1rem', marginBottom: '3rem', lineHeight: '1.8' }}>
            {discordContent.description}
          </p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem', marginBottom: '3rem' }}>
          <div style={{ background: 'rgba(232, 54, 40, 0.1)', padding: '2rem', borderRadius: '8px', border: '1px solid rgba(232, 54, 40, 0.2)', textAlign: 'center' }}>
            <div style={{ background: 'linear-gradient(135deg, #E83628, #ff6b47)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>500+</div>
            <div style={{ color: '#aaa', fontSize: '0.95rem' }}>Active Members</div>
          </div>
          <div style={{ background: 'rgba(232, 54, 40, 0.1)', padding: '2rem', borderRadius: '8px', border: '1px solid rgba(232, 54, 40, 0.2)', textAlign: 'center' }}>
            <div style={{ background: 'linear-gradient(135deg, #E83628, #ff6b47)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>24/7</div>
            <div style={{ color: '#aaa', fontSize: '0.95rem' }}>Community Support</div>
          </div>
        </div>

        <div style={{ marginBottom: '3rem' }}>
          <h3 style={{ color: '#E83628', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1.5rem', textAlign: 'center' }}>Featured Channels</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
            {[
              { icon: '🎵', title: 'Exclusive Beats', desc: 'First access to new beats and exclusive drops' },
              { icon: '🎧', title: 'Live Sessions', desc: 'Live studio sessions for mixing and mastering' },
              { icon: '👤', title: '1 on 1 Feedback', desc: 'Direct one-on-one sessions with Doc Rolds' },
              { icon: '🤝', title: 'Collabs', desc: 'Collaborate with producers worldwide' },
              { icon: '🛠️', title: 'Drumkits & Presets', desc: 'Exclusive drumkits, presets and templates' },
              { icon: '📚', title: 'Lessons', desc: 'Production tips, tutorials & masterclasses' }
            ].map((channel, index) => (
              <div key={index} style={{ background: 'rgba(232, 54, 40, 0.05)', padding: '1.5rem', borderRadius: '8px', borderLeft: '4px solid #E83628' }}>
                <div style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem' }}>{channel.icon} {channel.title}</div>
                <div style={{ color: '#999', fontSize: '0.9rem' }}>{channel.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '3rem' }}>
          <h3 style={{ color: '#E83628', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1.5rem', textAlign: 'center' }}>Member Perks</h3>
          <ul style={{ listStyle: 'none', maxWidth: '500px', margin: '0 auto' }}>
            {[
              'Early access to new beats & services before release',
              'Direct messaging with Doc Rolds for feedback',
              'Exclusive beat packs & member-only discounts',
              'Community challenges & contests with prizes',
              'Live production streams & monthly Q&A sessions'
            ].map((perk, index) => (
              <li key={index} style={{ color: '#ccc', padding: '0.8rem 0', fontSize: '0.95rem', paddingLeft: '2rem', position: 'relative', lineHeight: '1.6' }}>
                <span style={{ position: 'absolute', left: '0', color: '#E83628', fontWeight: 'bold', fontSize: '1.2rem' }}>✓</span>
                {perk}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ textAlign: 'center' }}>
          <a 
            href="https://discord.gg" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '0.8rem', 
              padding: '1.1rem 3rem', 
              background: 'linear-gradient(135deg, #5865F2, #4752C4)', 
              color: 'white', 
              textDecoration: 'none', 
              borderRadius: '8px', 
              fontWeight: 'bold', 
              transition: 'all 0.3s', 
              boxShadow: '0 4px 15px rgba(88, 101, 242, 0.3)', 
              fontSize: '1rem' 
            }}
          >
            <i className="fab fa-discord"></i>
            Join Discord Now
          </a>
        </div>
      </div>
    </section>
  );
}

export default Discord;
