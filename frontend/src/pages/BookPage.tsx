import { useState, useEffect, useRef, ChangeEvent, FormEvent, ReactNode, DragEvent } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { DayPicker } from 'react-day-picker';
import { format, addDays, isBefore, startOfDay } from 'date-fns';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { useToast } from '../context/NotificationContext';
import { API_URL } from '../config';
import 'react-day-picker/dist/style.css';

// ============================================
// Type Definitions
// ============================================

type ServiceCategory = 'recording' | 'mixing' | 'mastering' | 'promo' | 'consulting';
type MixingDelivery = 'remote' | 'in-person';
type MixingTierId = 'BASIC' | 'STANDARD' | 'PRO' | 'PREMIUM';
type MasteringTierId = 'DIGITAL' | 'ANALOG';
type ConsultingDuration = '30min' | '60min';

interface ConsultingOption {
  id: ConsultingDuration;
  name: string;
  duration: string;
  price: number;
  description: string;
}

type BookingStep =
  | 'category'      // Pick Recording/Mixing/Promo
  | 'service'       // Pick hours/tier/promo
  | 'beats'         // (Promo only) Select beat from catalog
  | 'upload'        // (Remote mixing only) Upload files
  | 'schedule'      // Calendar + time selection
  | 'info'          // Customer details
  | 'payment'       // Square payment
  | 'confirmation';

interface MixingTier {
  id: MixingTierId;
  name: string;
  price: number;
  description: string;
  features: string[];
  turnaround: string;
  allowInPerson: boolean;
}

interface MasteringTier {
  id: MasteringTierId;
  name: string;
  price: number;
  description: string;
  features: string[];
  turnaround: string;
}

interface Promo {
  id: string;
  name: string;
  description: string;
  price: number;
  originalValue: number;
  includesSession: boolean;
  sessionHours: number;
  includesBeat: boolean;
  includesMixing: boolean;
  mixingTier?: string;
  active: boolean;
}

interface Beat {
  id: string;
  title: string;
  imageUrl: string;
  audioUrl: string;
  bpm: number;
  key: string;
  price: number;
}

interface TimeSlot {
  startAt: string;
}

interface AvailabilityDay {
  date: string;
  slots: TimeSlot[];
}

interface BookingFormData {
  name: string;
  email: string;
  phone: string;
  artistName: string;
  songTitle: string;
  recordingDetails: string;
}

interface SquareCard {
  tokenize: () => Promise<{ token?: string; status: string; errors?: Array<{ message: string }> }>;
}

// ============================================
// Constants
// ============================================

// Fallback defaults if /api/bookings/pricing-config can't be reached -
// identical to the server's own defaults, so the page degrades gracefully
// rather than breaking. The server-computed price is always what's
// actually charged regardless of what's displayed here.
const DEFAULT_MIXING_TIERS: MixingTier[] = [
  {
    id: 'BASIC',
    name: 'Basic Mix',
    price: 75,
    description: 'MP3 or WAV Master',
    features: ['Professional Mix', 'MP3 or WAV Delivery'],
    turnaround: '3-5 days',
    allowInPerson: false
  },
  {
    id: 'STANDARD',
    name: 'Standard Mix',
    price: 100,
    description: 'Vocal Stems + Beat Track',
    features: ['Professional Mix', 'Vocal Stems Processing', 'Beat Track Integration', 'MP3 & WAV Delivery', '2 Revisions Included'],
    turnaround: '3-5 days',
    allowInPerson: false
  },
  {
    id: 'PRO',
    name: 'Pro Mix',
    price: 200,
    description: 'Full Stems + Vocal Stems',
    features: ['Professional Mix & Master', 'Full Stems Processing', 'Vocal Stems Included', 'MP3 & WAV Delivery', 'Stems Delivery (Optional)', '2 Revisions Included'],
    turnaround: '2-3 days',
    allowInPerson: true
  },
  {
    id: 'PREMIUM',
    name: 'Premium Mix',
    price: 300,
    description: 'Complete Package',
    features: ['Professional Mix & Master', 'Vocal Stems Processing', 'Beat Stems Processing', 'Clean Version Included', 'All File Formats', 'Stems Delivery (Optional)', '2 Revisions Included', '24-48hr Priority Turnaround'],
    turnaround: '24-48 hrs',
    allowInPerson: true
  }
];

const DEFAULT_MASTERING_TIERS: MasteringTier[] = [
  {
    id: 'DIGITAL',
    name: 'Digital Master',
    price: 75,
    description: 'iZotope, Brainworx (BX plugins), UAD & Console Virtual Print',
    features: ['iZotope Ozone Chain', 'Brainworx (BX) Plugins', 'UAD Processing', 'Console Virtual Print', 'MP3 & WAV Delivery'],
    turnaround: '2-3 days',
  },
  {
    id: 'ANALOG',
    name: 'Analog Master',
    price: 125,
    description: 'Rupert Neve Orbit, SSL G-Comp bus compressor & SSL Fusion, plus digital plugins',
    features: ['Rupert Neve Orbit Summing', 'SSL G-Comp Bus Compressor', 'SSL Fusion Analog Processing', 'Complementary Digital Plugins', 'MP3 & WAV Delivery'],
    turnaround: '3-5 days',
  },
];

const DEFAULT_CONSULTING_OPTIONS: ConsultingOption[] = [
  {
    id: '30min',
    name: '30 Minute Call',
    duration: '30 min',
    price: 50,
    description: 'Quick consultation for specific questions'
  },
  {
    id: '60min',
    name: '1 Hour Call',
    duration: '60 min',
    price: 85,
    description: 'In-depth consultation for your music business'
  }
];

const MAX_UPLOAD_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
const ACCEPTED_FILE_TYPES = '.wav,.mp3,.aiff,.flac,.zip';

interface PricingConfig {
  deposit: number;
  recording: {
    rateUnder5Hours: number;
    rate5to9Hours: number;
    rate10PlusHours: number;
  };
  mixing: {
    tiers: Record<string, number>;
    inPersonStudioHours: number;
    inPersonHourlyRate: number;
  };
  mastering: {
    tiers: Record<string, number>;
  };
  consulting: Record<string, number>;
}

const DEFAULT_PRICING_CONFIG: PricingConfig = {
  deposit: 25,
  recording: { rateUnder5Hours: 80, rate5to9Hours: 70, rate10PlusHours: 65 },
  mixing: {
    tiers: { BASIC: 75, STANDARD: 100, PRO: 200, PREMIUM: 300 },
    inPersonStudioHours: 2,
    inPersonHourlyRate: 80,
  },
  mastering: {
    tiers: { DIGITAL: 75, ANALOG: 125 },
  },
  consulting: { '30min': 50, '60min': 85 },
};

// ============================================
// BookPage Component
// ============================================

export default function BookPage(): ReactNode {
  const [searchParams] = useSearchParams();
  const { customer } = useCustomerAuth();
  const toast = useToast();

  // Step management
  const [step, setStep] = useState<BookingStep>('category');

  // Category & service selection
  const [category, setCategory] = useState<ServiceCategory | null>(null);
  const [hours, setHours] = useState<number>(1);
  const [mixingTier, setMixingTier] = useState<MixingTierId | null>(null);
  const [mixingDelivery, setMixingDelivery] = useState<MixingDelivery | null>(null);
  const [masteringTier, setMasteringTier] = useState<MasteringTierId | null>(null);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [selectedPromo, setSelectedPromo] = useState<Promo | null>(null);
  const [consultingDuration, setConsultingDuration] = useState<ConsultingDuration | null>(null);

  // Pricing (fetched from the server so displayed prices can't drift from
  // what's actually charged; falls back to hardcoded defaults if unreachable)
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>(DEFAULT_PRICING_CONFIG);
  const mixingTiers = DEFAULT_MIXING_TIERS.map(tier => ({
    ...tier,
    price: pricingConfig.mixing.tiers[tier.id] ?? tier.price,
  }));
  const masteringTiers = DEFAULT_MASTERING_TIERS.map(tier => ({
    ...tier,
    price: pricingConfig.mastering.tiers[tier.id] ?? tier.price,
  }));
  const consultingOptions = DEFAULT_CONSULTING_OPTIONS.map(option => ({
    ...option,
    price: pricingConfig.consulting[option.id] ?? option.price,
  }));

  // Beat selection (for promos)
  const [beats, setBeats] = useState<Beat[]>([]);
  const [selectedBeat, setSelectedBeat] = useState<Beat | null>(null);
  const [playingBeatId, setPlayingBeatId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // File upload (for remote mixing)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Scheduling
  const [availabilities, setAvailabilities] = useState<AvailabilityDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Form data
  const [formData, setFormData] = useState<BookingFormData>({
    name: '',
    email: '',
    phone: '',
    artistName: '',
    songTitle: '',
    recordingDetails: ''
  });

  // Payment
  const [card, setCard] = useState<SquareCard | null>(null);
  const [squareLoading, setSquareLoading] = useState<boolean>(true);
  const cardContainerRef = useRef<HTMLDivElement>(null);

  // UI state
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [bookingNumber, setBookingNumber] = useState<string>('');

  // Computed values
  const availableDates = availabilities.map(a => new Date(a.date + 'T00:00:00'));
  const timeSlotsForDate = selectedDate
    ? availabilities.find(a => a.date === format(selectedDate, 'yyyy-MM-dd'))?.slots || []
    : [];

  // ============================================
  // Effects
  // ============================================

  useEffect(() => {
    // Check URL params for category/service pre-selection
    // Support both 'category' and 'type' params (ServicesPage uses 'type')
    const categoryParam = searchParams.get('category') || searchParams.get('type');
    const serviceParam = searchParams.get('service');

    if (categoryParam === 'recording' || categoryParam === 'mixing' || categoryParam === 'promo' || categoryParam === 'promos') {
      // Map 'promos' to 'promo' for consistency
      const cat = categoryParam === 'promos' ? 'promo' : categoryParam as ServiceCategory;
      setCategory(cat);
      setStep('service');

      if (cat === 'recording' && serviceParam) {
        const hrs = parseInt(serviceParam);
        if (!isNaN(hrs) && hrs >= 1 && hrs <= 10) {
          setHours(hrs);
        }
      }
    } else if (categoryParam === 'consulting') {
      setCategory('consulting');
      setStep('service');
    }
  }, [searchParams]);

  useEffect(() => {
    if (customer) {
      setFormData(prev => ({
        ...prev,
        name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
        email: customer.email || ''
      }));
    }
  }, [customer]);

  useEffect(() => {
    if (step === 'payment') {
      initializeSquarePayment();
    }
  }, [step]);

  useEffect(() => {
    fetchPricingConfig();
  }, []);

  useEffect(() => {
    if (category === 'promo') {
      fetchPromos();
    }
  }, [category]);

  useEffect(() => {
    if (step === 'beats' && selectedPromo?.includesBeat) {
      fetchBeats();
    }
  }, [step, selectedPromo]);

  useEffect(() => {
    if (step === 'schedule') {
      fetchAvailability();
    }
  }, [step]);

  // ============================================
  // Data Fetching
  // ============================================

  const fetchPricingConfig = async (): Promise<void> => {
    try {
      const res = await fetch(`${API_URL}/bookings/pricing-config`);
      if (res.ok) {
        const data = await res.json();
        setPricingConfig(data);
      }
    } catch (err) {
      console.error('Error fetching pricing config:', err);
    }
  };

  const fetchPromos = async (): Promise<void> => {
    try {
      const res = await fetch(`${API_URL}/bookings/promos`);
      if (res.ok) {
        const data = await res.json();
        setPromos(data);
      }
    } catch (err) {
      console.error('Error fetching promos:', err);
    }
  };

  const fetchBeats = async (): Promise<void> => {
    try {
      const res = await fetch(`${API_URL}/beats`);
      if (res.ok) {
        const data = await res.json();
        setBeats(data);
      }
    } catch (err) {
      console.error('Error fetching beats:', err);
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
  // Square Payment
  // ============================================

  const initializeSquarePayment = async (): Promise<void> => {
    setSquareLoading(true);
    try {
      if (!window.Square) {
        const squareEnv = import.meta.env.VITE_SQUARE_ENVIRONMENT || 'sandbox';
        const sdkUrl = squareEnv === 'production'
          ? 'https://web.squarecdn.com/v1/square.js'
          : 'https://sandbox.web.squarecdn.com/v1/square.js';

        const script = document.createElement('script');
        script.src = sdkUrl;
        script.onload = () => initializeSquareCard();
        document.body.appendChild(script);
      } else {
        await initializeSquareCard();
      }
    } catch (err) {
      console.error('Square initialization error:', err);
      setSquareLoading(false);
    }
  };

  const initializeSquareCard = async (): Promise<void> => {
    try {
      // @ts-expect-error Square is loaded via script
      const payments = window.Square.payments(
        import.meta.env.VITE_SQUARE_APP_ID || '',
        import.meta.env.VITE_SQUARE_LOCATION_ID || ''
      );

      const cardInstance = await payments.card();
      await cardInstance.attach('#bp-card-container');
      setCard(cardInstance);
      setSquareLoading(false);
    } catch (err) {
      console.error('Card initialization error:', err);
      setSquareLoading(false);
    }
  };

  // ============================================
  // Price Calculation
  // ============================================

  const calculatePayment = () => {
    const deposit = pricingConfig.deposit;

    if (category === 'recording') {
      const rate = hours >= 10
        ? pricingConfig.recording.rate10PlusHours
        : hours >= 5
          ? pricingConfig.recording.rate5to9Hours
          : pricingConfig.recording.rateUnder5Hours;
      const total = hours * rate;
      return { deposit, balance: total - deposit, total, rate };
    }

    if (category === 'mixing') {
      const tier = mixingTiers.find(t => t.id === mixingTier);
      if (!tier) return { deposit: 0, balance: 0, total: 0, rate: 0 };

      if (mixingDelivery === 'in-person') {
        const { inPersonStudioHours, inPersonHourlyRate } = pricingConfig.mixing;
        const total = tier.price + (inPersonStudioHours * inPersonHourlyRate);
        return { deposit, balance: total - deposit, total, rate: inPersonHourlyRate };
      }
      return { deposit: tier.price, balance: 0, total: tier.price, rate: 0 };
    }

    if (category === 'mastering') {
      const tier = masteringTiers.find(t => t.id === masteringTier);
      if (!tier) return { deposit: 0, balance: 0, total: 0, rate: 0 };
      return { deposit: tier.price, balance: 0, total: tier.price, rate: 0 };
    }

    if (category === 'promo' && selectedPromo) {
      return { deposit, balance: selectedPromo.price - deposit, total: selectedPromo.price, rate: 0 };
    }

    if (category === 'consulting' && consultingDuration) {
      const option = consultingOptions.find(o => o.id === consultingDuration);
      if (option) {
        // Full payment upfront for consultations
        return { deposit: option.price, balance: 0, total: option.price, rate: 0 };
      }
    }

    return { deposit: 0, balance: 0, total: 0, rate: 0 };
  };

  const payment = calculatePayment();

  // ============================================
  // Handlers
  // ============================================

  const selectCategory = (cat: ServiceCategory) => {
    setCategory(cat);
    setStep('service');
  };

  const handleRecordingSelect = () => {
    setStep('schedule');
  };

  const handleMixingTierSelect = (tierId: MixingTierId) => {
    setMixingTier(tierId);
    const tier = mixingTiers.find(t => t.id === tierId);
    if (tier?.allowInPerson) {
      // Show delivery choice
    } else {
      setMixingDelivery('remote');
    }
  };

  const handleMixingDeliverySelect = (delivery: MixingDelivery) => {
    setMixingDelivery(delivery);
    if (delivery === 'remote') {
      setStep('upload');
    } else {
      setStep('schedule');
    }
  };

  const handleMasteringTierSelect = (tierId: MasteringTierId) => {
    setMasteringTier(tierId);
    setStep('schedule');
  };

  const handlePromoSelect = (promo: Promo) => {
    setSelectedPromo(promo);
    if (promo.includesBeat) {
      setStep('beats');
    } else if (promo.includesSession) {
      setStep('schedule');
    } else {
      setStep('info');
    }
  };

  const handleConsultingSelect = (duration: ConsultingDuration) => {
    setConsultingDuration(duration);
    setStep('schedule');
  };

  const handleBeatSelect = (beat: Beat) => {
    setSelectedBeat(beat);
  };

  const playBeat = (beat: Beat) => {
    if (audioRef.current) {
      if (playingBeatId === beat.id) {
        audioRef.current.pause();
        setPlayingBeatId(null);
      } else {
        audioRef.current.src = beat.audioUrl;
        audioRef.current.play();
        setPlayingBeatId(beat.id);
      }
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedTime(null);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

  const handleFormChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleInfoSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.phone) {
      setError('Please fill in all required fields');
      return;
    }
    setError('');
    setStep('payment');
  };

  // File upload handlers
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (files: File[]) => {
    const validFiles = files.filter(file => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      return ACCEPTED_FILE_TYPES.includes(ext);
    });

    const newFiles = [...uploadedFiles, ...validFiles];
    const totalSize = newFiles.reduce((sum, f) => sum + f.size, 0);

    if (totalSize > MAX_UPLOAD_SIZE) {
      toast.error('Total file size exceeds 2GB limit');
      return;
    }

    setUploadedFiles(newFiles);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getTotalSize = () => {
    const bytes = uploadedFiles.reduce((sum, f) => sum + f.size, 0);
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handlePayment = async (): Promise<void> => {
    if (!card) return;

    setLoading(true);
    setError('');

    try {
      const tokenResult = await card.tokenize();
      if (tokenResult.status !== 'OK' || !tokenResult.token) {
        throw new Error(tokenResult.errors?.[0]?.message || 'Payment failed');
      }

      const bookingData = {
        category,
        hours: category === 'recording' ? hours : undefined,
        mixingTier: category === 'mixing' ? mixingTier : undefined,
        mixingDelivery: category === 'mixing' ? mixingDelivery : undefined,
        masteringTier: category === 'mastering' ? masteringTier : undefined,
        consultingDuration: category === 'consulting' ? consultingDuration : undefined,
        promoId: selectedPromo?.id,
        beatId: selectedBeat?.id,
        startAt: selectedTime,
        customer: formData,
        sourceId: tokenResult.token
        // Note: price is computed server-side from the fields above -
        // the amount actually charged never comes from the client.
      };

      const res = await fetch(`${API_URL}/bookings/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Booking failed');
      }

      const data = await res.json();
      setBookingNumber(data.bookingNumber);
      setStep('confirmation');
      toast.success('Booking confirmed!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Payment failed';
      setError(errorMessage);
      toast.error(errorMessage);
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

  const disabledDays = (date: Date): boolean => {
    const today = startOfDay(new Date());
    if (isBefore(date, today)) return true;
    const dateStr = format(date, 'yyyy-MM-dd');
    return !availabilities.some(a => a.date === dateStr);
  };

  const goBack = () => {
    switch (step) {
      case 'service':
        setStep('category');
        setCategory(null);
        break;
      case 'beats':
        setStep('service');
        setSelectedPromo(null);
        break;
      case 'upload':
        if (mixingTier && mixingTiers.find(t => t.id === mixingTier)?.allowInPerson) {
          setMixingDelivery(null);
        } else {
          setStep('service');
          setMixingTier(null);
        }
        break;
      case 'schedule':
        if (category === 'recording') {
          setStep('service');
        } else if (category === 'mixing') {
          if (mixingDelivery === 'in-person') {
            setMixingDelivery(null);
          } else {
            setStep('service');
          }
        } else if (category === 'mastering') {
          setStep('service');
          setMasteringTier(null);
        } else if (category === 'promo') {
          if (selectedPromo?.includesBeat) {
            setStep('beats');
          } else {
            setStep('service');
          }
        } else if (category === 'consulting') {
          setStep('service');
          setConsultingDuration(null);
        }
        break;
      case 'info':
        if (category === 'mixing' && mixingDelivery === 'remote') {
          setStep('upload');
        } else {
          setStep('schedule');
        }
        break;
      case 'payment':
        setStep('info');
        break;
    }
  };

  // ============================================
  // Render Functions
  // ============================================

  const renderCategoryStep = (): ReactNode => (
    <div className="bp-category-step">
      <div className="bp-step-header">
        <h2>Book a Service</h2>
        <p>Choose what you need</p>
      </div>

      <div className="bp-category-grid">
        <div className="bp-category-card" onClick={() => selectCategory('recording')}>
          <div className="bp-category-icon">
            <i className="fas fa-microphone"></i>
          </div>
          <h3>Recording Sessions</h3>
          <p>Book studio time - 1 to 10 hours</p>
          <span className="bp-price-hint">From $65/hr</span>
        </div>

        <div className="bp-category-card" onClick={() => selectCategory('mixing')}>
          <div className="bp-category-icon">
            <i className="fas fa-sliders-h"></i>
          </div>
          <h3>Mixing Services</h3>
          <p>Professional mixing & mastering</p>
          <span className="bp-price-hint">From $75</span>
        </div>

        <div className="bp-category-card" onClick={() => selectCategory('mastering')}>
          <div className="bp-category-icon">
            <i className="fas fa-compact-disc"></i>
          </div>
          <h3>Mastering</h3>
          <p>Digital or analog mastering, remote delivery</p>
          <span className="bp-price-hint">From $75</span>
        </div>

        <div className="bp-category-card" onClick={() => selectCategory('promo')}>
          <div className="bp-category-icon">
            <i className="fas fa-tags"></i>
          </div>
          <h3>Specials & Promos</h3>
          <p>Bundle deals - Session + Beat</p>
          <span className="bp-price-hint">Save up to 30%</span>
        </div>

        <div className="bp-category-card bp-consulting-card" onClick={() => selectCategory('consulting')}>
          <div className="bp-category-icon">
            <i className="fas fa-comments"></i>
          </div>
          <h3>Consultation</h3>
          <p>Expert advice for your music business</p>
          <span className="bp-price-hint">From $50</span>
        </div>
      </div>
    </div>
  );

  const renderServiceStep = (): ReactNode => {
    if (category === 'recording') {
      return (
        <div className="bp-service-step">
          <button className="bp-back-link" onClick={goBack}>
            <i className="fas fa-arrow-left"></i> Back
          </button>

          <div className="bp-step-header">
            <h2>Select Session Length</h2>
            <p>Choose how much studio time you need</p>
          </div>

          <div className="bp-service-list">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(hrs => {
              const rate = hrs >= 10 ? 65 : hrs >= 5 ? 70 : 80;
              const total = hrs * rate;
              const hasDiscount = hrs === 5 || hrs === 10;

              return (
                <div
                  key={hrs}
                  className={`bp-service-row ${hours === hrs ? 'selected' : ''}`}
                  onClick={() => setHours(hrs)}
                >
                  <div className="bp-service-row-main">
                    <span className="bp-hours">{hrs} Hour{hrs > 1 ? 's' : ''}</span>
                    {hasDiscount && (
                      <span className="bp-badge">
                        {hrs === 5 ? '$10/hr off' : '$15/hr off'}
                      </span>
                    )}
                  </div>
                  <div className="bp-service-row-price">
                    <span className="bp-rate">${rate}/hr</span>
                    <span className="bp-total">${total}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bp-service-footer">
            <div className="bp-service-summary">
              <span>{hours} hour{hours > 1 ? 's' : ''} - ${payment.total}</span>
              <span className="bp-deposit-note">$25 deposit, ${payment.balance} at studio</span>
            </div>
            <button className="bp-continue-btn" onClick={handleRecordingSelect}>
              Continue
            </button>
          </div>
        </div>
      );
    }

    if (category === 'mixing') {
      const selectedTier = mixingTiers.find(t => t.id === mixingTier);
      const showDeliveryChoice = selectedTier?.allowInPerson && mixingDelivery === null;

      return (
        <div className="bp-service-step">
          <button className="bp-back-link" onClick={goBack}>
            <i className="fas fa-arrow-left"></i> Back
          </button>

          <div className="bp-step-header">
            <h2>Choose Mixing Package</h2>
            <p>Professional mixing & mastering services</p>
          </div>

          {!showDeliveryChoice ? (
            <div className="bp-mixing-list">
              {mixingTiers.map(tier => (
                <div
                  key={tier.id}
                  className={`bp-mixing-row ${mixingTier === tier.id ? 'selected' : ''}`}
                  onClick={() => handleMixingTierSelect(tier.id)}
                >
                  <div className="bp-mixing-row-header">
                    <div className="bp-mixing-row-title">
                      <h4>{tier.name}</h4>
                      <span className="bp-mixing-desc">{tier.description}</span>
                    </div>
                    <div className="bp-mixing-row-price">
                      <span className="bp-price">${tier.price}</span>
                      <span className="bp-turnaround">{tier.turnaround}</span>
                    </div>
                  </div>
                  <ul className="bp-mixing-features">
                    {tier.features.map((feature, idx) => (
                      <li key={idx}><i className="fas fa-check"></i> {feature}</li>
                    ))}
                  </ul>
                  {tier.allowInPerson && (
                    <span className="bp-mixing-inperson-badge">
                      <i className="fas fa-user"></i> In-person option available
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bp-delivery-choice">
              <h3>How would you like to work with us?</h3>
              <p>You selected: {selectedTier?.name} - ${selectedTier?.price}</p>

              <div className="bp-delivery-options">
                <div className="bp-delivery-option" onClick={() => handleMixingDeliverySelect('remote')}>
                  <div className="bp-delivery-icon">
                    <i className="fas fa-cloud-upload-alt"></i>
                  </div>
                  <h4>Remote</h4>
                  <p>Upload your files online</p>
                  <span className="bp-delivery-price">Full payment: ${selectedTier?.price}</span>
                </div>

                <div className="bp-delivery-option" onClick={() => handleMixingDeliverySelect('in-person')}>
                  <div className="bp-delivery-icon">
                    <i className="fas fa-building"></i>
                  </div>
                  <h4>In-Person</h4>
                  <p>Book studio time for your mix session</p>
                  <span className="bp-delivery-price">+$80/hr studio time</span>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (category === 'mastering') {
      return (
        <div className="bp-service-step">
          <button className="bp-back-link" onClick={goBack}>
            <i className="fas fa-arrow-left"></i> Back
          </button>

          <div className="bp-step-header">
            <h2>Choose Mastering Package</h2>
            <p>Remote delivery - files sent via email</p>
          </div>

          <div className="bp-mixing-list">
            {masteringTiers.map(tier => (
              <div
                key={tier.id}
                className={`bp-mixing-row ${masteringTier === tier.id ? 'selected' : ''}`}
                onClick={() => handleMasteringTierSelect(tier.id)}
              >
                <div className="bp-mixing-row-header">
                  <div className="bp-mixing-row-title">
                    <h4>{tier.name}</h4>
                    <span className="bp-mixing-desc">{tier.description}</span>
                  </div>
                  <div className="bp-mixing-row-price">
                    <span className="bp-price">${tier.price}</span>
                    <span className="bp-turnaround">{tier.turnaround}</span>
                  </div>
                </div>
                <ul className="bp-mixing-features">
                  {tier.features.map((feature, idx) => (
                    <li key={idx}><i className="fas fa-check"></i> {feature}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (category === 'promo') {
      return (
        <div className="bp-service-step">
          <button className="bp-back-link" onClick={goBack}>
            <i className="fas fa-arrow-left"></i> Back
          </button>

          <div className="bp-step-header">
            <h2>Special Offers</h2>
            <p>Bundle deals to save on your project</p>
          </div>

          {promos.length > 0 ? (
            <div className="bp-promo-list">
              {promos.map(promo => (
                <div
                  key={promo.id}
                  className={`bp-promo-card ${selectedPromo?.id === promo.id ? 'selected' : ''}`}
                  onClick={() => handlePromoSelect(promo)}
                >
                  <div className="bp-promo-header">
                    <h4>{promo.name}</h4>
                    <div className="bp-promo-pricing">
                      <span className="bp-promo-original">${promo.originalValue}</span>
                      <span className="bp-promo-price">${promo.price}</span>
                    </div>
                  </div>
                  <p className="bp-promo-desc">{promo.description}</p>
                  <div className="bp-promo-includes">
                    {promo.includesSession && (
                      <span><i className="fas fa-microphone"></i> {promo.sessionHours}hr session</span>
                    )}
                    {promo.includesBeat && (
                      <span><i className="fas fa-music"></i> Beat included</span>
                    )}
                    {promo.includesMixing && (
                      <span><i className="fas fa-sliders-h"></i> {promo.mixingTier} mix</span>
                    )}
                  </div>
                  <span className="bp-promo-savings">
                    Save ${promo.originalValue - promo.price}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="bp-no-promos">
              <i className="fas fa-tag"></i>
              <p>No promos available at the moment</p>
              <span>Check back soon for special offers!</span>
            </div>
          )}
        </div>
      );
    }

    if (category === 'consulting') {
      return (
        <div className="bp-service-step">
          <button className="bp-back-link" onClick={goBack}>
            <i className="fas fa-arrow-left"></i> Back
          </button>

          <div className="bp-step-header">
            <h2>Book a Consultation</h2>
            <p>Get expert advice on your music business</p>
          </div>

          <div className="bp-consulting-list">
            {consultingOptions.map(option => (
              <div
                key={option.id}
                className={`bp-consulting-row ${consultingDuration === option.id ? 'selected' : ''}`}
                onClick={() => handleConsultingSelect(option.id)}
              >
                <div className="bp-consulting-row-main">
                  <div className="bp-consulting-icon">
                    <i className="fas fa-phone-alt"></i>
                  </div>
                  <div className="bp-consulting-info">
                    <h4>{option.name}</h4>
                    <p>{option.description}</p>
                  </div>
                </div>
                <div className="bp-consulting-row-price">
                  <span className="bp-price">${option.price}</span>
                  <span className="bp-duration">{option.duration}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="bp-consulting-note">
            <i className="fas fa-info-circle"></i>
            <span>Phone or video call - you'll receive call details via email after booking</span>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderBeatsStep = (): ReactNode => (
    <div className="bp-beats-step">
      <audio ref={audioRef} onEnded={() => setPlayingBeatId(null)} />

      <button className="bp-back-link" onClick={goBack}>
        <i className="fas fa-arrow-left"></i> Back
      </button>

      <div className="bp-step-header">
        <h2>Select a Beat</h2>
        <p>Choose a beat to include with your session (MP3 Lease)</p>
      </div>

      {beats.length > 0 ? (
        <div className="bp-beat-grid">
          {beats.map(beat => (
            <div
              key={beat.id}
              className={`bp-beat-card ${selectedBeat?.id === beat.id ? 'selected' : ''}`}
              onClick={() => handleBeatSelect(beat)}
            >
              <div className="bp-beat-image">
                <img src={beat.imageUrl || '/placeholder-beat.jpg'} alt={beat.title} />
                <button
                  className={`bp-beat-play ${playingBeatId === beat.id ? 'playing' : ''}`}
                  onClick={(e) => { e.stopPropagation(); playBeat(beat); }}
                >
                  <i className={`fas ${playingBeatId === beat.id ? 'fa-pause' : 'fa-play'}`}></i>
                </button>
              </div>
              <div className="bp-beat-info">
                <h4>{beat.title}</h4>
                <span>{beat.bpm} BPM • {beat.key}</span>
              </div>
              {selectedBeat?.id === beat.id && (
                <div className="bp-beat-selected-badge">
                  <i className="fas fa-check"></i>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bp-no-beats">
          <i className="fas fa-music"></i>
          <p>Loading beats...</p>
        </div>
      )}

      {selectedBeat && (
        <div className="bp-beats-footer">
          <div className="bp-beats-summary">
            <strong>{selectedBeat.title}</strong>
            <span>MP3 Lease included</span>
          </div>
          <button className="bp-continue-btn" onClick={() => setStep('schedule')}>
            Continue
          </button>
        </div>
      )}
    </div>
  );

  const renderUploadStep = (): ReactNode => (
    <div className="bp-upload-step">
      <button className="bp-back-link" onClick={goBack}>
        <i className="fas fa-arrow-left"></i> Back
      </button>

      <div className="bp-step-header">
        <h2>Upload Your Files</h2>
        <p>Submit your tracks for mixing (max 2GB total)</p>
      </div>

      <div
        className={`bp-dropzone ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleFileDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_FILE_TYPES}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <i className="fas fa-cloud-upload-alt"></i>
        <p>Drag & drop files here</p>
        <span>or click to browse</span>
        <span className="bp-file-types">WAV, MP3, AIFF, FLAC, ZIP</span>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="bp-file-list">
          <h4>Uploaded Files ({uploadedFiles.length})</h4>
          <ul>
            {uploadedFiles.map((file, i) => (
              <li key={i}>
                <span className="bp-file-name">
                  <i className="fas fa-file-audio"></i>
                  {file.name}
                </span>
                <span className="bp-file-size">
                  {(file.size / (1024 * 1024)).toFixed(1)} MB
                </span>
                <button className="bp-file-remove" onClick={() => removeFile(i)}>
                  <i className="fas fa-times"></i>
                </button>
              </li>
            ))}
          </ul>
          <div className="bp-total-size">
            Total: {getTotalSize()} / 2GB
          </div>
        </div>
      )}

      <div className="bp-upload-footer">
        <button
          className="bp-continue-btn"
          onClick={() => setStep('info')}
          disabled={uploadedFiles.length === 0}
        >
          Continue
        </button>
      </div>
    </div>
  );

  const renderScheduleStep = (): ReactNode => (
    <div className="bp-schedule-step">
      <button className="bp-back-link" onClick={goBack}>
        <i className="fas fa-arrow-left"></i> Back
      </button>

      <div className="bp-step-header">
        <h2>Pick Your Date & Time</h2>
        <p>Select an available slot for your session</p>
      </div>

      <div className="bp-schedule-layout">
        <div className="bp-calendar-section">
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
          {loading && <div className="bp-calendar-loading">Loading availability...</div>}
        </div>

        <div className="bp-timeslots-section">
          <h3>{selectedDate ? format(selectedDate, 'EEEE, MMMM d') : 'Available Times'}</h3>

          {selectedDate ? (
            timeSlotsForDate.length > 0 ? (
              <div className="bp-timeslots-grid">
                {timeSlotsForDate.map((slot, idx) => (
                  <button
                    key={idx}
                    className={`bp-timeslot ${selectedTime === slot.startAt ? 'selected' : ''}`}
                    onClick={() => handleTimeSelect(slot.startAt)}
                  >
                    {formatTime(slot.startAt)}
                  </button>
                ))}
              </div>
            ) : (
              <div className="bp-no-slots">
                <p>No available times for this date</p>
                <span>Please select another date</span>
              </div>
            )
          ) : (
            <div className="bp-no-slots">
              <p>Select a date to see available times</p>
            </div>
          )}
        </div>
      </div>

      {selectedTime && (
        <div className="bp-schedule-footer">
          <div className="bp-schedule-summary">
            <span>{selectedDate && format(selectedDate, 'MMM d, yyyy')}</span>
            <span className="bp-dot">•</span>
            <span>{formatTime(selectedTime)}</span>
          </div>
          <button className="bp-continue-btn" onClick={() => setStep('info')}>
            Continue
          </button>
        </div>
      )}
    </div>
  );

  const renderInfoStep = (): ReactNode => (
    <div className="bp-info-step">
      <button className="bp-back-link" onClick={goBack}>
        <i className="fas fa-arrow-left"></i> Back
      </button>

      <div className="bp-step-header">
        <h2>Your Information</h2>
        <p>Tell us about yourself and your project</p>
      </div>

      <form onSubmit={handleInfoSubmit} className="bp-info-form">
        <div className="bp-form-grid">
          <div className="bp-form-field">
            <label>Full Name <span className="bp-required">*</span></label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleFormChange}
              placeholder="Your full name"
              required
            />
          </div>

          <div className="bp-form-field">
            <label>Email <span className="bp-required">*</span></label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleFormChange}
              placeholder="your@email.com"
              required
            />
          </div>

          <div className="bp-form-field">
            <label>Phone <span className="bp-required">*</span></label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleFormChange}
              placeholder="(555) 123-4567"
              required
            />
          </div>

          <div className="bp-form-field">
            <label>Artist / Stage Name</label>
            <input
              type="text"
              name="artistName"
              value={formData.artistName}
              onChange={handleFormChange}
              placeholder="Your artist name"
            />
          </div>
        </div>

        <div className="bp-form-field bp-full-width">
          <label>Song Title</label>
          <input
            type="text"
            name="songTitle"
            value={formData.songTitle}
            onChange={handleFormChange}
            placeholder="What are you working on?"
          />
        </div>

        <div className="bp-form-field bp-full-width">
          <label>Additional Details</label>
          <textarea
            name="recordingDetails"
            value={formData.recordingDetails}
            onChange={handleFormChange}
            placeholder="Genre, reference tracks, special requests..."
            rows={3}
          />
        </div>

        {error && <div className="bp-error-message">{error}</div>}

        <button type="submit" className="bp-continue-btn">
          Continue to Payment
        </button>
      </form>
    </div>
  );

  const renderPaymentStep = (): ReactNode => {
    const tier = mixingTiers.find(t => t.id === mixingTier);

    return (
      <div className="bp-payment-step">
        <button className="bp-back-link" onClick={goBack}>
          <i className="fas fa-arrow-left"></i> Back
        </button>

        <div className="bp-step-header">
          <h2>Complete Your Booking</h2>
          <p>
            {payment.balance > 0
              ? `Pay $${payment.deposit} deposit to confirm`
              : `Pay $${payment.deposit} to complete`}
          </p>
        </div>

        <div className="bp-payment-layout">
          <div className="bp-payment-summary">
            <h3>Booking Summary</h3>

            <div className="bp-summary-rows">
              {category === 'recording' && (
                <>
                  <div className="bp-summary-row">
                    <span>Service</span>
                    <span>Recording Session</span>
                  </div>
                  <div className="bp-summary-row">
                    <span>Duration</span>
                    <span>{hours} hour{hours > 1 ? 's'  : ''}</span>
                  </div>
                </>
              )}

              {category === 'mixing' && (
                <>
                  <div className="bp-summary-row">
                    <span>Service</span>
                    <span>{tier?.name}</span>
                  </div>
                  <div className="bp-summary-row">
                    <span>Delivery</span>
                    <span>{mixingDelivery === 'remote' ? 'Remote' : 'In-Person'}</span>
                  </div>
                </>
              )}

              {category === 'mastering' && (
                <div className="bp-summary-row">
                  <span>Service</span>
                  <span>{masteringTiers.find(t => t.id === masteringTier)?.name}</span>
                </div>
              )}

              {category === 'promo' && selectedPromo && (
                <>
                  <div className="bp-summary-row">
                    <span>Package</span>
                    <span>{selectedPromo.name}</span>
                  </div>
                  {selectedBeat && (
                    <div className="bp-summary-row">
                      <span>Beat</span>
                      <span>{selectedBeat.title}</span>
                    </div>
                  )}
                </>
              )}

              {category === 'consulting' && consultingDuration && (
                <>
                  <div className="bp-summary-row">
                    <span>Service</span>
                    <span>Consultation Call</span>
                  </div>
                  <div className="bp-summary-row">
                    <span>Duration</span>
                    <span>{consultingOptions.find(o => o.id === consultingDuration)?.duration}</span>
                  </div>
                </>
              )}

              {selectedDate && selectedTime && (
                <>
                  <div className="bp-summary-row">
                    <span>Date</span>
                    <span>{format(selectedDate, 'EEEE, MMM d')}</span>
                  </div>
                  <div className="bp-summary-row">
                    <span>Time</span>
                    <span>{formatTime(selectedTime)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="bp-summary-divider" />

            <div className="bp-summary-rows bp-pricing">
              <div className="bp-summary-row bp-highlight">
                <span>{payment.balance > 0 ? 'Deposit (pay now)' : 'Total'}</span>
                <span className="bp-deposit">${payment.deposit}</span>
              </div>
              {payment.balance > 0 && (
                <>
                  <div className="bp-summary-row">
                    <span>Balance (at studio)</span>
                    <span>${payment.balance}</span>
                  </div>
                  <div className="bp-summary-row bp-total">
                    <span>Total</span>
                    <span>${payment.total}</span>
                  </div>
                </>
              )}
            </div>

            {/* Studio Information */}
            <div className="bp-studio-info-payment">
              <h4>{category === 'consulting' ? 'Session Details' : 'Studio Location'}</h4>
              {(category === 'recording' || (category === 'mixing' && mixingDelivery === 'in-person')) && (
                <a
                  href="https://www.google.com/maps/dir/?api=1&destination=11100+66th+St+N+Suite+20,+Largo,+FL+33773"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bp-studio-detail bp-studio-link"
                >
                  <i className="fas fa-map-marker-alt"></i>
                  <div>
                    <strong>Summit Audio Recording Studio</strong>
                    <span>11100 66th St N Suite 20, Largo, FL 33773</span>
                    <span className="bp-directions-hint">📍 Tap for directions</span>
                  </div>
                </a>
              )}
              {category === 'consulting' && (
                <div className="bp-studio-detail">
                  <i className="fas fa-video"></i>
                  <div>
                    <strong>Virtual Session</strong>
                    <span>Call details will be sent to your email</span>
                  </div>
                </div>
              )}
              {((category === 'mixing' && mixingDelivery === 'remote') || category === 'mastering') && (
                <div className="bp-studio-detail">
                  <i className="fas fa-cloud"></i>
                  <div>
                    <strong>Remote Delivery</strong>
                    <span>Files delivered via email</span>
                  </div>
                </div>
              )}
              <div className="bp-studio-detail">
                <i className="fas fa-user"></i>
                <div>
                  <strong>Engineer</strong>
                  <span>Doc Rolds</span>
                </div>
              </div>
              <a href="tel:+17272825449" className="bp-studio-detail bp-studio-link">
                <i className="fas fa-phone"></i>
                <div>
                  <strong>Contact</strong>
                  <span>(727) 282-5449</span>
                  <span className="bp-directions-hint">📞 Tap to call</span>
                </div>
              </a>
            </div>
          </div>

          <div className="bp-payment-form">
            <h3>Payment Details</h3>

            <div className="bp-card-input-container" id="bp-card-container" ref={cardContainerRef}>
              {squareLoading && <div className="bp-card-loading">Loading payment form...</div>}
            </div>

            {error && <div className="bp-error-message">{error}</div>}

            <div className="bp-booking-terms">
              <h4>Booking Terms</h4>
              <ul>
                <li><i className="fas fa-times-circle"></i> No cancellations within 24 hours of session</li>
                <li><i className="fas fa-dollar-sign"></i> Deposits are non-refundable</li>
                <li><i className="fas fa-calendar-alt"></i> Reschedules must be 24+ hours in advance</li>
              </ul>
            </div>

            <button
              className="bp-pay-btn"
              onClick={handlePayment}
              disabled={loading || squareLoading}
            >
              {loading ? 'Processing...' : `Pay $${payment.deposit} Deposit`}
            </button>

            <p className="bp-secure-notice">
              <i className="fas fa-lock"></i> Secured by Square
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderConfirmationStep = (): ReactNode => (
    <div className="bp-confirmation-step bp-booked">
      <div className="bp-confirmation-icon bp-success">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>

      <h2>Booked!</h2>
      <p className="bp-booking-ref">Confirmation #{bookingNumber}</p>

      <div className="bp-confirmation-summary">
        {category === 'recording' && (
          <div className="bp-conf-row">
            <span>Service</span>
            <span>{hours} Hour Recording Session</span>
          </div>
        )}
        {category === 'mixing' && (
          <div className="bp-conf-row">
            <span>Service</span>
            <span>{mixingTiers.find(t => t.id === mixingTier)?.name}</span>
          </div>
        )}
        {category === 'mastering' && (
          <div className="bp-conf-row">
            <span>Service</span>
            <span>{masteringTiers.find(t => t.id === masteringTier)?.name}</span>
          </div>
        )}
        {category === 'consulting' && (
          <div className="bp-conf-row">
            <span>Service</span>
            <span>Consultation Call</span>
          </div>
        )}
        {selectedDate && selectedTime && (
          <div className="bp-conf-row">
            <span>Date & Time</span>
            <span>{format(selectedDate, 'EEEE, MMMM d')} at {formatTime(selectedTime)}</span>
          </div>
        )}
        <div className="bp-conf-row">
          <span>Deposit Paid</span>
          <span className="bp-paid">${payment.deposit} ✓</span>
        </div>
        {payment.balance > 0 && (
          <div className="bp-conf-row">
            <span>Balance Due</span>
            <span>${payment.balance} at studio</span>
          </div>
        )}
      </div>

      <p className="bp-confirmation-email">
        Confirmation details have been sent to<br />
        <strong>{formData.email}</strong>
      </p>

      <p className="bp-reschedule-note">
        Need to reschedule? Use the link in your confirmation email<br />
        <small>(must be 24+ hours before your session)</small>
      </p>

      <div className="bp-confirmation-actions">
        <Link to="/" className="bp-btn-primary">Done</Link>
      </div>
    </div>
  );

  // ============================================
  // Progress Indicator
  // ============================================

  const getProgressSteps = () => {
    if (category === 'mixing' && mixingDelivery === 'remote') {
      return ['Service', 'Upload', 'Info', 'Payment'];
    }
    if (category === 'promo' && selectedPromo?.includesBeat) {
      return ['Service', 'Beat', 'Schedule', 'Info', 'Payment'];
    }
    return ['Service', 'Schedule', 'Info', 'Payment'];
  };

  const getCurrentStepIndex = () => {
    const steps = getProgressSteps();
    const stepMap: Record<BookingStep, string> = {
      category: 'Service',
      service: 'Service',
      beats: 'Beat',
      upload: 'Upload',
      schedule: 'Schedule',
      info: 'Info',
      payment: 'Payment',
      confirmation: 'Payment'
    };
    return steps.indexOf(stepMap[step]);
  };

  // ============================================
  // Main Render
  // ============================================

  return (
    <div className="book-page">
      <div className="bp-wrapper">
        {/* Progress indicator */}
        {step !== 'category' && step !== 'confirmation' && (
          <div className="bp-progress">
            {getProgressSteps().map((label, idx) => (
              <div key={label} className="bp-progress-item">
                <div className={`bp-progress-step ${idx <= getCurrentStepIndex() ? 'active' : ''}`}>
                  <span className="bp-step-num">{idx + 1}</span>
                  <span className="bp-step-text">{label}</span>
                </div>
                {idx < getProgressSteps().length - 1 && <div className="bp-progress-line" />}
              </div>
            ))}
          </div>
        )}

        {/* Step content */}
        <div className="bp-content">
          {step === 'category' && renderCategoryStep()}
          {step === 'service' && renderServiceStep()}
          {step === 'beats' && renderBeatsStep()}
          {step === 'upload' && renderUploadStep()}
          {step === 'schedule' && renderScheduleStep()}
          {step === 'info' && renderInfoStep()}
          {step === 'payment' && renderPaymentStep()}
          {step === 'confirmation' && renderConfirmationStep()}
        </div>
      </div>
    </div>
  );
}
