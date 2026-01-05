// API Configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

console.log('Beats Page - API URL:', API_URL);

let beats = [];
let audioElement = new Audio();
let audioContext = null;
let analyser = null;
let dataArray = null;
let currentBeatIndex = 0;
let isPlaying = false;
let currentTime = 0;
let animationId = null;

async function loadBeats() {
    try {
        const response = await fetch(`${API_URL}/beats`);
        const apiBeats = await response.json();
        
        beats = apiBeats.map(beat => ({
            ...beat,
            producer: 'Doc Rolds'
        }));

        if (beats.length === 0) {
            beats = [
                { title: 'Midnight Vibes', genre: 'Hip-Hop', category: 'Hip-Hop', bpm: 92, key: 'C Minor', duration: 165, producer: 'Doc Rolds' },
                { title: 'Bass Trap', genre: 'Trap', category: 'Trap', bpm: 140, key: 'A Minor', duration: 180, producer: 'Doc Rolds' },
                { title: 'Smooth Flows', genre: 'R&B', category: 'R&B', bpm: 95, key: 'F Major', duration: 200, producer: 'Doc Rolds' },
                { title: 'Electric Dreams', genre: 'Pop', category: 'Pop', bpm: 120, key: 'G Major', duration: 210, producer: 'Doc Rolds' }
            ];
        }

        renderPlaylist();
        if (beats.length > 0) {
            updateNowPlaying();
        }
    } catch (error) {
        console.error('Error loading beats:', error);
        beats = [
            { title: 'Midnight Vibes', genre: 'Hip-Hop', category: 'Hip-Hop', bpm: 92, key: 'C Minor', duration: 165, producer: 'Doc Rolds' },
            { title: 'Bass Trap', genre: 'Trap', category: 'Trap', bpm: 140, key: 'A Minor', duration: 180, producer: 'Doc Rolds' },
            { title: 'Smooth Flows', genre: 'R&B', category: 'R&B', bpm: 95, key: 'F Major', duration: 200, producer: 'Doc Rolds' },
            { title: 'Electric Dreams', genre: 'Pop', category: 'Pop', bpm: 120, key: 'G Major', duration: 210, producer: 'Doc Rolds' }
        ];
        renderPlaylist();
        updateNowPlaying();
    }
}

audioElement.addEventListener('loadedmetadata', () => {
    const beat = beats[currentBeatIndex];
    beat.duration = audioElement.duration;
    updateProgressTime();
});

audioElement.addEventListener('timeupdate', () => {
    if (audioElement.src) {
        currentTime = audioElement.currentTime;
        document.getElementById('currentTime').textContent = formatTime(currentTime);
        document.getElementById('modalCurrentTime').textContent = formatTime(currentTime);
        document.getElementById('fixedCurrentTime').textContent = formatTime(currentTime);
        drawWaveform();
        drawModalWaveform();
        drawFixedWaveform();
    }
});

audioElement.addEventListener('ended', () => {
    nextBeat();
});

audioElement.addEventListener('play', () => {
    isPlaying = true;
    updatePlayPauseBtn();
});

audioElement.addEventListener('pause', () => {
    isPlaying = false;
    updatePlayPauseBtn();
});

audioElement.addEventListener('error', (e) => {
    console.error('Audio error:', e);
    console.error('Audio element error:', audioElement.error);
    alert(`Audio playback error: ${audioElement.error ? audioElement.error.message : 'Unknown error'}`);
});

function renderPlaylist() {
    const playlist = document.getElementById('playlist');
    if (!playlist) return;

    playlist.innerHTML = beats.map((beat, index) => {
        // Format price display
        const priceDisplay = beat.price ? `$${parseFloat(beat.price).toFixed(2)}` : 'Free';

        // Get cover art URL
        const coverArtUrl = beat.coverArt ? `${API_URL.replace('/api', '')}${beat.coverArt}` : null;

        return `
            <li class="playlist-item ${index === 0 ? 'active' : ''}" onclick="playBeat(${index})" data-index="${index}">
                <div class="playlist-item-cover">
                    ${coverArtUrl ? `<img src="${coverArtUrl}" alt="${beat.title}" class="cover-art-img">` : '<div class="cover-art-placeholder"><i class="fas fa-music"></i></div>'}
                </div>
                <div class="playlist-item-content">
                    <div class="playlist-item-title ${index === 0 ? 'playlist-item-active-title' : ''}">${beat.title}</div>
                    <div class="playlist-item-meta">
                        <span class="playlist-item-genre">${beat.genre || 'Beat'}</span>
                        <span class="playlist-item-bpm">${beat.bpm || '--'} BPM</span>
                    </div>
                </div>
                <div class="playlist-item-price ${beat.price ? '' : 'free'}">${priceDisplay}</div>
            </li>
        `;
    }).join('');
}

function playBeat(index) {
    currentBeatIndex = index;
    const beat = beats[currentBeatIndex];
    
    if (beat.audioFile) {
        const audioUrl = `${API_URL.replace('/api', '')}${beat.audioFile}`;
        console.log('Loading audio from:', audioUrl);
        audioElement.src = audioUrl;
        audioElement.load();
        audioElement.play().catch(err => {
            console.error('Error playing audio:', err);
            alert('Could not play audio file. Check console for details.');
            simulatePlayback();
        });
    } else {
        console.log('No audio file for this beat, simulating playback');
        simulatePlayback();
    }
    
    updateNowPlaying();
    updatePlaylistUI();
    showFixedPlayer();
    openModal();
}

function simulatePlayback() {
    isPlaying = true;
    currentTime = 0;
    updatePlayPauseBtn();
    animateProgress();
}

function togglePlayPause() {
    const beat = beats[currentBeatIndex];
    
    if (beat.audioFile && audioElement.src) {
        if (isPlaying) {
            audioElement.pause();
        } else {
            audioElement.play().catch(err => {
                console.error('Error playing audio:', err);
                simulatePlayback();
            });
        }
    } else {
        isPlaying = !isPlaying;
        updatePlayPauseBtn();
        if (isPlaying) {
            animateProgress();
        } else if (animationId) {
            cancelAnimationFrame(animationId);
        }
    }
}

function nextBeat() {
    currentBeatIndex = (currentBeatIndex + 1) % beats.length;
    const beat = beats[currentBeatIndex];
    
    if (beat.audioFile) {
        audioElement.src = `${API_URL.replace('/api', '')}${beat.audioFile}`;
        audioElement.play().catch(err => {
            console.error('Error playing audio:', err);
            simulatePlayback();
        });
    } else {
        simulatePlayback();
    }
    
    updateNowPlaying();
    updatePlaylistUI();
}

function previousBeat() {
    currentBeatIndex = (currentBeatIndex - 1 + beats.length) % beats.length;
    const beat = beats[currentBeatIndex];
    
    if (beat.audioFile) {
        audioElement.src = `${API_URL.replace('/api', '')}${beat.audioFile}`;
        audioElement.play().catch(err => {
            console.error('Error playing audio:', err);
            simulatePlayback();
        });
    } else {
        simulatePlayback();
    }
    
    updateNowPlaying();
    updatePlaylistUI();
}

function updateNowPlaying() {
    const beat = beats[currentBeatIndex];
    document.getElementById('nowPlayingTitle').textContent = beat.title;
    document.getElementById('nowPlayingGenre').textContent = beat.genre;
    document.getElementById('beatBPM').textContent = beat.bpm;
    document.getElementById('beatKey').textContent = beat.key;
    
    document.getElementById('modalNowPlayingTitle').textContent = beat.title;
    document.getElementById('modalNowPlayingGenre').textContent = beat.genre;
    document.getElementById('modalProducer').textContent = beat.producer;
    document.getElementById('modalBeatBPM').textContent = beat.bpm;
    document.getElementById('modalBeatKey').textContent = beat.key;
    
    document.getElementById('fixedPlayerTitle').textContent = beat.title;
    document.getElementById('fixedPlayerGenre').textContent = beat.genre;
    document.getElementById('fixedPlayerBPM').textContent = beat.bpm;
    
    updateProgressTime();
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateProgressTime() {
    const beat = beats[currentBeatIndex];
    document.getElementById('progressTime').textContent = formatTime(beat.duration);
    document.getElementById('modalProgressTime').textContent = formatTime(beat.duration);
    document.getElementById('fixedProgressTime').textContent = formatTime(beat.duration);
    drawWaveform();
    drawModalWaveform();
    drawFixedWaveform();
}

function drawWaveform() {
    const canvas = document.getElementById('waveformCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const beat = beats[currentBeatIndex];
    const barCount = 80;
    const barWidth = canvas.width / barCount;
    const actualTime = beat.audioFile && audioElement.src ? audioElement.currentTime : currentTime;
    const progress = (actualTime / beat.duration);

    for (let i = 0; i < barCount; i++) {
        const barProgress = i / barCount;
        const height = 20 + Math.sin((i + currentBeatIndex * 5) * 0.5) * 15;
        
        if (barProgress <= progress) {
            ctx.fillStyle = '#E83628';
        } else {
            ctx.fillStyle = 'rgba(232, 54, 40, 0.3)';
        }

        const x = i * barWidth + 1;
        const y = (canvas.height - height) / 2;
        ctx.fillRect(x, y, barWidth - 2, height);
    }
}

function drawModalWaveform() {
    const canvas = document.getElementById('modalWaveformCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const beat = beats[currentBeatIndex];
    const barCount = 80;
    const barWidth = canvas.width / barCount;
    const actualTime = beat.audioFile && audioElement.src ? audioElement.currentTime : currentTime;
    const progress = (actualTime / beat.duration);

    for (let i = 0; i < barCount; i++) {
        const barProgress = i / barCount;
        const height = 20 + Math.sin((i + currentBeatIndex * 5) * 0.5) * 15;
        
        if (barProgress <= progress) {
            ctx.fillStyle = '#E83628';
        } else {
            ctx.fillStyle = 'rgba(232, 54, 40, 0.3)';
        }

        const x = i * barWidth + 1;
        const y = (canvas.height - height) / 2;
        ctx.fillRect(x, y, barWidth - 2, height);
    }
}

function drawFixedWaveform() {
    const canvas = document.getElementById('fixedWaveformCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const beat = beats[currentBeatIndex];
    const barCount = 40;
    const barWidth = canvas.width / barCount;
    const actualTime = beat.audioFile && audioElement.src ? audioElement.currentTime : currentTime;
    const progress = (actualTime / beat.duration);

    for (let i = 0; i < barCount; i++) {
        const barProgress = i / barCount;
        const height = 2 + Math.sin((i + currentBeatIndex * 5) * 0.5) * 1.5;
        
        if (barProgress <= progress) {
            ctx.fillStyle = '#E83628';
        } else {
            ctx.fillStyle = 'rgba(232, 54, 40, 0.3)';
        }

        const x = i * barWidth + 0.5;
        const y = (canvas.height - height) / 2;
        ctx.fillRect(x, y, barWidth - 1, height);
    }
}

function animateProgress() {
    if (!isPlaying) return;
    const beat = beats[currentBeatIndex];
    currentTime = Math.min(currentTime + 0.016, beat.duration);
    
    document.getElementById('currentTime').textContent = formatTime(currentTime);
    document.getElementById('modalCurrentTime').textContent = formatTime(currentTime);
    document.getElementById('fixedCurrentTime').textContent = formatTime(currentTime);
    
    drawWaveform();
    drawModalWaveform();
    drawFixedWaveform();

    if (currentTime >= beat.duration) {
        nextBeat();
    } else {
        animationId = requestAnimationFrame(animateProgress);
    }
}

function seekToPosition(e) {
    seekOnCanvas(document.getElementById('waveformCanvas'), e);
}

function seekModalPosition(e) {
    seekOnCanvas(document.getElementById('modalWaveformCanvas'), e);
}

function seekFixedPosition(e) {
    seekOnCanvas(document.getElementById('fixedWaveformCanvas'), e);
}

function seekOnCanvas(canvas, e) {
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    
    const beat = beats[currentBeatIndex];
    const newTime = Math.max(0, Math.min(percentage * beat.duration, beat.duration));
    
    if (beat.audioFile && audioElement.src) {
        audioElement.currentTime = newTime;
    } else {
        currentTime = newTime;
        document.getElementById('currentTime').textContent = formatTime(currentTime);
        document.getElementById('modalCurrentTime').textContent = formatTime(currentTime);
        document.getElementById('fixedCurrentTime').textContent = formatTime(currentTime);
    }
    
    drawWaveform();
    drawModalWaveform();
    drawFixedWaveform();
}

function updatePlaylistUI() {
    const playlistItems = document.querySelectorAll('.playlist-item');
    playlistItems.forEach((item, index) => {
        item.classList.remove('active');
        const icon = item.querySelector('.playlist-item-icon');
        const title = item.querySelector('.playlist-item-title');
        
        if (index === currentBeatIndex) {
            item.classList.add('active');
            if (icon) {
                icon.innerHTML = '<span class="playlist-item-active">♫</span>';
            }
            title.classList.add('playlist-item-active-title');
        } else {
            if (icon) {
                icon.textContent = '♪';
            }
            title.classList.remove('playlist-item-active-title');
        }
    });
}

function updatePlayPauseBtn() {
    const btn = document.getElementById('playPauseBtn');
    const modalBtn = document.getElementById('modalPlayPauseBtn');
    const fixedBtn = document.getElementById('fixedPlayPauseBtn');
    const text = isPlaying ? '⏸' : '▶';
    btn.textContent = text;
    if (modalBtn) modalBtn.textContent = text;
    if (fixedBtn) fixedBtn.textContent = text;
}

function openModal() {
    document.getElementById('modalOverlay').classList.add('show');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('show');
}

function showFixedPlayer() {
    document.getElementById('fixedPlayer').classList.add('show');
}

function hideFixedPlayer() {
    document.getElementById('fixedPlayer').classList.remove('show');
}

function handleNewsletterSignup(event) {
    event.preventDefault();
    const email = event.target.querySelector('input[type="email"]').value;
    alert(`Thanks for subscribing with ${email}! Check your inbox for exclusive content.`);
    event.target.reset();
}

window.addEventListener('load', async () => {
    await loadBeats();
    updatePlayPauseBtn();
    
    const canvas = document.getElementById('waveformCanvas');
    if (canvas) {
        canvas.addEventListener('click', seekToPosition);
        drawWaveform();
    }

    const modalCanvas = document.getElementById('modalWaveformCanvas');
    if (modalCanvas) {
        modalCanvas.addEventListener('click', seekModalPosition);
        drawModalWaveform();
    }

    const fixedCanvas = document.getElementById('fixedWaveformCanvas');
    if (fixedCanvas) {
        fixedCanvas.addEventListener('click', seekFixedPosition);
        drawFixedWaveform();
    }

    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeModal();
            }
        });
    }
});

window.addEventListener('resize', () => {
    drawWaveform();
    drawModalWaveform();
    drawFixedWaveform();
});
