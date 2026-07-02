import { useState, useEffect, ReactNode, MouseEvent, ChangeEvent, KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../config';
import { useCart, LicenseTier } from '../context/CartContext';
import { useAudioPlayer, Beat as AudioBeat } from '../context/AudioPlayerContext';
import { useToast } from '../context/NotificationContext';
import { useCustomerAuth, Customer } from '../context/CustomerAuthContext';
import AuthPromptModal from '../components/AuthPromptModal';

// ============================================
// Type Definitions
// ============================================

interface Beat {
  id: string | number;
  title: string;
  producer?: string;
  producedBy?: string;
  genre: string;
  bpm: number;
  key: string;
  duration: number;
  price: number;
  tags?: string[];
  audioFile: string | null;
  coverArt?: string;
  likeCount?: number;
  commentCount?: number;
  soldExclusively?: boolean;
}

interface CommentCustomer {
  id: string;
  firstName?: string;
  stageName?: string;
  profilePicture?: string;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  customerId: string;
  customer?: CommentCustomer;
  likeCount?: number;
  replies?: Comment[];
}

interface Playlist {
  id: string;
  name: string;
  beats?: Array<{ id: string | number }>;
  isDefault?: boolean;
}

type AuthActionType = 'like' | 'playlist';

// ============================================
// Helper Functions
// ============================================

// Generate consistent gradient class based on beat ID
const getGradientClass = (beatId: string | number): string => {
  const hash = String(beatId).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return `gradient-${(hash % 10) + 1}`;
};

// ============================================
// BeatsPage Component
// ============================================

function BeatsPage(): ReactNode {
  // Hooks must be called first
  const { licenseTiers, addToCart, setIsCartOpen } = useCart();
  const {
    currentBeat,
    isPlaying,
    currentTime,
    duration,
    playBeat,
    setQueue,
    seekTo,
  } = useAudioPlayer();
  const toast = useToast();
  const { isAuthenticated, token, customer } = useCustomerAuth();

  // State
  const [beats, setBeats] = useState<Beat[]>([]);
  const [activeGenre, setActiveGenre] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBeatForLicense, setSelectedBeatForLicense] = useState<Beat | null>(null);

  // Like system state
  const [likedBeats, setLikedBeats] = useState<Set<string | number>>(new Set());
  const [likeLoading, setLikeLoading] = useState<Set<string | number>>(new Set());
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [pendingLikeBeat, setPendingLikeBeat] = useState<Beat | null>(null);
  const [authActionType, setAuthActionType] = useState<AuthActionType>('like');

  // Playlist state
  const [showPlaylistModal, setShowPlaylistModal] = useState<boolean>(false);
  const [beatForPlaylist, setBeatForPlaylist] = useState<Beat | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistLoading, setPlaylistLoading] = useState<boolean>(false);
  const [creatingPlaylist, setCreatingPlaylist] = useState<boolean>(false);
  const [newPlaylistName, setNewPlaylistName] = useState<string>('');
  const [savedInPlaylists, setSavedInPlaylists] = useState<Set<string>>(new Set());

  // Comments state
  const [showCommentsModal, setShowCommentsModal] = useState<boolean>(false);
  const [beatForComments, setBeatForComments] = useState<Beat | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState<boolean>(false);
  const [newComment, setNewComment] = useState<string>('');
  const [submittingComment, setSubmittingComment] = useState<boolean>(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<string>('');
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());

  // Handle comment button click
  const handleCommentClick = async (beat: Beat, e: MouseEvent<HTMLButtonElement>): Promise<void> => {
    e.stopPropagation();
    setBeatForComments(beat);
    setShowCommentsModal(true);
    setCommentsLoading(true);
    setReplyingTo(null);
    setReplyText('');

    try {
      const res = await fetch(`${API_URL}/beats/${beat.id}/comments`);
      if (res.ok) {
        const data: Comment[] = await res.json();
        setComments(data);
      }

      // Fetch liked comments if authenticated
      if (isAuthenticated && token) {
        const likesRes = await fetch(`${API_URL}/beats/${beat.id}/comments/likes`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (likesRes.ok) {
          const likedIds: string[] = await likesRes.json();
          setLikedComments(new Set(likedIds));
        }
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err);
      toast.error('Failed to load comments', 'Please try again');
    } finally {
      setCommentsLoading(false);
    }
  };

  // Submit a new comment
  const submitComment = async (): Promise<void> => {
    if (!newComment.trim() || !beatForComments || !isAuthenticated) return;

    setSubmittingComment(true);
    try {
      const res = await fetch(`${API_URL}/beats/${beatForComments.id}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: newComment.trim() })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to post comment');
      }

      const comment: Comment = await res.json();
      setComments((prev: Comment[]) => [comment, ...prev]);
      setNewComment('');

      // Update beat comment count locally
      setBeats((prev: Beat[]) => prev.map((b: Beat) =>
        b.id === beatForComments.id
          ? { ...b, commentCount: (b.commentCount || 0) + 1 }
          : b
      ));

      toast.success('Comment posted', beatForComments.title);
    } catch (err) {
      toast.error('Failed to post comment', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Delete a comment
  const deleteComment = async (commentId: string, isReply: boolean = false, parentId: string | null = null): Promise<void> => {
    try {
      const res = await fetch(`${API_URL}/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error('Failed to delete comment');

      if (isReply && parentId) {
        // Remove reply from parent comment
        setComments((prev: Comment[]) => prev.map((c: Comment) =>
          c.id === parentId
            ? { ...c, replies: c.replies?.filter((r: Comment) => r.id !== commentId) }
            : c
        ));
      } else {
        // Remove top-level comment
        setComments((prev: Comment[]) => prev.filter((c: Comment) => c.id !== commentId));
      }

      // Update beat comment count locally
      if (beatForComments) {
        setBeats((prev: Beat[]) => prev.map((b: Beat) =>
          b.id === beatForComments.id
            ? { ...b, commentCount: Math.max((b.commentCount || 1) - 1, 0) }
            : b
        ));
      }

      toast.success('Comment deleted');
    } catch (err) {
      toast.error('Failed to delete comment', 'Please try again');
    }
  };

  // Submit a reply to a comment
  const submitReply = async (parentId: string): Promise<void> => {
    if (!replyText.trim() || !beatForComments || !isAuthenticated) return;

    setSubmittingComment(true);
    try {
      const res = await fetch(`${API_URL}/beats/${beatForComments.id}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: replyText.trim(), parentId })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to post reply');
      }

      const reply: Comment = await res.json();

      // Add reply to parent comment
      setComments((prev: Comment[]) => prev.map((c: Comment) =>
        c.id === parentId
          ? { ...c, replies: [...(c.replies || []), reply] }
          : c
      ));

      setReplyText('');
      setReplyingTo(null);

      // Update beat comment count locally
      setBeats((prev: Beat[]) => prev.map((b: Beat) =>
        b.id === beatForComments.id
          ? { ...b, commentCount: (b.commentCount || 0) + 1 }
          : b
      ));

      toast.success('Reply posted');
    } catch (err) {
      toast.error('Failed to post reply', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Toggle like on a comment
  const toggleCommentLike = async (commentId: string, isReply: boolean = false, parentId: string | null = null): Promise<void> => {
    if (!isAuthenticated) {
      toast.warning('Sign in required', 'Please sign in to like comments');
      return;
    }

    const isLiked = likedComments.has(commentId);

    // Optimistic update
    setLikedComments((prev: Set<string>) => {
      const newSet = new Set(prev);
      if (isLiked) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });

    // Update comment like count optimistically
    const updateLikeCount = (comment: Comment): Comment => ({
      ...comment,
      likeCount: (comment.likeCount || 0) + (isLiked ? -1 : 1)
    });

    if (isReply && parentId) {
      setComments((prev: Comment[]) => prev.map((c: Comment) =>
        c.id === parentId
          ? { ...c, replies: c.replies?.map((r: Comment) => r.id === commentId ? updateLikeCount(r) : r) }
          : c
      ));
    } else {
      setComments((prev: Comment[]) => prev.map((c: Comment) => c.id === commentId ? updateLikeCount(c) : c));
    }

    try {
      const res = await fetch(`${API_URL}/comments/${commentId}/like`, {
        method: isLiked ? 'DELETE' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) throw new Error('Failed to update like');
    } catch (err) {
      // Revert optimistic updates on error
      setLikedComments((prev: Set<string>) => {
        const newSet = new Set(prev);
        if (isLiked) {
          newSet.add(commentId);
        } else {
          newSet.delete(commentId);
        }
        return newSet;
      });

      const revertLikeCount = (comment: Comment): Comment => ({
        ...comment,
        likeCount: (comment.likeCount || 0) + (isLiked ? 1 : -1)
      });

      if (isReply && parentId) {
        setComments((prev: Comment[]) => prev.map((c: Comment) =>
          c.id === parentId
            ? { ...c, replies: c.replies?.map((r: Comment) => r.id === commentId ? revertLikeCount(r) : r) }
            : c
        ));
      } else {
        setComments((prev: Comment[]) => prev.map((c: Comment) => c.id === commentId ? revertLikeCount(c) : c));
      }

      toast.error('Failed to update like', 'Please try again');
    }
  };

  // Default beats for demo
  const defaultBeats: Beat[] = [
    { id: 1, title: 'Midnight Dreams', producer: 'Doc Rolds', genre: 'Hip-Hop', bpm: 92, key: 'C Minor', duration: 165, price: 50, tags: ['dark', 'melodic', 'trap'], audioFile: null },
    { id: 2, title: 'Summer Vibes', producer: 'Doc Rolds', genre: 'R&B', bpm: 85, key: 'G Major', duration: 180, price: 50, tags: ['smooth', 'chill', 'vibes'], audioFile: null },
    { id: 3, title: 'Trap Soul', producer: 'Doc Rolds', genre: 'Trap', bpm: 140, key: 'A Minor', duration: 195, price: 75, tags: ['hard', 'bass', '808'], audioFile: null },
    { id: 4, title: 'West Coast Flow', producer: 'Doc Rolds', genre: 'West Coast', bpm: 98, key: 'F Minor', duration: 210, price: 50, tags: ['g-funk', 'west', 'bounce'], audioFile: null },
    { id: 5, title: 'Dark Matter', producer: 'Doc Rolds', genre: 'Trap', bpm: 145, key: 'D Minor', duration: 188, price: 100, tags: ['dark', 'aggressive', 'drill'], audioFile: null },
    { id: 6, title: 'Smooth Operator', producer: 'Doc Rolds', genre: 'R&B', bpm: 78, key: 'Bb Major', duration: 205, price: 75, tags: ['smooth', 'jazz', 'soul'], audioFile: null },
    { id: 7, title: 'Night Rider', producer: 'Doc Rolds', genre: 'Hip-Hop', bpm: 88, key: 'E Minor', duration: 192, price: 50, tags: ['night', 'dark', 'ambient'], audioFile: null },
    { id: 8, title: 'Cloud Nine', producer: 'Doc Rolds', genre: 'R&B', bpm: 72, key: 'Ab Major', duration: 178, price: 75, tags: ['dreamy', 'floating', 'soft'], audioFile: null }
  ];

  useEffect(() => {
    fetch(`${API_URL}/beats`)
      .then((res: Response) => res.json())
      .then((data: Beat[]) => {
        if (data && data.length > 0) {
          setBeats(data);
          // Set the queue for the audio player
          setQueue(data as unknown as AudioBeat[]);
        } else {
          setBeats(defaultBeats);
          setQueue(defaultBeats as unknown as AudioBeat[]);
        }
      })
      .catch((err: Error) => {
        console.error('Failed to fetch beats:', err);
        setBeats(defaultBeats);
        setQueue(defaultBeats as unknown as AudioBeat[]);
      });
  }, []);

  // Update queue when beats change
  useEffect(() => {
    if (beats.length > 0) {
      setQueue(beats as unknown as AudioBeat[]);
    }
  }, [beats, setQueue]);

  // Fetch liked beats when authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      fetch(`${API_URL}/customers/me/likes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then((res: Response) => res.ok ? res.json() : [])
        .then((data: Array<{ id: string | number }>) => {
          if (Array.isArray(data)) {
            setLikedBeats(new Set(data.map((b) => b.id)));
          }
        })
        .catch((err: Error) => console.error('Failed to fetch likes:', err));
    } else {
      setLikedBeats(new Set());
    }
  }, [isAuthenticated, token]);

  // Handle like button click
  const handleLikeClick = async (beat: Beat, e: MouseEvent<HTMLButtonElement>): Promise<void> => {
    e.stopPropagation();

    // If not authenticated, show auth modal
    if (!isAuthenticated) {
      setPendingLikeBeat(beat);
      setAuthActionType('like');
      setShowAuthModal(true);
      return;
    }

    await toggleLike(beat);
  };

  // Handle playlist button click
  const handlePlaylistClick = async (beat: Beat, e: MouseEvent<HTMLButtonElement>): Promise<void> => {
    e.stopPropagation();

    // If not authenticated, show auth modal
    if (!isAuthenticated) {
      setBeatForPlaylist(beat);
      setAuthActionType('playlist');
      setShowAuthModal(true);
      return;
    }

    // Open playlist modal
    setBeatForPlaylist(beat);
    setShowPlaylistModal(true);
    await fetchPlaylists(beat.id);
  };

  // Fetch user's playlists and check which contain the beat
  const fetchPlaylists = async (beatId: string | number): Promise<void> => {
    setPlaylistLoading(true);
    try {
      const res = await fetch(`${API_URL}/customers/me/playlists`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data: Playlist[] = await res.json();
        setPlaylists(data);

        // Check which playlists contain this beat
        const savedIn = new Set<string>();
        for (const playlist of data) {
          if (playlist.beats?.some((b) => b.id === beatId)) {
            savedIn.add(playlist.id);
          }
        }
        setSavedInPlaylists(savedIn);
      }
    } catch (err) {
      console.error('Failed to fetch playlists:', err);
      toast.error('Failed to load playlists', 'Please try again');
    } finally {
      setPlaylistLoading(false);
    }
  };

  // Toggle beat in playlist
  const toggleBeatInPlaylist = async (playlistId: string): Promise<void> => {
    if (!beatForPlaylist) return;

    const isInPlaylist = savedInPlaylists.has(playlistId);
    const playlist = playlists.find((p: Playlist) => p.id === playlistId);

    // Optimistic update
    setSavedInPlaylists((prev: Set<string>) => {
      const newSet = new Set(prev);
      if (isInPlaylist) {
        newSet.delete(playlistId);
      } else {
        newSet.add(playlistId);
      }
      return newSet;
    });

    try {
      let res: Response;
      if (isInPlaylist) {
        // Remove from playlist
        res = await fetch(`${API_URL}/playlists/${playlistId}/beats/${beatForPlaylist.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } else {
        // Add to playlist using the correct endpoint
        res = await fetch(`${API_URL}/beats/${beatForPlaylist.id}/save`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ playlistId })
        });
      }

      if (!res.ok) throw new Error('Failed to update playlist');

      toast.success(
        isInPlaylist ? 'Removed from playlist' : 'Added to playlist',
        playlist?.name || 'Playlist'
      );
    } catch (err) {
      // Revert optimistic update
      setSavedInPlaylists((prev: Set<string>) => {
        const newSet = new Set(prev);
        if (isInPlaylist) {
          newSet.add(playlistId);
        } else {
          newSet.delete(playlistId);
        }
        return newSet;
      });
      toast.error('Failed to update', 'Please try again');
    }
  };

  // Create new playlist
  const createPlaylist = async (): Promise<void> => {
    if (!newPlaylistName.trim() || !beatForPlaylist) return;

    setCreatingPlaylist(true);
    try {
      const res = await fetch(`${API_URL}/customers/me/playlists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newPlaylistName.trim() })
      });

      if (!res.ok) throw new Error('Failed to create playlist');

      const newPlaylist: Playlist = await res.json();

      // Add beat to the new playlist using the correct endpoint
      const addRes = await fetch(`${API_URL}/beats/${beatForPlaylist.id}/save`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ playlistId: newPlaylist.id })
      });

      if (!addRes.ok) throw new Error('Failed to add beat to playlist');

      setPlaylists((prev: Playlist[]) => [...prev, newPlaylist]);
      setSavedInPlaylists((prev: Set<string>) => new Set(prev).add(newPlaylist.id));
      setNewPlaylistName('');
      toast.success('Playlist created', `${beatForPlaylist.title} added to "${newPlaylist.name}"`);
    } catch (err) {
      toast.error('Failed to create playlist', 'Please try again');
    } finally {
      setCreatingPlaylist(false);
    }
  };

  // Toggle like for a beat
  const toggleLike = async (beat: Beat): Promise<void> => {
    const beatId = beat.id;
    const isLiked = likedBeats.has(beatId);

    // Optimistic update for liked state
    setLikedBeats((prev: Set<string | number>) => {
      const newSet = new Set(prev);
      if (isLiked) {
        newSet.delete(beatId);
      } else {
        newSet.add(beatId);
      }
      return newSet;
    });

    // Optimistic update for like count
    setBeats((prev: Beat[]) => prev.map((b: Beat) =>
      b.id === beatId
        ? { ...b, likeCount: (b.likeCount || 0) + (isLiked ? -1 : 1) }
        : b
    ));

    // Set loading
    setLikeLoading((prev: Set<string | number>) => new Set(prev).add(beatId));

    try {
      const res = await fetch(`${API_URL}/beats/${beatId}/like`, {
        method: isLiked ? 'DELETE' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        throw new Error('Failed to update like');
      }

      // Show success toast
      toast.success(
        isLiked ? 'Removed from Liked Beats' : 'Added to Liked Beats',
        beat.title
      );
    } catch (err) {
      // Revert optimistic update on error
      setLikedBeats((prev: Set<string | number>) => {
        const newSet = new Set(prev);
        if (isLiked) {
          newSet.add(beatId);
        } else {
          newSet.delete(beatId);
        }
        return newSet;
      });
      // Revert like count
      setBeats((prev: Beat[]) => prev.map((b: Beat) =>
        b.id === beatId
          ? { ...b, likeCount: (b.likeCount || 0) + (isLiked ? 1 : -1) }
          : b
      ));
      toast.error('Failed to update', 'Please try again');
    } finally {
      setLikeLoading((prev: Set<string | number>) => {
        const newSet = new Set(prev);
        newSet.delete(beatId);
        return newSet;
      });
    }
  };

  // Handle auth success - complete the pending action
  const handleAuthSuccess = async (authenticatedCustomer: Customer): Promise<void> => {
    setShowAuthModal(false);
    toast.success('Welcome!', authenticatedCustomer.firstName ? `Good to see you, ${authenticatedCustomer.firstName}` : 'Login successful');

    // Small delay to ensure token is set
    setTimeout(async () => {
      if (authActionType === 'like' && pendingLikeBeat) {
        await toggleLike(pendingLikeBeat);
        setPendingLikeBeat(null);
      } else if (authActionType === 'playlist' && beatForPlaylist) {
        setShowPlaylistModal(true);
        await fetchPlaylists(beatForPlaylist.id);
      }
    }, 100);
  };

  const genres: string[] = ['All', ...new Set(beats.map((b: Beat) => b.genre))];

  const filteredBeats: Beat[] = beats.filter((beat: Beat) => {
    const matchesGenre = activeGenre === 'All' || beat.genre === activeGenre;
    const matchesSearch = searchQuery === '' ||
      beat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      beat.tags?.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesGenre && matchesSearch;
  });

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLicenseClick = (beat: Beat): void => {
    setSelectedBeatForLicense(beat);
  };

  const handleAddToCart = (license: LicenseTier): void => {
    if (selectedBeatForLicense) {
      const added = addToCart(selectedBeatForLicense as any, license);
      if (added) {
        toast.success(
          'Added to Cart',
          `${selectedBeatForLicense.title} - ${license.name}`,
          {
            action: () => setIsCartOpen(true),
            actionLabel: 'View Cart',
          }
        );
      } else {
        toast.warning(
          'Already in Cart',
          `${selectedBeatForLicense.title} with ${license.name} is already in your cart`
        );
      }
      setSelectedBeatForLicense(null);
      setIsCartOpen(true);
    }
  };

  const handlePlayBeat = (beatId: string | number): void => {
    // Pass the full beats array so queue is set correctly
    playBeat(beatId, beats as unknown as AudioBeat[]);
  };

  return (
    <div className="beats-page-v2">
      {/* Hero Section */}
      <section className="beats-hero-v2">
        <div className="beats-hero-bg-v2"></div>
        <div className="beats-hero-content-v2">
          <h1>Beat Store</h1>
          <p>Premium instrumentals for serious artists</p>

          {/* Search Bar */}
          <div className="beats-search-bar">
            <i className="fas fa-search" aria-hidden="true"></i>
            <input
              type="text"
              placeholder="Search beats by title, mood, or style..."
              value={searchQuery}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              aria-label="Search beats"
            />
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <div className="beats-toolbar">
        <div className="beats-genres" role="group" aria-label="Filter beats by genre">
          {genres.map((genre: string) => (
            <button
              key={genre}
              className={`genre-btn ${activeGenre === genre ? 'active' : ''}`}
              onClick={() => setActiveGenre(genre)}
              aria-pressed={activeGenre === genre}
            >
              {genre}
            </button>
          ))}
        </div>
        <div className="beats-count">
          {filteredBeats.length} beat{filteredBeats.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Beats List */}
      <div className="beats-list-container">
        {/* List Header */}
        <div className="beats-list-header" role="row" aria-hidden="true">
          <div className="col-play">#</div>
          <div className="col-title-group">Title</div>
          <div className="col-progress"></div>
          <div className="col-bpm">BPM</div>
          <div className="col-key">Key</div>
          <div className="col-actions"></div>
        </div>

        {/* Beats Rows */}
        <div className="beats-list">
          {filteredBeats.map((beat: Beat, index: number) => {
            const isCurrentBeat = currentBeat?.id === beat.id;
            const isThisPlaying = isCurrentBeat && isPlaying;
            const progress = isCurrentBeat && duration > 0 ? (currentTime / duration) * 100 : 0;

            return (
              <div key={beat.id} className={`beat-row-wrapper ${isCurrentBeat ? 'active' : ''}`}>
                <div className={`beat-row ${isCurrentBeat ? 'active' : ''}`}>
                  {/* Play Button / Index */}
                  <div className="col-play">
                    <button
                      className="row-play-btn"
                      onClick={() => handlePlayBeat(beat.id)}
                      aria-label={isThisPlaying ? `Pause ${beat.title}` : `Play ${beat.title}`}
                    >
                      {isThisPlaying ? (
                        <i className="fas fa-pause" aria-hidden="true"></i>
                      ) : (
                        <>
                          <span className="row-index">{index + 1}</span>
                          <i className="fas fa-play row-play-icon" aria-hidden="true"></i>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Title & Producer + Inline Actions */}
                  <div className="col-title-group">
                    <div className="col-title" onClick={() => handlePlayBeat(beat.id)}>
                      <div className="beat-artwork">
                        {beat.coverArt ? (
                          <img
                            src={beat.coverArt.startsWith('http') ? beat.coverArt : `${API_URL.replace('/api', '')}${beat.coverArt}`}
                            alt={beat.title}
                            className="artwork-image"
                          />
                        ) : (
                          <div className={`artwork-placeholder ${getGradientClass(beat.id)}`} aria-hidden="true">
                            <i className="fas fa-music"></i>
                          </div>
                        )}
                        {/* Play overlay - shown when this beat is playing */}
                        {isThisPlaying && (
                          <div className="artwork-play-overlay visible">
                            <i className="fas fa-pause"></i>
                          </div>
                        )}
                        {beat.soldExclusively && (
                          <div className="sold-badge-overlay" aria-label="This beat has been sold exclusively">
                            SOLD
                          </div>
                        )}
                      </div>
                      <div className="beat-info">
                        <span className="beat-title">
                          {beat.title}
                          {beat.soldExclusively && <span className="sold-inline-badge">SOLD</span>}
                        </span>
                        <span className="beat-producer">{beat.producedBy || beat.producer || 'Doc Rolds'}</span>
                      </div>
                    </div>
                    {/* Inline Actions: Heart, Plus, Comments */}
                    <div className="col-actions-inline">
                      <button
                        className={`beat-action-btn like-btn ${likedBeats.has(beat.id) ? 'liked' : ''}`}
                        onClick={(e: MouseEvent<HTMLButtonElement>) => handleLikeClick(beat, e)}
                        disabled={likeLoading.has(beat.id)}
                        aria-label={likedBeats.has(beat.id) ? `Unlike ${beat.title}` : `Like ${beat.title}`}
                        aria-pressed={likedBeats.has(beat.id)}
                      >
                        {likeLoading.has(beat.id) ? (
                          <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
                        ) : (
                          <i className={`${likedBeats.has(beat.id) ? 'fas' : 'far'} fa-heart`} aria-hidden="true"></i>
                        )}
                        {beat.likeCount && beat.likeCount > 0 && <span className="action-count">{beat.likeCount}</span>}
                      </button>
                      <button
                        className="beat-action-btn playlist-btn"
                        onClick={(e: MouseEvent<HTMLButtonElement>) => handlePlaylistClick(beat, e)}
                        aria-label={`Add ${beat.title} to playlist`}
                      >
                        <i className="fas fa-plus" aria-hidden="true"></i>
                      </button>
                      <button
                        className="beat-action-btn comment-btn"
                        onClick={(e: MouseEvent<HTMLButtonElement>) => handleCommentClick(beat, e)}
                        aria-label={`Comments on ${beat.title}`}
                      >
                        <i className="far fa-comment" aria-hidden="true"></i>
                        {beat.commentCount && beat.commentCount > 0 && <span className="action-count">{beat.commentCount}</span>}
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar - in middle */}
                  <div className="col-progress">
                    {isCurrentBeat ? (
                      <div className="middle-progress-wrapper">
                        <span className="progress-time-small">{formatTime(currentTime)}</span>
                        <div
                          className="middle-progress-bar"
                          onClick={(e: MouseEvent<HTMLDivElement>) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickX = e.clientX - rect.left;
                            const percent = clickX / rect.width;
                            const newTime = percent * (duration || beat.duration || 0);
                            seekTo(newTime);
                          }}
                        >
                          <div
                            className="middle-progress-fill"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                        <span className="progress-time-small">{formatTime(duration || beat.duration || 0)}</span>
                      </div>
                    ) : null}
                  </div>

                  {/* BPM */}
                  <div className="col-bpm">
                    {beat.bpm}
                  </div>

                  {/* Key */}
                  <div className="col-key">
                    {beat.key}
                  </div>

                  {/* Actions */}
                  <div className="col-actions">
                    {beat.soldExclusively ? (
                      <span className="license-btn sold" aria-label="This beat has been sold exclusively">
                        <i className="fas fa-check-circle" aria-hidden="true"></i>
                        Sold
                      </span>
                    ) : (
                      <button className="license-btn" onClick={() => handleLicenseClick(beat)} aria-label={`License ${beat.title}`}>
                        <i className="fas fa-shopping-cart" aria-hidden="true"></i>
                        License
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredBeats.length === 0 && (
          <div className="no-beats">
            <i className="fas fa-search" aria-hidden="true"></i>
            <p>No beats found matching your criteria</p>
          </div>
        )}
      </div>

      {/* License Selection Modal */}
      {selectedBeatForLicense && (
        <div className="license-modal-overlay" onClick={() => setSelectedBeatForLicense(null)} role="dialog" aria-modal="true" aria-labelledby="license-modal-title">
          <div className="license-modal" onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}>
            <div className="license-modal-header">
              <h3 id="license-modal-title">
                Select License for <span>"{selectedBeatForLicense.title}"</span>
              </h3>
              <button className="license-modal-close" onClick={() => setSelectedBeatForLicense(null)} aria-label="Close license selection">
                <i className="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>

            <div className="license-options">
              {licenseTiers.map((license: LicenseTier) => (
                <div
                  key={license.id}
                  className={`license-option ${license.id === 'unlimited' ? 'popular' : ''}`}
                >
                  <h4>{license.name}</h4>
                  <div className="license-price">
                    {license.price ? `$${license.price}` : 'Contact Us'}
                  </div>
                  <ul className="license-features">
                    {license.features.map((feature: string, idx: number) => (
                      <li key={idx}>
                        <i className="fas fa-check" aria-hidden="true"></i>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  {license.price ? (
                    <button
                      className="license-add-btn"
                      onClick={() => handleAddToCart(license)}
                      aria-label={`Add ${license.name} license to cart`}
                    >
                      <i className="fas fa-cart-plus" aria-hidden="true"></i> Add to Cart
                    </button>
                  ) : (
                    <Link
                      to={`/contact?message=${encodeURIComponent(
                        `Hi, I'm interested in Exclusive Rights licensing for "${selectedBeatForLicense?.title}". Please reach out with pricing and details.`
                      )}`}
                      className="license-add-btn contact"
                      onClick={() => setSelectedBeatForLicense(null)}
                    >
                      <i className="fas fa-envelope" aria-hidden="true"></i> Contact Us
                    </Link>
                  )}
                  <Link
                    to={`/licenses?type=${license.id}`}
                    className="license-terms-link"
                    onClick={() => setSelectedBeatForLicense(null)}
                  >
                    View Full Terms <i className="fas fa-external-link-alt" aria-hidden="true"></i>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Auth Prompt Modal */}
      <AuthPromptModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          setPendingLikeBeat(null);
          setBeatForPlaylist(null);
        }}
        onSuccess={handleAuthSuccess}
        onError={(msg: string) => {
          // Error is handled inside the modal
          console.error('Auth error:', msg);
        }}
      />

      {/* Playlist Modal */}
      {showPlaylistModal && beatForPlaylist && (
        <div
          className="playlist-modal-overlay"
          onClick={() => {
            setShowPlaylistModal(false);
            setBeatForPlaylist(null);
            setNewPlaylistName('');
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="playlist-modal-title"
        >
          <div className="playlist-modal" onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}>
            <div className="playlist-modal-header">
              <div className="playlist-modal-title-section">
                <h3 id="playlist-modal-title">Add to Playlist</h3>
                <p className="playlist-modal-beat-name">{beatForPlaylist.title}</p>
              </div>
              <button
                className="playlist-modal-close"
                onClick={() => {
                  setShowPlaylistModal(false);
                  setBeatForPlaylist(null);
                  setNewPlaylistName('');
                }}
                aria-label="Close"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="playlist-modal-content">
              {playlistLoading ? (
                <div className="playlist-loading">
                  <i className="fas fa-spinner fa-spin"></i>
                  <span>Loading playlists...</span>
                </div>
              ) : (
                <>
                  {/* Playlist List */}
                  <div className="playlist-list">
                    {playlists.length === 0 ? (
                      <p className="playlist-empty">No playlists yet. Create one below!</p>
                    ) : (
                      playlists.map((playlist: Playlist) => (
                        <button
                          key={playlist.id}
                          className={`playlist-item ${savedInPlaylists.has(playlist.id) ? 'active' : ''}`}
                          onClick={() => toggleBeatInPlaylist(playlist.id)}
                        >
                          <div className="playlist-item-icon">
                            {savedInPlaylists.has(playlist.id) ? (
                              <i className="fas fa-check"></i>
                            ) : (
                              <i className="fas fa-music"></i>
                            )}
                          </div>
                          <div className="playlist-item-info">
                            <span className="playlist-item-name">{playlist.name}</span>
                            <span className="playlist-item-count">
                              {playlist.beats?.length || 0} beat{(playlist.beats?.length || 0) !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {playlist.isDefault && (
                            <span className="playlist-default-badge">Default</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>

                  {/* Create New Playlist */}
                  <div className="playlist-create-section">
                    <div className="playlist-create-form">
                      <input
                        type="text"
                        placeholder="New playlist name..."
                        value={newPlaylistName}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setNewPlaylistName(e.target.value)}
                        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && createPlaylist()}
                        disabled={creatingPlaylist}
                      />
                      <button
                        className="playlist-create-btn"
                        onClick={createPlaylist}
                        disabled={!newPlaylistName.trim() || creatingPlaylist}
                      >
                        {creatingPlaylist ? (
                          <i className="fas fa-spinner fa-spin"></i>
                        ) : (
                          <i className="fas fa-plus"></i>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Comments Modal */}
      {showCommentsModal && beatForComments && (
        <div
          className="comments-modal-overlay"
          onClick={() => {
            setShowCommentsModal(false);
            setBeatForComments(null);
            setComments([]);
            setNewComment('');
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="comments-modal-title"
        >
          <div className="comments-modal" onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}>
            <div className="comments-modal-header">
              <div className="comments-modal-title-section">
                <h3 id="comments-modal-title">Comments</h3>
                <p className="comments-modal-beat-name">{beatForComments.title}</p>
              </div>
              <button
                className="comments-modal-close"
                onClick={() => {
                  setShowCommentsModal(false);
                  setBeatForComments(null);
                  setComments([]);
                  setNewComment('');
                }}
                aria-label="Close"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="comments-modal-content">
              {/* Add Comment Form */}
              {isAuthenticated ? (
                <div className="comment-form">
                  <div className="comment-form-avatar">
                    {customer?.profilePicture ? (
                      <img
                        src={customer.profilePicture.startsWith('http')
                          ? customer.profilePicture
                          : `${API_URL.replace('/api', '')}${customer.profilePicture}`}
                        alt={customer.firstName || 'You'}
                      />
                    ) : (
                      <i className="fas fa-user"></i>
                    )}
                  </div>
                  <div className="comment-form-input-wrapper">
                    <textarea
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNewComment(e.target.value)}
                      maxLength={1000}
                      rows={2}
                    />
                    <button
                      className="comment-submit-btn"
                      onClick={submitComment}
                      disabled={!newComment.trim() || submittingComment}
                    >
                      {submittingComment ? (
                        <i className="fas fa-spinner fa-spin"></i>
                      ) : (
                        <i className="fas fa-paper-plane"></i>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="comment-login-prompt">
                  <p>
                    <Link to="/login" onClick={() => setShowCommentsModal(false)}>Sign in</Link>
                    {' '}to leave a comment
                  </p>
                </div>
              )}

              {/* Comments List */}
              <div className="comments-list">
                {commentsLoading ? (
                  <div className="comments-loading">
                    <i className="fas fa-spinner fa-spin"></i>
                    <span>Loading comments...</span>
                  </div>
                ) : comments.length === 0 ? (
                  <div className="comments-empty">
                    <i className="far fa-comment-dots"></i>
                    <p>No comments yet. Be the first to comment!</p>
                  </div>
                ) : (
                  comments.map((comment: Comment) => (
                    <div key={comment.id} className="comment-thread">
                      <div className="comment-item">
                        <div className="comment-avatar">
                          {comment.customer?.profilePicture ? (
                            <img
                              src={comment.customer.profilePicture.startsWith('http')
                                ? comment.customer.profilePicture
                                : `${API_URL.replace('/api', '')}${comment.customer.profilePicture}`}
                              alt={comment.customer.stageName || comment.customer.firstName || 'User'}
                            />
                          ) : (
                            <i className="fas fa-user"></i>
                          )}
                        </div>
                        <div className="comment-content">
                          <div className="comment-header">
                            <span className="comment-author">
                              {comment.customer?.stageName || comment.customer?.firstName || 'Anonymous'}
                            </span>
                            <span className="comment-date">
                              {new Date(comment.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: comment.createdAt && new Date(comment.createdAt).getFullYear() !== new Date().getFullYear()
                                  ? 'numeric'
                                  : undefined
                              })}
                            </span>
                          </div>
                          <p className="comment-text">{comment.content}</p>
                          <div className="comment-actions">
                            <button
                              className={`comment-like-btn ${likedComments.has(comment.id) ? 'liked' : ''}`}
                              onClick={() => toggleCommentLike(comment.id)}
                            >
                              <i className={`${likedComments.has(comment.id) ? 'fas' : 'far'} fa-heart`}></i>
                              {comment.likeCount && comment.likeCount > 0 && <span>{comment.likeCount}</span>}
                            </button>
                            <button
                              className="comment-reply-btn"
                              onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                            >
                              <i className="far fa-comment"></i>
                              Reply
                            </button>
                            {customer?.id === comment.customerId && (
                              <button
                                className="comment-delete-btn"
                                onClick={() => deleteComment(comment.id)}
                                aria-label="Delete comment"
                              >
                                <i className="fas fa-trash-alt"></i>
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Reply Form */}
                      {replyingTo === comment.id && isAuthenticated && (
                        <div className="reply-form">
                          <div className="reply-form-avatar">
                            {customer?.profilePicture ? (
                              <img
                                src={customer.profilePicture.startsWith('http')
                                  ? customer.profilePicture
                                  : `${API_URL.replace('/api', '')}${customer.profilePicture}`}
                                alt={customer.firstName || 'You'}
                              />
                            ) : (
                              <i className="fas fa-user"></i>
                            )}
                          </div>
                          <div className="reply-form-input-wrapper">
                            <textarea
                              placeholder={`Reply to ${comment.customer?.stageName || comment.customer?.firstName || 'Anonymous'}...`}
                              value={replyText}
                              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReplyText(e.target.value)}
                              maxLength={1000}
                              rows={2}
                              autoFocus
                            />
                            <div className="reply-form-buttons">
                              <button
                                className="reply-cancel-btn"
                                onClick={() => {
                                  setReplyingTo(null);
                                  setReplyText('');
                                }}
                              >
                                Cancel
                              </button>
                              <button
                                className="reply-submit-btn"
                                onClick={() => submitReply(comment.id)}
                                disabled={!replyText.trim() || submittingComment}
                              >
                                {submittingComment ? (
                                  <i className="fas fa-spinner fa-spin"></i>
                                ) : (
                                  'Reply'
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Replies */}
                      {comment.replies && comment.replies.length > 0 && (
                        <div className="replies-list">
                          {comment.replies.map((reply: Comment) => (
                            <div key={reply.id} className="comment-item reply">
                              <div className="comment-avatar">
                                {reply.customer?.profilePicture ? (
                                  <img
                                    src={reply.customer.profilePicture.startsWith('http')
                                      ? reply.customer.profilePicture
                                      : `${API_URL.replace('/api', '')}${reply.customer.profilePicture}`}
                                    alt={reply.customer.stageName || reply.customer.firstName || 'User'}
                                  />
                                ) : (
                                  <i className="fas fa-user"></i>
                                )}
                              </div>
                              <div className="comment-content">
                                <div className="comment-header">
                                  <span className="comment-author">
                                    {reply.customer?.stageName || reply.customer?.firstName || 'Anonymous'}
                                  </span>
                                  <span className="comment-date">
                                    {new Date(reply.createdAt).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: reply.createdAt && new Date(reply.createdAt).getFullYear() !== new Date().getFullYear()
                                        ? 'numeric'
                                        : undefined
                                    })}
                                  </span>
                                </div>
                                <p className="comment-text">{reply.content}</p>
                                <div className="comment-actions">
                                  <button
                                    className={`comment-like-btn ${likedComments.has(reply.id) ? 'liked' : ''}`}
                                    onClick={() => toggleCommentLike(reply.id, true, comment.id)}
                                  >
                                    <i className={`${likedComments.has(reply.id) ? 'fas' : 'far'} fa-heart`}></i>
                                    {reply.likeCount && reply.likeCount > 0 && <span>{reply.likeCount}</span>}
                                  </button>
                                  {customer?.id === reply.customerId && (
                                    <button
                                      className="comment-delete-btn"
                                      onClick={() => deleteComment(reply.id, true, comment.id)}
                                      aria-label="Delete reply"
                                    >
                                      <i className="fas fa-trash-alt"></i>
                                      Delete
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BeatsPage;
