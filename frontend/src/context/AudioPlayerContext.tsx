import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { API_URL } from '../config';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Represents a beat/track that can be played in the audio player
 */
export interface Beat {
  id: string | number;
  title: string;
  artist?: string;
  audioFile: string | null;
  coverArt?: string;
  duration?: number;
  bpm?: number;
  key?: string;
  genre?: string;
  price?: number;
  tags?: string[];
}

/**
 * Repeat mode options
 */
export type RepeatMode = 'off' | 'all' | 'one';

/**
 * Audio player state values
 */
export interface AudioPlayerState {
  /** Current queue of beats */
  queue: Beat[];
  /** Currently playing beat or null if none */
  currentBeat: Beat | null;
  /** Index of current beat in queue */
  currentIndex: number | null;
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** Current playback position in seconds */
  currentTime: number;
  /** Total duration of current track in seconds */
  duration: number;
  /** Volume level (0-1) */
  volume: number;
  /** Whether shuffle mode is enabled */
  shuffle: boolean;
  /** Current repeat mode */
  repeatMode: RepeatMode;
}

/**
 * Audio player action functions
 */
export interface AudioPlayerActions {
  /** Set the queue of beats */
  setQueue: React.Dispatch<React.SetStateAction<Beat[]>>;
  /** Play a specific beat by ID, optionally with a new queue */
  playBeat: (beatId: string | number, beats?: Beat[]) => void;
  /** Toggle between play and pause */
  togglePlayPause: () => void;
  /** Skip to the next track */
  playNext: () => void;
  /** Go back to the previous track */
  playPrev: () => void;
  /** Seek to a specific time in seconds */
  seekTo: (time: number) => void;
  /** Set the volume (0-1) */
  setVolume: (volume: number) => void;
  /** Close the player and reset state */
  closePlayer: () => void;
  /** Toggle shuffle mode */
  toggleShuffle: () => void;
  /** Cycle through repeat modes */
  toggleRepeat: () => void;
}

/**
 * Complete audio player context value combining state and actions
 */
export type AudioPlayerContextValue = AudioPlayerState & AudioPlayerActions;

/**
 * Props for the AudioPlayerProvider component
 */
export interface AudioPlayerProviderProps {
  children: ReactNode;
}

// ============================================================================
// Context
// ============================================================================

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

export function AudioPlayerProvider({
  children,
}: AudioPlayerProviderProps): JSX.Element {
  // Queue state
  const [queue, setQueue] = useState<Beat[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.8);
  const [shuffle, setShuffle] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');

  // Audio element ref - persists across renders
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Refs to track state for handleEnded callback (avoids stale closure)
  const queueLengthRef = useRef<number>(0);
  const shuffleRef = useRef<boolean>(false);
  const repeatModeRef = useRef<RepeatMode>('off');

  // Initialize audio element once on mount
  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    audioRef.current = audio;
    console.log('[AudioPlayer] Audio element initialized');

    // Event handlers
    const handleTimeUpdate = (): void => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = (): void => {
      console.log('[AudioPlayer] Metadata loaded, duration:', audio.duration);
      setDuration(audio.duration);
    };
    const handleEnded = (): void => {
      console.log('[AudioPlayer] Track ended, repeatMode:', repeatModeRef.current, 'shuffle:', shuffleRef.current);

      // Handle repeat one - replay same track
      if (repeatModeRef.current === 'one') {
        audio.currentTime = 0;
        audio.play();
        return;
      }

      setCurrentIndex((prev: number | null) => {
        if (prev === null) {
          setIsPlaying(false);
          return prev;
        }

        const queueLen = queueLengthRef.current;

        // Handle shuffle
        if (shuffleRef.current && queueLen > 1) {
          let nextIndex = Math.floor(Math.random() * queueLen);
          // Avoid playing same track twice in a row
          while (nextIndex === prev && queueLen > 1) {
            nextIndex = Math.floor(Math.random() * queueLen);
          }
          return nextIndex;
        }

        // Normal progression
        if (prev < queueLen - 1) {
          return prev + 1;
        }

        // End of queue - handle repeat all
        if (repeatModeRef.current === 'all') {
          return 0; // Go back to start
        }

        setIsPlaying(false);
        return prev;
      });
    };
    const handleError = (e: Event): void => {
      console.error('[AudioPlayer] Audio error:', e, audio.error);
      setIsPlaying(false);
    };
    const handleCanPlay = (): void => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Keep refs in sync with state
  useEffect(() => {
    queueLengthRef.current = queue.length;
  }, [queue.length]);

  useEffect(() => {
    shuffleRef.current = shuffle;
  }, [shuffle]);

  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  // Get current beat from queue
  const currentBeat: Beat | null =
    currentIndex !== null && queue[currentIndex] ? queue[currentIndex] : null;

  // Load and play track when currentIndex or queue changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    console.log('[AudioPlayer] Index/Queue effect:', {
      currentIndex,
      queueLength: queue.length,
      currentBeat: currentBeat?.title,
    });

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

    console.log('[AudioPlayer] Play/pause effect:', {
      isPlaying,
      src: audio.src,
      readyState: audio.readyState,
    });

    if (!audio.src) return;

    if (isPlaying) {
      console.log('[AudioPlayer] Calling play()...');
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => console.log('[AudioPlayer] Playing!'))
          .catch((err: Error) => {
            console.error('[AudioPlayer] Play error:', err);
            // If autoplay is blocked, we might need user interaction
            if (err.name === 'NotAllowedError') {
              console.log(
                '[AudioPlayer] Autoplay blocked, waiting for user interaction'
              );
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
  const playBeat = useCallback(
    (beatId: string | number, beats?: Beat[]): void => {
      console.log('[AudioPlayer] playBeat called:', {
        beatId,
        beatsLength: beats?.length,
      });

      // Use provided beats or fall back to current queue
      const targetQueue = beats || queue;

      const index = targetQueue.findIndex((b) => b.id === beatId);
      if (index === -1) {
        console.error('[AudioPlayer] Beat not found:', beatId);
        return;
      }

      const beat = targetQueue[index];
      console.log('[AudioPlayer] Found beat:', {
        title: beat.title,
        audioFile: beat.audioFile,
      });

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
        setIsPlaying((prev) => !prev);
      } else {
        console.log('[AudioPlayer] New track, setting index:', index);
        setCurrentIndex(index);
        setIsPlaying(true);
      }
    },
    [queue, currentIndex]
  );

  const togglePlayPause = useCallback((): void => {
    if (!currentBeat?.audioFile) {
      alert('Audio preview coming soon! Contact us to hear the full track.');
      return;
    }
    setIsPlaying((prev) => !prev);
  }, [currentBeat]);

  const playNext = useCallback((): void => {
    if (currentIndex !== null && currentIndex < queue.length - 1) {
      setCurrentIndex((prev) => (prev !== null ? prev + 1 : null));
      setIsPlaying(true);
    }
  }, [currentIndex, queue.length]);

  const playPrev = useCallback((): void => {
    if (currentIndex !== null && currentIndex > 0) {
      setCurrentIndex((prev) => (prev !== null ? prev - 1 : null));
      setIsPlaying(true);
    }
  }, [currentIndex]);

  const seekTo = useCallback((time: number): void => {
    const audio = audioRef.current;
    if (audio && audio.duration > 0) {
      audio.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const setPlayerVolume = useCallback((vol: number): void => {
    setVolume(Math.max(0, Math.min(1, vol)));
  }, []);

  const closePlayer = useCallback((): void => {
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

  const toggleShuffle = useCallback((): void => {
    setShuffle((prev) => !prev);
  }, []);

  const toggleRepeat = useCallback((): void => {
    setRepeatMode((prev) => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  }, []);

  const value: AudioPlayerContextValue = {
    // State
    queue,
    currentBeat,
    currentIndex,
    isPlaying,
    currentTime,
    duration,
    volume,
    shuffle,
    repeatMode,

    // Actions
    setQueue,
    playBeat,
    togglePlayPause,
    playNext,
    playPrev,
    seekTo,
    setVolume: setPlayerVolume,
    closePlayer,
    toggleShuffle,
    toggleRepeat,
  };

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Default/fallback context value when used outside provider
 */
const fallbackContextValue: AudioPlayerContextValue = {
  queue: [],
  currentBeat: null,
  currentIndex: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  shuffle: false,
  repeatMode: 'off',
  setQueue: () => {},
  playBeat: () => {},
  togglePlayPause: () => {},
  playNext: () => {},
  playPrev: () => {},
  seekTo: () => {},
  setVolume: () => {},
  closePlayer: () => {},
  toggleShuffle: () => {},
  toggleRepeat: () => {},
};

/**
 * Hook to access the audio player context
 * Returns a fallback value if used outside of AudioPlayerProvider
 */
export function useAudioPlayer(): AudioPlayerContextValue {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    // Return a safe fallback instead of throwing to prevent crashes
    console.warn(
      'useAudioPlayer called outside of AudioPlayerProvider, returning fallback'
    );
    return fallbackContextValue;
  }
  return context;
}

export default AudioPlayerContext;
