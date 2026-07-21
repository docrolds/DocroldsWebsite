import { useState, useEffect, ReactNode } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { DayPicker } from 'react-day-picker';
import { format, addDays, isBefore, startOfDay } from 'date-fns';
import { useToast } from '../context/NotificationContext';
import { API_URL } from '../config';
import 'react-day-picker/dist/style.css';

// ============================================
// Type Definitions
// ============================================

interface BookingDetails {
  id: string;
  bookingNumber: string;
  name: string;
  email: string;
  category: string;
  hours: number | null;
  mixingTier: string | null;
  scheduledAt: string | null;
  status: string;
  sessionPrice: number;
  depositAmount: number;
  balanceAmount: number;
}

interface TimeSlot {
  startAt: string;
}

interface AvailabilityDay {
  date: string;
  slots: TimeSlot[];
}

type RescheduleStep = 'verify' | 'select' | 'confirm' | 'success' | 'error';

// ============================================
// ReschedulePage Component
// ============================================

export default function ReschedulePage(): ReactNode {
  const { bookingNumber } = useParams<{ bookingNumber: string }>();
  const [searchParams] = useSearchParams();
  const rescheduleKey = searchParams.get('key') || '';
  const toast = useToast();

  // Step management
  const [step, setStep] = useState<RescheduleStep>('verify');

  // Booking data
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [email, setEmail] = useState('');

  // Scheduling
  const [availabilities, setAvailabilities] = useState<AvailabilityDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // UI state
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Computed values
  const availableDates = availabilities.map(a => new Date(a.date + 'T00:00:00'));
  const timeSlotsForDate = selectedDate
    ? availabilities.find(a => a.date === format(selectedDate, 'yyyy-MM-dd'))?.slots || []
    : [];

  // ============================================
  // Effects
  // ============================================

  useEffect(() => {
    if (bookingNumber) {
      fetchBookingDetails();
    }
  }, [bookingNumber]);

  useEffect(() => {
    if (step === 'select') {
      fetchAvailability();
    }
  }, [step]);

  // ============================================
  // Data Fetching
  // ============================================

  const fetchBookingDetails = async (): Promise<void> => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/bookings/reschedule/${bookingNumber}?key=${rescheduleKey}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Unable to load booking');
        setStep('error');
        return;
      }

      setBooking(data);
      setStep('verify');
    } catch (err) {
      console.error('Error fetching booking:', err);
      setError('Unable to connect to server');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailability = async (): Promise<void> => {
    setLoading(true);
    try {
      const startDate = format(new Date(), 'yyyy-MM-dd');
      const endDate = format(addDays(new Date(), 60), 'yyyy-MM-dd');

      const res = await fetch(`${API_URL}/bookings/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionType: 'STARTER', startDate, endDate })
      });

      if (!res.ok) throw new Error('Failed to fetch availability');
      const data = await res.json();

      const rawSlots = data.availabilities || [];
      const groupedByDate: Record<string, TimeSlot[]> = {};

      rawSlots.forEach((slot: { startAt: string }) => {
        const dateStr = slot.startAt.split('T')[0];
        if (!groupedByDate[dateStr]) {
          groupedByDate[dateStr] = [];
        }
        groupedByDate[dateStr].push({ startAt: slot.startAt });
      });

      const formattedAvailabilities: AvailabilityDay[] = Object.entries(groupedByDate)
        .map(([date, slots]) => ({ date, slots }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setAvailabilities(formattedAvailabilities);
    } catch (err) {
      console.error('Error fetching availability:', err);
      toast.error('Failed to load availability');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // Handlers
  // ============================================

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setError('Please enter your email');
      return;
    }

    if (booking && email.toLowerCase() !== booking.email.toLowerCase()) {
      setError('Email does not match the booking');
      return;
    }

    setError('');
    setStep('select');
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedTime(null);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

  const handleConfirm = () => {
    if (selectedDate && selectedTime) {
      setStep('confirm');
    }
  };

  const handleReschedule = async (): Promise<void> => {
    if (!selectedTime || !booking) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/bookings/reschedule/${bookingNumber}?key=${rescheduleKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newDateTime: selectedTime,
          email: email
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Failed to reschedule');
        return;
      }

      setStep('success');
      toast.success('Booking rescheduled successfully!');
    } catch (err) {
      console.error('Error rescheduling:', err);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (isoString: string): string => {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDateTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const disabledDays = (date: Date): boolean => {
    const today = startOfDay(new Date());
    if (isBefore(date, today)) return true;
    const dateStr = format(date, 'yyyy-MM-dd');
    return !availabilities.some(a => a.date === dateStr);
  };

  const getServiceLabel = (): string => {
    if (!booking) return '';
    switch (booking.category) {
      case 'RECORDING':
        return `${booking.hours || 1} Hour Recording Session`;
      case 'MIXING':
        return `${booking.mixingTier || 'Standard'} Mixing Service`;
      case 'MASTERING':
        return `${booking.mixingTier || 'Digital'} Mastering Service`;
      case 'CONSULTING':
        return 'Consultation Call';
      case 'PROMO':
        return 'Promo Package';
      default:
        return booking.category;
    }
  };

  // ============================================
  // Render Functions
  // ============================================

  const renderVerifyStep = (): ReactNode => (
    <div className="rp-verify-step">
      <div className="rp-icon">
        <i className="fas fa-calendar-alt"></i>
      </div>

      <h2>Reschedule Your Booking</h2>
      <p className="rp-booking-ref">Booking #{bookingNumber}</p>

      {booking && (
        <div className="rp-current-booking">
          <h3>Current Booking</h3>
          <div className="rp-booking-details">
            <div className="rp-detail-row">
              <span>Service</span>
              <span>{getServiceLabel()}</span>
            </div>
            <div className="rp-detail-row">
              <span>Scheduled</span>
              <span>{booking.scheduledAt ? formatDateTime(booking.scheduledAt) : 'Not scheduled'}</span>
            </div>
            <div className="rp-detail-row">
              <span>Customer</span>
              <span>{booking.name}</span>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleVerify} className="rp-verify-form">
        <p>Please verify your email to continue:</p>
        <div className="rp-form-field">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            required
          />
        </div>

        {error && <div className="rp-error">{error}</div>}

        <button type="submit" className="rp-btn-primary" disabled={loading}>
          {loading ? 'Verifying...' : 'Continue'}
        </button>
      </form>

      <p className="rp-terms-reminder">
        <i className="fas fa-info-circle"></i>
        Reschedules must be made at least 24 hours before your session
      </p>
    </div>
  );

  const renderSelectStep = (): ReactNode => (
    <div className="rp-select-step">
      <button className="rp-back-link" onClick={() => setStep('verify')}>
        <i className="fas fa-arrow-left"></i> Back
      </button>

      <div className="rp-step-header">
        <h2>Select New Date & Time</h2>
        <p>Choose a new slot for your session</p>
      </div>

      <div className="rp-schedule-layout">
        <div className="rp-calendar-section">
          <h3>Select Date</h3>
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            disabled={disabledDays}
            modifiers={{ available: availableDates }}
            modifiersClassNames={{ available: 'bp-day-available', selected: 'bp-day-selected' }}
            fromDate={new Date()}
            toDate={addDays(new Date(), 60)}
            className="bp-calendar"
          />
          {loading && <div className="rp-calendar-loading">Loading availability...</div>}
        </div>

        <div className="rp-timeslots-section">
          <h3>{selectedDate ? format(selectedDate, 'EEEE, MMMM d') : 'Available Times'}</h3>

          {selectedDate ? (
            timeSlotsForDate.length > 0 ? (
              <div className="rp-timeslots-grid">
                {timeSlotsForDate.map((slot, idx) => (
                  <button
                    key={idx}
                    className={`rp-timeslot ${selectedTime === slot.startAt ? 'selected' : ''}`}
                    onClick={() => handleTimeSelect(slot.startAt)}
                  >
                    {formatTime(slot.startAt)}
                  </button>
                ))}
              </div>
            ) : (
              <div className="rp-no-slots">
                <p>No available times for this date</p>
                <span>Please select another date</span>
              </div>
            )
          ) : (
            <div className="rp-no-slots">
              <p>Select a date to see available times</p>
            </div>
          )}
        </div>
      </div>

      {selectedTime && (
        <div className="rp-schedule-footer">
          <div className="rp-schedule-summary">
            <span>{selectedDate && format(selectedDate, 'MMM d, yyyy')}</span>
            <span className="rp-dot">•</span>
            <span>{formatTime(selectedTime)}</span>
          </div>
          <button className="rp-btn-primary" onClick={handleConfirm}>
            Confirm Reschedule
          </button>
        </div>
      )}
    </div>
  );

  const renderConfirmStep = (): ReactNode => (
    <div className="rp-confirm-step">
      <button className="rp-back-link" onClick={() => setStep('select')}>
        <i className="fas fa-arrow-left"></i> Back
      </button>

      <div className="rp-icon warning">
        <i className="fas fa-exchange-alt"></i>
      </div>

      <h2>Confirm Reschedule</h2>
      <p>Please review the changes below:</p>

      <div className="rp-change-comparison">
        <div className="rp-old-time">
          <h4>Original Time</h4>
          <p className="strikethrough">
            {booking?.scheduledAt ? formatDateTime(booking.scheduledAt) : 'Not set'}
          </p>
        </div>
        <div className="rp-arrow">
          <i className="fas fa-arrow-right"></i>
        </div>
        <div className="rp-new-time">
          <h4>New Time</h4>
          <p className="highlight">
            {selectedTime ? formatDateTime(selectedTime) : ''}
          </p>
        </div>
      </div>

      {error && <div className="rp-error">{error}</div>}

      <div className="rp-confirm-actions">
        <button className="rp-btn-secondary" onClick={() => setStep('select')}>
          Change Selection
        </button>
        <button
          className="rp-btn-primary"
          onClick={handleReschedule}
          disabled={loading}
        >
          {loading ? 'Processing...' : 'Confirm Reschedule'}
        </button>
      </div>
    </div>
  );

  const renderSuccessStep = (): ReactNode => (
    <div className="rp-success-step">
      <div className="rp-icon success">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>

      <h2>Rescheduled!</h2>
      <p className="rp-booking-ref">Booking #{bookingNumber}</p>

      <div className="rp-success-details">
        <div className="rp-detail-row">
          <span>New Date & Time</span>
          <span className="highlight">{selectedTime ? formatDateTime(selectedTime) : ''}</span>
        </div>
        <div className="rp-detail-row">
          <span>Service</span>
          <span>{getServiceLabel()}</span>
        </div>
      </div>

      <p className="rp-email-notice">
        A confirmation email has been sent to<br />
        <strong>{email}</strong>
      </p>

      <div className="rp-success-actions">
        <Link to="/" className="rp-btn-primary">Done</Link>
      </div>
    </div>
  );

  const renderErrorStep = (): ReactNode => (
    <div className="rp-error-step">
      <div className="rp-icon error">
        <i className="fas fa-exclamation-triangle"></i>
      </div>

      <h2>Unable to Reschedule</h2>
      <p className="rp-error-message">{error}</p>

      <div className="rp-error-help">
        <p>Need help? Contact us:</p>
        <p><strong>(727) 282-5449</strong></p>
      </div>

      <div className="rp-error-actions">
        <Link to="/" className="rp-btn-secondary">Return Home</Link>
        <button className="rp-btn-primary" onClick={fetchBookingDetails}>
          Try Again
        </button>
      </div>
    </div>
  );

  // ============================================
  // Loading State
  // ============================================

  if (loading && step === 'verify' && !booking) {
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

  // ============================================
  // Main Render
  // ============================================

  return (
    <div className="reschedule-page">
      <div className="rp-wrapper">
        <div className="rp-content">
          {step === 'verify' && renderVerifyStep()}
          {step === 'select' && renderSelectStep()}
          {step === 'confirm' && renderConfirmStep()}
          {step === 'success' && renderSuccessStep()}
          {step === 'error' && renderErrorStep()}
        </div>
      </div>
    </div>
  );
}
