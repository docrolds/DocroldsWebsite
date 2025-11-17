import { useState, useEffect } from 'react';

function Hero() {
  const [heroContent, setHeroContent] = useState({
    title: 'The Journey to Professional Sound Starts with a Dream',
    tagline: 'Dreams Over Careers',
    description: 'Professional recording studio and mixing services for artists who are serious about their craft. Book your session today and bring your music to life.',
    imageUrl: 'https://docrolds.com/wp-content/uploads/2025/09/IMG_7092_upscaled-scaled.png'
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ ...heroContent });

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    setIsAdmin(!!token);
    
    fetch('http://localhost:3000/api/content')
      .then(res => res.json())
      .then(data => {
        setHeroContent(data.hero);
        setEditForm(data.hero);
      })
      .catch(err => console.error('Failed to fetch hero content:', err));
  }, []);

  const handleBookNow = () => {
    alert('Booking functionality to be implemented');
  };

  const handleEditClick = () => {
    setEditMode(true);
    setEditForm({ ...heroContent });
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('http://localhost:3000/api/content/hero', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editForm)
      });

      if (response.ok) {
        const updated = await response.json();
        setHeroContent(updated);
        setEditMode(false);
      }
    } catch (error) {
      console.error('Failed to save hero content:', error);
      alert('Failed to save changes');
    }
  };

  return (
    <section id="home" className="hero" style={{ position: 'relative' }}>
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

      {editMode ? (
        <div style={{ padding: '2rem', background: 'rgba(26, 31, 38, 0.9)', borderRadius: '8px', maxWidth: '600px', margin: '0 auto' }}>
          <h3 style={{ color: '#fff', marginBottom: '1.5rem' }}>Edit Hero Section</h3>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Title</label>
            <textarea
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: '#0f1419',
                border: '1px solid rgba(232, 54, 40, 0.3)',
                borderRadius: '6px',
                color: '#e0e0e0',
                minHeight: '80px',
                resize: 'vertical'
              }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Tagline</label>
            <input
              type="text"
              value={editForm.tagline}
              onChange={(e) => setEditForm({ ...editForm, tagline: e.target.value })}
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
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Image URL</label>
            <input
              type="text"
              value={editForm.imageUrl}
              onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })}
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
              Save Changes
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
        <>
          <div className="hero-content">
            <h1>{heroContent.title}</h1>
            <div className="hero-tagline">{heroContent.tagline}</div>
            <p>{heroContent.description}</p>
            <button className="book-now-btn" onClick={handleBookNow}>Book Now</button>
          </div>
          <div className="hero-image">
            <img src={heroContent.imageUrl} alt="Doc Rolds" />
          </div>
        </>
      )}
    </section>
  );
}

export default Hero;
