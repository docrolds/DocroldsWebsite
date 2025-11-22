import { useState, useEffect } from 'react';

function Videos() {
  const [videosContent, setVideosContent] = useState({
    videoIds: [
      { id: 'ot8ujvHU7J4' },
      { id: '_bsS4sXNrsQ' },
      { id: 'BbNIph4Ta5Y', start: 155 },
      { id: 'Jq0eXzAqJkI', start: 1337 }
    ]
  });
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    setIsAdmin(!!token);
    
    fetch('https://docrolds-api.onrender.com/api/content')
      .then(res => res.json())
      .then(data => {
        setVideosContent(data.videos);
      })
      .catch(err => console.error('Failed to fetch videos content:', err));
  }, []);

  return (
    <section id="videos" style={{ position: 'relative' }}>
      {isAdmin && (
        <button
          onClick={() => alert('Videos editing coming soon')}
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
      
      <h2 className="section-title">Featured Videos</h2>
      <div className="videos-container">
        {videosContent.videoIds.map((video, index) => (
          <div key={index} className="video-card">
            <div className="video-wrapper">
              <iframe 
                src={`https://www.youtube.com/embed/${video.id}${video.start ? `?start=${video.start}` : ''}`}
                allowFullScreen
              ></iframe>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default Videos;
