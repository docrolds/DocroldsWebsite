import { useState, useEffect, ChangeEvent, FormEvent, ReactNode } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useToast } from '../context/NotificationContext';
import { API_URL } from '../config';

interface StemSubmissionSummary {
  id: string;
  songName: string;
  artistName: string;
  notes: string | null;
  fileCount: number;
  createdAt: string;
}

interface BookingStemsInfo {
  bookingNumber: string;
  name: string;
  category: string;
  submissions: StemSubmissionSummary[];
}

type StemsStep = 'loading' | 'form' | 'success' | 'error';

export default function StemsUploadPage(): ReactNode {
  const { bookingNumber } = useParams<{ bookingNumber: string }>();
  const [searchParams] = useSearchParams();
  const accessKey = searchParams.get('key') || '';
  const toast = useToast();

  const [step, setStep] = useState<StemsStep>('loading');
  const [booking, setBooking] = useState<BookingStemsInfo | null>(null);
  const [error, setError] = useState<string>('');

  const [songName, setSongName] = useState('');
  const [artistName, setArtistName] = useState('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (bookingNumber) {
      fetchBookingStemsInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingNumber]);

  const fetchBookingStemsInfo = async (): Promise<void> => {
    setStep('loading');
    setError('');
    try {
      const res = await fetch(`${API_URL}/stems/booking/${bookingNumber}?key=${accessKey}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Unable to load booking');
        setStep('error');
        return;
      }

      setBooking(data);
      setStep('form');
    } catch (err) {
      console.error('Error fetching booking stems info:', err);
      setError('Unable to connect to server');
      setStep('error');
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setFiles(e.target.files ? Array.from(e.target.files) : []);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (!songName.trim() || !artistName.trim()) {
      toast.error('Song name and artist name are required');
      return;
    }
    if (files.length === 0) {
      toast.error('Please select at least one audio file');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('songName', songName.trim());
      formData.append('artistName', artistName.trim());
      formData.append('notes', notes.trim());
      files.forEach((file) => formData.append('stems', file));

      const res = await fetch(`${API_URL}/stems/booking/${bookingNumber}?key=${accessKey}`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit stems');
      }

      setStep('success');
      toast.success('Stems submitted successfully!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit stems';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'loading') {
    return (
      <div className="reschedule-page">
        <div className="rp-wrapper">
          <div className="rp-loading">
            <i className="fas fa-spinner fa-spin"></i>
            <p>Loading booking details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="reschedule-page">
        <div className="rp-wrapper">
          <div className="rp-content">
            <div className="rp-error-step">
              <div className="rp-icon error">
                <i className="fas fa-exclamation-triangle"></i>
              </div>
              <h2>Unable to Load Stems Upload</h2>
              <p className="rp-error-message">{error}</p>
              <div className="rp-error-help">
                <p>Need help? Contact us:</p>
                <p><strong>(727) 282-5449</strong></p>
              </div>
              <div className="rp-error-actions">
                <Link to="/" className="rp-btn-secondary">Return Home</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="reschedule-page">
        <div className="rp-wrapper">
          <div className="rp-content">
            <div className="rp-success-step">
              <div className="rp-icon success">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h2>Stems Received!</h2>
              <p className="rp-booking-ref">Booking #{bookingNumber}</p>
              <p>We've got your tracks for "{songName}" - a confirmation email is on its way.</p>
              <div className="rp-success-actions">
                <Link to="/" className="rp-btn-primary">Done</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reschedule-page">
      <div className="rp-wrapper">
        <div className="rp-content">
          <div className="rp-verify-step">
            <div className="rp-icon">
              <i className="fas fa-cloud-upload-alt"></i>
            </div>

            <h2>Upload Your Stems</h2>
            <p className="rp-booking-ref">Booking #{booking?.bookingNumber}</p>

            {booking && booking.submissions.length > 0 && (
              <div className="rp-current-booking">
                <h3>Previous Submissions</h3>
                {booking.submissions.map((s) => (
                  <div className="rp-booking-details" key={s.id}>
                    <div className="rp-detail-row">
                      <span>{s.songName} - {s.artistName}</span>
                      <span>{s.fileCount} file{s.fileCount === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit} className="rp-verify-form">
              <div className="rp-form-field">
                <input
                  type="text"
                  value={songName}
                  onChange={(e) => setSongName(e.target.value)}
                  placeholder="Song title"
                  required
                />
              </div>
              <div className="rp-form-field">
                <input
                  type="text"
                  value={artistName}
                  onChange={(e) => setArtistName(e.target.value)}
                  placeholder="Artist name"
                  required
                />
              </div>
              <div className="rp-form-field">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Reference track / mix notes (optional)"
                  rows={4}
                />
              </div>
              <div className="rp-form-field">
                <input
                  type="file"
                  accept="audio/*"
                  multiple
                  onChange={handleFileChange}
                  required
                />
                {files.length > 0 && (
                  <p style={{ fontSize: '0.85rem', color: '#999', marginTop: '8px' }}>
                    {files.length} file{files.length === 1 ? '' : 's'} selected
                  </p>
                )}
              </div>

              <button type="submit" className="rp-btn-primary" disabled={loading}>
                {loading ? 'Uploading...' : 'Submit Stems'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
