import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { API_URL } from '../config';

const AudioPlayerContext = createContext(null);

export function AudioPlayerProvider({ children }) {
  // Queue state
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);

  // Audio element ref - persists across renders
  const audioRef = useRef(null);
  // Ref to track queue length for handleEnded callback (avoids stale closure)
  const queueLengthRef = useRef(0);

  // Initialize audio element once on mount
  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    audioRef.current = audio;
    console.log('[AudioPlayer] Audio element initialized');

    // Event handlers
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      console.log('[AudioPlayer] Metadata loaded, duration:', audio.duration);
      setDuration(audio.duration);
    };
    const handleEnded = () => {
      console.log('[AudioPlayer] Track ended');
      setCurrentIndex(prev => {
        if (prev !== null && prev < queueLengthRef.current - 1) {
          return prev + 1;
        }
        setIsPlaying(false);
        return prev;
      });
    };
    const handleError = (e) => {
      console.error('[AudioPlayer] Audio error:', e, audio.error);
      setIsPlaying(false);
    };
    const handleCanPlay = () => {
      console.log('[AudioPlayer] Can play');
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.pause();
      audio.src = '';
    };
  }, []); // Only run once on mount

  // Keep queue length ref in sync
  useEffect(() => {
    queueLengthRef.current = queue.length;
  }, [queue.length]);

  // Get current beat from queue
  const currentBeat = currentIndex !== null && queue[currentIndex] ? queue[currentIndex] : null;

  // Load and play track when currentIndex or queue changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    console.log('[AudioPlayer] Index/Queue effect:', { currentIndex, queueLength: queue.length, currentBeat: currentBeat?.title });

    if (currentBeat && currentBeat.audioFile) {
      // Build audio URL - audioFile already starts with / so don't add another
      const baseUrl = API_URL.replace('/api', '');
      const audioUrl = currentBeat.audioFile.startsWith('http')
        ? currentBeat.audioFile
        : `${baseUrl}${currentBeat.audioFile}`;

      console.log('[AudioPlayer] Loading audio URL:', audioUrl);

      // Only reload if URL changed
      if (audio.src !== audioUrl) {
        audio.src = audioUrl;
        audio.load();
      }

      setCurrentTime(0);
      setDuration(currentBeat.duration || 0);
    }
  }, [currentIndex, queue, currentBeat]);

  // Handle play/pause state changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    console.log('[AudioPlayer] Play/pause effect:', { isPlaying, src: audio.src, readyState: audio.readyState });

    if (!audio.src) return;

    if (isPlaying) {
      console.log('[AudioPlayer] Calling play()...');
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => console.log('[AudioPlayer] Playing!'))
          .catch(err => {
            console.error('[AudioPlayer] Play error:', err);
            // If autoplay is blocked, we might need user interaction
            if (err.name === 'NotAllowedError') {
              console.log('[AudioPlayer] Autoplay blocked, waiting for user interaction');
            }
          });
      }
    } else {
      console.log('[AudioPlayer] Pausing...');
      audio.pause();
    }
  }, [isPlaying]);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Toggle body class for padding
  useEffect(() => {
    if (currentBeat) {
      document.body.classList.add('has-audio-player');
    } else {
      document.body.classList.remove('has-audio-player');
    }
    return () => document.body.classList.remove('has-audio-player');
  }, [currentBeat]);

  // Actions
  const playBeat = useCallback((beatId, beats) => {
    console.log('[AudioPlayer] playBeat called:', { beatId, beatsLength: beats?.length });

    // Use provided beats or fall back to current queue
    const targetQueue = beats || queue;

    const index = targetQueue.findIndex(b => b.id === beatId);
    if (index === -1) {
      console.error('[AudioPlayer] Beat not found:', beatId);
      return;
    }

    const beat = targetQueue[index];
    console.log('[AudioPlayer] Found beat:', { title: beat.title, audioFile: beat.audioFile });

    if (!beat.audioFile) {
      alert('Audio preview coming soon! Contact us to hear the full track.');
      return;
    }

    // Update queue if new beats provided
    if (beats && beats !== queue) {
      console.log('[AudioPlayer] Setting new queue');
      setQueue(beats);
    }

    // Check if it's the same track
    if (currentIndex === index && queue === targetQueue) {
      console.log('[AudioPlayer] Same track, toggling play/pause');
      setIsPlaying(prev => !prev);
    } else {
      console.log('[AudioPlayer] New track, setting index:', index);
      setCurrentIndex(index);
      setIsPlaying(true);
    }
  }, [queue, currentIndex]);

  const togglePlayPause = useCallback(() => {
    if (!currentBeat?.audioFile) {
      alert('Audio preview coming soon! Contact us to hear the full track.');
      return;
    }
    setIsPlaying(prev => !prev);
  }, [currentBeat]);

  const playNext = useCallback(() => {
    if (currentIndex !== null && currentIndex < queue.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsPlaying(true);
    }
  }, [currentIndex, queue.length]);

  const playPrev = useCallback(() => {
    if (currentIndex !== null && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setIsPlaying(true);
    }
  }, [currentIndex]);

  const seekTo = useCallback((time) => {
    const audio = audioRef.current;
    if (audio && audio.duration > 0) {
      audio.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const setPlayerVolume = useCallback((vol) => {
    setVolume(Math.max(0, Math.min(1, vol)));
  }, []);

  const closePlayer = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = '';
    }
    setCurrentIndex(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  const value = {
    // State
    queue,
    currentBeat,
    currentIndex,
    isPlaying,
    currentTime,
    duration,
    volume,

    // Actions
    setQueue,
    playBeat,
    togglePlayPause,
    playNext,
    playPrev,
    seekTo,
    setVolume: setPlayerVolume,
    closePlayer,
  };

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    // Return a safe fallback instead of throwing to prevent crashes
    console.warn('useAudioPlayer called outside of AudioPlayerProvider, returning fallback');
    return {
      queue: [],
      currentBeat: null,
      currentIndex: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: 0.8,
      setQueue: () => {},
      playBeat: () => {},
      togglePlayPause: () => {},
      playNext: () => {},
      playPrev: () => {},
      seekTo: () => {},
      setVolume: () => {},
      closePlayer: () => {},
    };
  }
  return context;
}

export default AudioPlayerContext;
