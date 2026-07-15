import { useState, useEffect, useRef, ChangeEvent, FormEvent, MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { API_URL } from '../config';

// ============================================
// Type Definitions
// ============================================

/** Beat interface */
interface Beat {
  id: string;
  title: string;
  producedBy?: string;
  genre: string;
  bpm: number;
  key?: string;
  price: number;
  duration?: number;
  category?: string;
  coverArt?: string;
  audioUrl?: string;
  wavUrl?: string;
  soldExclusively: boolean;
  soldExclusivelyTo?: string;
  createdAt: string;
  updatedAt?: string;
}

/** Team member interface */
interface TeamMember {
  id: string;
  name: string;
  role?: string;
  credits?: string;
  placements?: string;
  description?: string;
  photoUrl?: string;
  photoData?: string;
  photoFile?: string;
  displayOnHome: boolean;
  createdAt: string;
}

/** Admin/User interface for user management */
interface User {
  id: string;
  username: string;
  email?: string;
  role?: string;
  createdAt: string;
}

/** Customer interface */
interface Customer {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  stageName?: string;
  phone?: string;
  profession?: string;
  city?: string;
  state?: string;
  username?: string;
  isGuest?: boolean;
  profilePicture?: string;
  createdAt: string;
  _count?: {
    orders?: number;
    likes?: number;
    comments?: number;
  };
}

/** Order item interface */
interface OrderItem {
  id: string;
  orderId: string;
  beatId: string;
  licenseType: string;
  licenseName?: string;
  price: number;
  beat?: Beat;
}

/** Order interface */
interface Order {
  id: string;
  orderNumber: string;
  customerId?: string;
  customerEmail: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  totalAmount: number;
  downloadToken?: string;
  downloadExpiresAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  items?: OrderItem[];
}

/** Booking interface */
interface Booking {
  id: string;
  bookingNumber: string;
  name: string;
  email: string;
  phone: string;
  artistName?: string;
  songTitle?: string;
  recordingDetails?: string;
  sessionType: string;
  sessionPrice: number;
  durationMinutes: number;
  scheduledAt: string;
  timezone: string;
  depositAmount: number;
  depositPaid: boolean;
  balanceAmount: number;
  balancePaid: boolean;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  category?: string;
  hours?: number;
  mixingTier?: string;
  mixingDelivery?: string;
  createdAt: string;
}

/** Promo interface */
interface Promo {
  id: string;
  name: string;
  description?: string;
  price: number;
  originalValue: number;
  includesSession: boolean;
  sessionHours?: number;
  includesBeat: boolean;
  beatLicenseType?: string;
  includesMixing: boolean;
  mixingTier?: string;
  active: boolean;
  validFrom?: string;
  validUntil?: string;
  createdAt: string;
  bookingsCount?: number;
  savings?: number;
  savingsPercent?: number;
}

/** Metrics data interface */
interface MetricsData {
  totalOrders: number;
  totalRevenue: number;
  completedOrders: number;
  averageOrderValue: number;
  ordersOverTime?: Array<{
    date: string;
    count: number;
    revenue?: number;
  }>;
}

/** Dashboard stats interface */
interface DashboardStats {
  totalBeats: number;
  totalOrders: number;
  totalRevenue: number;
  totalCustomers: number;
}

/** Navigation item interface */
interface NavItem {
  id: string;
  label: string;
  icon: string;
}

/** Modal types for different operations */
type ModalType = 'beat' | 'team' | 'user' | 'customer' | 'order-view' | 'order-edit' | '';

/** Form data type - can be any of our editable entities */
type FormDataType = Partial<Beat> | Partial<TeamMember> | Partial<User> | Partial<Customer> | Partial<Order>;

/** File upload state */
interface FileState {
  audioFile?: File;
  wavFile?: File;
  coverArt?: File;
  photoFile?: File;
  [key: string]: File | undefined;
}

/** Modal props interface */
interface AdminModalProps {
  type: ModalType;
  item: FormDataType | null;
  onClose: () => void;
  onSave: () => void;
  token: string | null;
}

// ============================================
// Main Component
// ============================================

export default function AdminDashboard(): JSX.Element | null {
  const { admin, token, loading: authLoading, isAuthenticated, logout } = useAdminAuth();
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Data states
  const [beats, setBeats] = useState<Beat[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);

  // Promo form state
  const [showPromoModal, setShowPromoModal] = useState<boolean>(false);
  const [editingPromo, setEditingPromo] = useState<Promo | null>(null);
  const [promoForm, setPromoForm] = useState({
    name: '',
    description: '',
    price: '',
    originalValue: '',
    includesSession: true,
    sessionHours: '',
    includesBeat: false,
    beatLicenseType: 'MP3',
    includesMixing: false,
    mixingTier: '',
    active: true,
    validFrom: '',
    validUntil: ''
  });

  // Stats
  const [stats, setStats] = useState<DashboardStats>({
    totalBeats: 0,
    totalOrders: 0,
    totalRevenue: 0,
    totalCustomers: 0
  });

  // Modal states
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modalType, setModalType] = useState<ModalType>('');
  const [editingItem, setEditingItem] = useState<FormDataType | null>(null);

  // Filter states
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [metricsPeriod, setMetricsPeriod] = useState<string>('30d');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>('all');

  // Audio player
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingBeatId, setPlayingBeatId] = useState<string | null>(null);
  // Note: audioProgress kept for future progress bar implementation
  const [_audioProgress, setAudioProgress] = useState<number>(0);

  // No redirect needed on logout/expiry - AdminGate (App.tsx) swaps to the
  // login form automatically once isAuthenticated flips false.

  useEffect(() => {
    if (isAuthenticated) {
      fetchAllData();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && activeSection === 'metrics') {
      fetchMetrics();
    }
  }, [isAuthenticated, activeSection, metricsPeriod]);

  const fetchAllData = async (): Promise<void> => {
    setLoading(true);
    try {
      const headers: HeadersInit = { 'Authorization': `Bearer ${token}` };

      const [beatsRes, teamRes, usersRes, customersRes, ordersRes, bookingsRes, promosRes] = await Promise.all([
        fetch(`${API_URL}/beats`, { headers }),
        fetch(`${API_URL}/photos?category=team`, { headers }),
        fetch(`${API_URL}/users`, { headers }),
        fetch(`${API_URL}/customers/admin/list`, { headers }),
        fetch(`${API_URL}/admin/orders`, { headers }),
        fetch(`${API_URL}/admin/bookings`, { headers }),
        fetch(`${API_URL}/admin/promos`, { headers })
      ]);

      const beatsData = await beatsRes.json();
      const teamData = await teamRes.json();
      const usersData = await usersRes.json();
      const customersData = await customersRes.json();
      const ordersData = await ordersRes.json();
      const bookingsData = bookingsRes.ok ? await bookingsRes.json() : [];
      const promosData = promosRes.ok ? await promosRes.json() : [];

      setBeats(Array.isArray(beatsData) ? beatsData : []);
      setTeam(Array.isArray(teamData) ? teamData : []);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setCustomers(Array.isArray(customersData) ? customersData : []);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setBookings(Array.isArray(bookingsData) ? bookingsData : []);
      setPromos(Array.isArray(promosData) ? promosData : []);

      // Calculate stats
      const ordersList: Order[] = Array.isArray(ordersData) ? ordersData : [];
      const paidOrders = ordersList.filter((o: Order) => o.paymentStatus === 'PAID');
      setStats({
        totalBeats: Array.isArray(beatsData) ? beatsData.length : 0,
        totalOrders: paidOrders.length,
        totalRevenue: paidOrders.reduce((sum: number, o: Order) => sum + (parseFloat(String(o.totalAmount)) || 0), 0),
        totalCustomers: Array.isArray(customersData) ? customersData.length : 0
      });
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async (): Promise<void> => {
    try {
      const res = await fetch(`${API_URL}/admin/metrics/orders?period=${metricsPeriod}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data: MetricsData = await res.json();
      setMetrics(data);
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    }
  };

  const handleLogout = (): void => {
    logout();
    // AdminGate (App.tsx) swaps to the login form automatically once
    // isAuthenticated flips false - no navigation needed.
  };

  // Audio player functions
  const playBeat = (beat: Beat): void => {
    if (playingBeatId === beat.id) {
      audioRef.current?.pause();
      setPlayingBeatId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = beat.audioUrl || '';
        audioRef.current.play();
        setPlayingBeatId(beat.id);
      }
    }
  };

  const handleTimeUpdate = (): void => {
    if (audioRef.current) {
      const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setAudioProgress(progress);
    }
  };

  // CRUD operations
  const deleteBeat = async (id: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this beat?')) return;
    try {
      await fetch(`${API_URL}/beats/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setBeats(beats.filter((b: Beat) => b.id !== id));
    } catch (err) {
      alert('Failed to delete beat');
    }
  };

  const deleteTeamMember = async (id: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this team member?')) return;
    try {
      await fetch(`${API_URL}/photos/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setTeam(team.filter((t: TeamMember) => t.id !== id));
    } catch (err) {
      alert('Failed to delete team member');
    }
  };

  const deleteUser = async (id: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await fetch(`${API_URL}/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setUsers(users.filter((u: User) => u.id !== id));
    } catch (err) {
      alert('Failed to delete user');
    }
  };

  const impersonateCustomer = async (customerId: string): Promise<void> => {
    try {
      const res = await fetch(`${API_URL}/customers/admin/${customerId}/impersonate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data: { token?: string } = await res.json();
      if (data.token) {
        window.open(`/dashboard?impersonate=${data.token}`, '_blank');
      }
    } catch (err) {
      alert('Failed to impersonate customer');
    }
  };

  const resendOrderEmail = async (orderId: string): Promise<void> => {
    try {
      await fetch(`${API_URL}/admin/orders/${orderId}/resend-email`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      alert('Email sent successfully');
    } catch (err) {
      alert('Failed to send email');
    }
  };

  const extendDownload = async (orderId: string): Promise<void> => {
    try {
      await fetch(`${API_URL}/admin/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ extendDownload: true })
      });
      alert('Download extended by 7 days');
      fetchAllData();
    } catch (err) {
      alert('Failed to extend download');
    }
  };

  const deleteOrder = async (id: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this order? This action cannot be undone.')) return;
    try {
      const res = await fetch(`${API_URL}/admin/orders/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data: { message?: string } = await res.json();
        throw new Error(data.message || 'Failed to delete order');
      }
      setOrders(orders.filter((o: Order) => o.id !== id));
    } catch (err) {
      const error = err as Error;
      alert(error.message || 'Failed to delete order');
    }
  };

  const refundOrder = async (order: Order): Promise<void> => {
    if (!confirm(`Refund order #${order.orderNumber} for ${formatCurrency(order.totalAmount)}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_URL}/orders/${order.id}/refund`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data: { message?: string } = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to refund order');
      }
      alert('Order refunded successfully');
      fetchAllData();
    } catch (err) {
      const error = err as Error;
      alert(error.message || 'Failed to refund order');
    }
  };

  const deleteCustomer = async (id: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this customer? This will also delete all their orders, comments, likes, and playlists. This action cannot be undone.')) return;
    try {
      const res = await fetch(`${API_URL}/customers/admin/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data: { message?: string } = await res.json();
        throw new Error(data.message || 'Failed to delete customer');
      }
      setCustomers(customers.filter((c: Customer) => c.id !== id));
    } catch (err) {
      const error = err as Error;
      alert(error.message || 'Failed to delete customer');
    }
  };

  // Open modal for add/edit
  const openModal = (type: ModalType, item: FormDataType | null = null): void => {
    setModalType(type);
    setEditingItem(item);
    setShowModal(true);
  };

  const closeModal = (): void => {
    setShowModal(false);
    setModalType('');
    setEditingItem(null);
  };

  // Format helpers
  const formatDate = (date: string): string => new Date(date).toLocaleDateString();
  const formatCurrency = (amount: number | string): string => `$${parseFloat(String(amount || 0)).toFixed(2)}`;

  // Get team member photo URL
  const getPhotoUrl = (member: TeamMember): string | null => {
    if (member.photoData) return member.photoData;
    if (member.photoUrl) {
      return member.photoUrl.startsWith('http')
        ? member.photoUrl
        : `${API_URL.replace('/api', '')}/${member.photoUrl}`;
    }
    if (member.photoFile) {
      return member.photoFile.startsWith('http')
        ? member.photoFile
        : `${API_URL.replace('/api', '')}/${member.photoFile}`;
    }
    return null;
  };

  if (authLoading) {
    return (
      <div className="admin-loading">
        <div className="admin-spinner"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const navItems: NavItem[] = [
    { id: 'overview', label: 'Dashboard', icon: 'fa-th-large' },
    { id: 'beats', label: 'Beats', icon: 'fa-music' },
    { id: 'team', label: 'Team', icon: 'fa-users' },
    { id: 'users', label: 'Users', icon: 'fa-user-shield' },
    { id: 'customers', label: 'Customers', icon: 'fa-user-friends' },
    { id: 'orders', label: 'Orders', icon: 'fa-shopping-cart' },
    { id: 'bookings', label: 'Bookings', icon: 'fa-calendar-check' },
    { id: 'promos', label: 'Promos', icon: 'fa-tags' },
    { id: 'metrics', label: 'Metrics', icon: 'fa-chart-line' },
    { id: 'settings', label: 'Settings', icon: 'fa-cog' },
  ];

  const filteredOrders = orders.filter((order: Order) => {
    if (orderStatusFilter !== 'all' && order.status !== orderStatusFilter) return false;
    if (paymentStatusFilter !== 'all' && order.paymentStatus !== paymentStatusFilter) return false;
    return true;
  });

  const filteredBookings = bookings.filter((booking: Booking) => {
    if (bookingStatusFilter !== 'all' && booking.status !== bookingStatusFilter) return false;
    return true;
  });

  // Booking management functions
  const updateBookingStatus = async (bookingId: string, newStatus: string): Promise<void> => {
    try {
      const res = await fetch(`${API_URL}/admin/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Failed to update booking status');
      fetchAllData();
    } catch (err) {
      alert('Failed to update booking status');
    }
  };

  const cancelBooking = async (bookingId: string): Promise<void> => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    try {
      const res = await fetch(`${API_URL}/admin/bookings/${bookingId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to cancel booking');
      setBookings(bookings.filter((b: Booking) => b.id !== bookingId));
    } catch (err) {
      alert('Failed to cancel booking');
    }
  };

  const refundBooking = async (booking: Booking): Promise<void> => {
    if (!confirm(`Refund the deposit (${formatCurrency(booking.depositAmount)}) for booking #${booking.bookingNumber}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_URL}/bookings/${booking.id}/refund`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data: { message?: string } = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to refund booking deposit');
      }
      alert('Booking deposit refunded successfully');
      fetchAllData();
    } catch (err) {
      const error = err as Error;
      alert(error.message || 'Failed to refund booking deposit');
    }
  };

  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Promo management functions
  const openPromoModal = (promo?: Promo): void => {
    if (promo) {
      setEditingPromo(promo);
      setPromoForm({
        name: promo.name,
        description: promo.description || '',
        price: promo.price.toString(),
        originalValue: promo.originalValue.toString(),
        includesSession: promo.includesSession,
        sessionHours: promo.sessionHours?.toString() || '',
        includesBeat: promo.includesBeat,
        beatLicenseType: promo.beatLicenseType || 'MP3',
        includesMixing: promo.includesMixing,
        mixingTier: promo.mixingTier || '',
        active: promo.active,
        validFrom: promo.validFrom ? promo.validFrom.split('T')[0] : '',
        validUntil: promo.validUntil ? promo.validUntil.split('T')[0] : ''
      });
    } else {
      setEditingPromo(null);
      setPromoForm({
        name: '',
        description: '',
        price: '',
        originalValue: '',
        includesSession: true,
        sessionHours: '1',
        includesBeat: false,
        beatLicenseType: 'MP3',
        includesMixing: false,
        mixingTier: '',
        active: true,
        validFrom: '',
        validUntil: ''
      });
    }
    setShowPromoModal(true);
  };

  const savePromo = async (): Promise<void> => {
    try {
      const method = editingPromo ? 'PATCH' : 'POST';
      const url = editingPromo
        ? `${API_URL}/admin/promos/${editingPromo.id}`
        : `${API_URL}/admin/promos`;

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: promoForm.name,
          description: promoForm.description || null,
          price: parseFloat(promoForm.price),
          originalValue: parseFloat(promoForm.originalValue),
          includesSession: promoForm.includesSession,
          sessionHours: promoForm.sessionHours ? parseInt(promoForm.sessionHours) : null,
          includesBeat: promoForm.includesBeat,
          beatLicenseType: promoForm.includesBeat ? promoForm.beatLicenseType : null,
          includesMixing: promoForm.includesMixing,
          mixingTier: promoForm.includesMixing ? promoForm.mixingTier : null,
          active: promoForm.active,
          validFrom: promoForm.validFrom || null,
          validUntil: promoForm.validUntil || null
        })
      });

      if (!res.ok) throw new Error('Failed to save promo');
      setShowPromoModal(false);
      fetchAllData();
    } catch (err) {
      alert('Failed to save promo');
    }
  };

  const deletePromo = async (promoId: string): Promise<void> => {
    if (!confirm('Are you sure you want to delete this promo?')) return;
    try {
      const res = await fetch(`${API_URL}/admin/promos/${promoId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete promo');
      fetchAllData();
    } catch (err) {
      alert('Failed to delete promo');
    }
  };

  const togglePromoActive = async (promo: Promo): Promise<void> => {
    try {
      const res = await fetch(`${API_URL}/admin/promos/${promo.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ active: !promo.active })
      });
      if (!res.ok) throw new Error('Failed to update promo');
      fetchAllData();
    } catch (err) {
      alert('Failed to update promo');
    }
  };

  return (
    <div className="admin-dashboard">
      {/* Hidden audio element */}
      <audio ref={audioRef} onTimeUpdate={handleTimeUpdate} onEnded={() => setPlayingBeatId(null)} />

      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="admin-sidebar-header">
          <div className="admin-brand">
            {!sidebarCollapsed && <span className="brand-text">Doc Rolds</span>}
            <span className="brand-badge">Admin</span>
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            <i className={`fas ${sidebarCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i>
          </button>
        </div>

        <nav className="admin-sidebar-nav">
          {navItems.map((item: NavItem) => (
            <button
              key={item.id}
              className={`admin-nav-item ${activeSection === item.id ? 'active' : ''}`}
              onClick={() => setActiveSection(item.id)}
            >
              <i className={`fas ${item.icon}`}></i>
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-user">
            <div className="admin-avatar">
              <span>{admin?.username?.[0]?.toUpperCase() || 'A'}</span>
            </div>
            {!sidebarCollapsed && (
              <div className="admin-user-info">
                <span className="admin-name">{admin?.username || 'Admin'}</span>
                <span className="admin-role">{admin?.role || 'Administrator'}</span>
              </div>
            )}
          </div>
          <button className="admin-nav-item logout" onClick={handleLogout}>
            <i className="fas fa-sign-out-alt"></i>
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        {/* Top Bar */}
        <header className="admin-topbar">
          <div className="topbar-left">
            <h1 className="admin-page-title">
              {navItems.find((n: NavItem) => n.id === activeSection)?.label || 'Dashboard'}
            </h1>
          </div>
          <div className="topbar-right">
            <Link to="/" className="topbar-link" target="_blank">
              <i className="fas fa-external-link-alt"></i>
              View Site
            </Link>
          </div>
        </header>

        {/* Content Area */}
        <div className="admin-content">
          {/* Overview Section */}
          {activeSection === 'overview' && (
            <div className="admin-section">
              <div className="admin-stats-grid">
                <div className="admin-stat-card">
                  <div className="stat-icon beats">
                    <i className="fas fa-music"></i>
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">{stats.totalBeats}</span>
                    <span className="stat-label">Total Beats</span>
                  </div>
                </div>
                <div className="admin-stat-card">
                  <div className="stat-icon orders">
                    <i className="fas fa-shopping-cart"></i>
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">{stats.totalOrders}</span>
                    <span className="stat-label">Paid Orders</span>
                  </div>
                </div>
                <div className="admin-stat-card">
                  <div className="stat-icon revenue">
                    <i className="fas fa-dollar-sign"></i>
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">{formatCurrency(stats.totalRevenue)}</span>
                    <span className="stat-label">Total Revenue</span>
                  </div>
                </div>
                <div className="admin-stat-card">
                  <div className="stat-icon customers">
                    <i className="fas fa-users"></i>
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">{stats.totalCustomers}</span>
                    <span className="stat-label">Customers</span>
                  </div>
                </div>
              </div>

              <div className="admin-grid">
                <div className="admin-card">
                  <div className="admin-card-header">
                    <h2>Recent Orders</h2>
                    <button className="card-action" onClick={() => setActiveSection('orders')}>
                      View All <i className="fas fa-arrow-right"></i>
                    </button>
                  </div>
                  <div className="admin-card-content">
                    {loading ? (
                      <div className="card-loading"><div className="admin-spinner small"></div></div>
                    ) : orders.length === 0 ? (
                      <div className="card-empty">
                        <i className="fas fa-shopping-cart"></i>
                        <p>No orders yet</p>
                      </div>
                    ) : (
                      <div className="admin-table-container">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Order #</th>
                              <th>Customer</th>
                              <th>Total</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orders.slice(0, 5).map((order: Order) => (
                              <tr key={order.id}>
                                <td>#{order.orderNumber}</td>
                                <td>{order.customerEmail || 'N/A'}</td>
                                <td>{formatCurrency(order.totalAmount)}</td>
                                <td>
                                  <span className={`status-badge ${order.paymentStatus?.toLowerCase()}`}>
                                    {order.paymentStatus}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                <div className="admin-card">
                  <div className="admin-card-header">
                    <h2>Quick Actions</h2>
                  </div>
                  <div className="admin-card-content">
                    <div className="quick-actions">
                      <button className="quick-action-btn" onClick={() => { setActiveSection('beats'); openModal('beat'); }}>
                        <i className="fas fa-plus"></i>
                        Add Beat
                      </button>
                      <button className="quick-action-btn" onClick={() => { setActiveSection('team'); openModal('team'); }}>
                        <i className="fas fa-user-plus"></i>
                        Add Team Member
                      </button>
                      <button className="quick-action-btn" onClick={() => setActiveSection('orders')}>
                        <i className="fas fa-list"></i>
                        View Orders
                      </button>
                      <button className="quick-action-btn" onClick={() => setActiveSection('metrics')}>
                        <i className="fas fa-chart-bar"></i>
                        View Metrics
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Beats Section */}
          {activeSection === 'beats' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Manage Beats</h2>
                <button className="admin-btn primary" onClick={() => openModal('beat')}>
                  <i className="fas fa-plus"></i> Add Beat
                </button>
              </div>

              {loading ? (
                <div className="section-loading"><div className="admin-spinner"></div></div>
              ) : (
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th style={{width: '40px'}}></th>
                        <th>Title</th>
                        <th>Producer</th>
                        <th>Genre</th>
                        <th>BPM</th>
                        <th>Key</th>
                        <th>Price</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {beats.map((beat: Beat) => (
                        <tr key={beat.id} className={beat.soldExclusively ? 'sold-row' : ''}>
                          <td>
                            <button
                              className="play-btn"
                              onClick={() => playBeat(beat)}
                              disabled={!beat.audioUrl}
                            >
                              <i className={`fas ${playingBeatId === beat.id ? 'fa-pause' : 'fa-play'}`}></i>
                            </button>
                          </td>
                          <td>
                            <div className="beat-title-cell">
                              {beat.coverArt && (
                                <img src={beat.coverArt} alt="" className="beat-thumb" />
                              )}
                              <span>{beat.title}</span>
                            </div>
                          </td>
                          <td>{beat.producedBy || 'Doc Rolds'}</td>
                          <td>{beat.genre}</td>
                          <td>{beat.bpm}</td>
                          <td>{beat.key}</td>
                          <td>{formatCurrency(beat.price)}</td>
                          <td>
                            {beat.soldExclusively ? (
                              <span className="status-badge sold">SOLD</span>
                            ) : (
                              <span className="status-badge available">Available</span>
                            )}
                          </td>
                          <td>
                            <div className="action-btns">
                              <button className="icon-btn" onClick={() => openModal('beat', beat)} title="Edit">
                                <i className="fas fa-edit"></i>
                              </button>
                              <button className="icon-btn danger" onClick={() => deleteBeat(beat.id)} title="Delete">
                                <i className="fas fa-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Team Section */}
          {activeSection === 'team' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Manage Team</h2>
                <button className="admin-btn primary" onClick={() => openModal('team')}>
                  <i className="fas fa-plus"></i> Add Member
                </button>
              </div>

              {loading ? (
                <div className="section-loading"><div className="admin-spinner"></div></div>
              ) : (
                <div className="team-grid">
                  {team.map((member: TeamMember) => {
                    const photoUrl = getPhotoUrl(member);
                    return (
                    <div key={member.id} className="team-card">
                      <div className="team-card-image">
                        {photoUrl ? (
                          <img src={photoUrl} alt={member.name} />
                        ) : (
                          <div className="team-placeholder">
                            <i className="fas fa-user"></i>
                          </div>
                        )}
                        {member.displayOnHome && (
                          <span className="home-badge" title="Shown on homepage">
                            <i className="fas fa-home"></i>
                          </span>
                        )}
                      </div>
                      <div className="team-card-content">
                        <h3>{member.name}</h3>
                        <p className="team-role">{member.role}</p>
                        {member.credits && (
                          <div className="team-tags">
                            {member.credits.split(',').slice(0, 3).map((c: string, i: number) => (
                              <span key={i} className="team-tag">{c.trim()}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="team-card-actions">
                        <button className="icon-btn" onClick={() => openModal('team', member)} title="Edit">
                          <i className="fas fa-edit"></i>
                        </button>
                        <button className="icon-btn danger" onClick={() => deleteTeamMember(member.id)} title="Delete">
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Users Section */}
          {activeSection === 'users' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Manage Users</h2>
                <button className="admin-btn primary" onClick={() => openModal('user')}>
                  <i className="fas fa-plus"></i> Add User
                </button>
              </div>

              {loading ? (
                <div className="section-loading"><div className="admin-spinner"></div></div>
              ) : (
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user: User) => (
                        <tr key={user.id}>
                          <td>{user.username}</td>
                          <td>{user.email || '-'}</td>
                          <td>
                            <span className={`role-badge ${user.role?.toLowerCase()}`}>
                              {user.role || 'User'}
                            </span>
                          </td>
                          <td>{formatDate(user.createdAt)}</td>
                          <td>
                            <div className="action-btns">
                              <button className="icon-btn" onClick={() => openModal('user', user)} title="Edit">
                                <i className="fas fa-edit"></i>
                              </button>
                              <button className="icon-btn danger" onClick={() => deleteUser(user.id)} title="Delete">
                                <i className="fas fa-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Customers Section */}
          {activeSection === 'customers' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Customers</h2>
              </div>

              {loading ? (
                <div className="section-loading"><div className="admin-spinner"></div></div>
              ) : (
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Name</th>
                        <th>Stage Name</th>
                        <th>Orders</th>
                        <th>Joined</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map((customer: Customer) => (
                        <tr key={customer.id}>
                          <td>{customer.email}</td>
                          <td>{customer.firstName} {customer.lastName}</td>
                          <td>{customer.stageName || '-'}</td>
                          <td>{customer._count?.orders || 0}</td>
                          <td>{formatDate(customer.createdAt)}</td>
                          <td>
                            <div className="action-btns">
                              <button
                                className="icon-btn"
                                onClick={() => impersonateCustomer(customer.id)}
                                title="View as customer"
                              >
                                <i className="fas fa-eye"></i>
                              </button>
                              <button
                                className="icon-btn"
                                onClick={() => openModal('customer', customer)}
                                title="Edit customer"
                              >
                                <i className="fas fa-edit"></i>
                              </button>
                              <button
                                className="icon-btn danger"
                                onClick={() => deleteCustomer(customer.id)}
                                title="Delete customer"
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Orders Section */}
          {activeSection === 'orders' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Orders</h2>
                <div className="filter-group">
                  <select
                    value={orderStatusFilter}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setOrderStatusFilter(e.target.value)}
                    className="admin-select"
                  >
                    <option value="all">All Status</option>
                    <option value="PENDING">Pending</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                  <select
                    value={paymentStatusFilter}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setPaymentStatusFilter(e.target.value)}
                    className="admin-select"
                  >
                    <option value="all">All Payments</option>
                    <option value="PENDING">Payment Pending</option>
                    <option value="PAID">Paid</option>
                    <option value="FAILED">Failed</option>
                    <option value="REFUNDED">Refunded</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="section-loading"><div className="admin-spinner"></div></div>
              ) : (
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Order #</th>
                        <th>Customer</th>
                        <th>Items</th>
                        <th>Total</th>
                        <th>Payment</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((order: Order) => (
                        <tr key={order.id}>
                          <td>#{order.orderNumber}</td>
                          <td>{order.customerEmail}</td>
                          <td>{order.items?.length || 0} beat(s)</td>
                          <td>{formatCurrency(order.totalAmount)}</td>
                          <td>
                            <span className={`status-badge ${order.paymentStatus?.toLowerCase()}`}>
                              {order.paymentStatus}
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge ${order.status?.toLowerCase()}`}>
                              {order.status}
                            </span>
                          </td>
                          <td>{formatDate(order.createdAt)}</td>
                          <td>
                            <div className="action-btns">
                              <button
                                className="icon-btn"
                                onClick={() => openModal('order-view', order)}
                                title="View Details"
                              >
                                <i className="fas fa-eye"></i>
                              </button>
                              <button
                                className="icon-btn"
                                onClick={() => openModal('order-edit', order)}
                                title="Edit Order"
                              >
                                <i className="fas fa-edit"></i>
                              </button>
                              <button
                                className="icon-btn"
                                onClick={() => resendOrderEmail(order.id)}
                                title="Resend Email"
                              >
                                <i className="fas fa-envelope"></i>
                              </button>
                              <button
                                className="icon-btn"
                                onClick={() => extendDownload(order.id)}
                                title="Extend Download"
                              >
                                <i className="fas fa-clock"></i>
                              </button>
                              {order.paymentStatus === 'PAID' && (
                                <button
                                  className="icon-btn danger"
                                  onClick={() => refundOrder(order)}
                                  title="Refund Order"
                                >
                                  <i className="fas fa-undo"></i>
                                </button>
                              )}
                              <button
                                className="icon-btn danger"
                                onClick={() => deleteOrder(order.id)}
                                title="Delete Order"
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Bookings Section */}
          {activeSection === 'bookings' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Session Bookings</h2>
                <div className="filter-group">
                  <select
                    value={bookingStatusFilter}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setBookingStatusFilter(e.target.value)}
                    className="admin-select"
                  >
                    <option value="all">All Status</option>
                    <option value="PENDING">Pending</option>
                    <option value="CONFIRMED">Confirmed</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Upcoming Sessions Summary */}
              <div className="admin-stats-grid" style={{ marginBottom: '2rem' }}>
                <div className="admin-stat-card">
                  <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                    <i className="fas fa-calendar-check"></i>
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">{bookings.filter((b: Booking) => b.status === 'CONFIRMED').length}</span>
                    <span className="stat-label">Upcoming Sessions</span>
                  </div>
                </div>
                <div className="admin-stat-card">
                  <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
                    <i className="fas fa-clock"></i>
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">{bookings.filter((b: Booking) => b.status === 'PENDING').length}</span>
                    <span className="stat-label">Pending</span>
                  </div>
                </div>
                <div className="admin-stat-card">
                  <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">{bookings.filter((b: Booking) => b.status === 'COMPLETED').length}</span>
                    <span className="stat-label">Completed</span>
                  </div>
                </div>
                <div className="admin-stat-card">
                  <div className="stat-icon revenue">
                    <i className="fas fa-dollar-sign"></i>
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">{formatCurrency(bookings.filter((b: Booking) => b.depositPaid).reduce((sum: number, b: Booking) => sum + b.depositAmount, 0))}</span>
                    <span className="stat-label">Deposits Collected</span>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="section-loading"><div className="admin-spinner"></div></div>
              ) : filteredBookings.length === 0 ? (
                <div className="admin-card">
                  <div className="admin-card-content">
                    <div className="card-empty">
                      <i className="fas fa-calendar-alt"></i>
                      <p>No bookings found</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Booking #</th>
                        <th>Client</th>
                        <th>Session</th>
                        <th>Date & Time</th>
                        <th>Deposit</th>
                        <th>Balance</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBookings.map((booking: Booking) => (
                        <tr key={booking.id}>
                          <td>
                            <span style={{ fontWeight: 500, color: 'var(--primary)' }}>
                              #{booking.bookingNumber}
                            </span>
                          </td>
                          <td>
                            <div>
                              <div style={{ fontWeight: 500 }}>{booking.name}</div>
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                {booking.email}
                              </div>
                              {booking.artistName && (
                                <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '2px' }}>
                                  {booking.artistName}
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            <div>
                              <div style={{ fontWeight: 500 }}>{booking.sessionType}</div>
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                {booking.durationMinutes} min • {formatCurrency(booking.sessionPrice)}
                              </div>
                            </div>
                          </td>
                          <td>{formatDateTime(booking.scheduledAt)}</td>
                          <td>
                            <span className={`status-badge ${booking.depositPaid ? 'paid' : 'pending'}`}>
                              {booking.depositPaid ? 'Paid' : 'Pending'} ({formatCurrency(booking.depositAmount)})
                            </span>
                          </td>
                          <td>{formatCurrency(booking.balanceAmount)}</td>
                          <td>
                            <span className={`status-badge ${booking.status.toLowerCase()}`}>
                              {booking.status}
                            </span>
                          </td>
                          <td>
                            <div className="action-btns">
                              {booking.status === 'CONFIRMED' && (
                                <button
                                  className="icon-btn"
                                  onClick={() => updateBookingStatus(booking.id, 'COMPLETED')}
                                  title="Mark as Completed"
                                >
                                  <i className="fas fa-check"></i>
                                </button>
                              )}
                              {booking.status === 'PENDING' && (
                                <button
                                  className="icon-btn"
                                  onClick={() => updateBookingStatus(booking.id, 'CONFIRMED')}
                                  title="Confirm Booking"
                                >
                                  <i className="fas fa-check-circle"></i>
                                </button>
                              )}
                              {(booking.status === 'PENDING' || booking.status === 'CONFIRMED') && (
                                <button
                                  className="icon-btn danger"
                                  onClick={() => cancelBooking(booking.id)}
                                  title="Cancel Booking"
                                >
                                  <i className="fas fa-times"></i>
                                </button>
                              )}
                              {booking.depositPaid && (
                                <button
                                  className="icon-btn danger"
                                  onClick={() => refundBooking(booking)}
                                  title="Refund Deposit"
                                >
                                  <i className="fas fa-undo"></i>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Promos Section */}
          {activeSection === 'promos' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Promos & Specials</h2>
                <button className="btn-primary" onClick={() => openPromoModal()}>
                  <i className="fas fa-plus"></i> New Promo
                </button>
              </div>

              {/* Promo Stats */}
              <div className="stats-grid">
                <div className="stat-card">
                  <i className="fas fa-tags stat-icon"></i>
                  <div className="stat-content">
                    <span className="stat-value">{promos.filter(p => p.active).length}</span>
                    <span className="stat-label">Active Promos</span>
                  </div>
                </div>
                <div className="stat-card">
                  <i className="fas fa-calendar-check stat-icon"></i>
                  <div className="stat-content">
                    <span className="stat-value">{promos.reduce((sum, p) => sum + (p.bookingsCount || 0), 0)}</span>
                    <span className="stat-label">Total Bookings</span>
                  </div>
                </div>
              </div>

              {/* Promos List */}
              {promos.length === 0 ? (
                <div className="empty-state">
                  <i className="fas fa-tags"></i>
                  <p>No promos created yet</p>
                  <button className="btn-primary" onClick={() => openPromoModal()}>Create Your First Promo</button>
                </div>
              ) : (
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Price</th>
                        <th>Savings</th>
                        <th>Includes</th>
                        <th>Bookings</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {promos.map((promo) => (
                        <tr key={promo.id} className={!promo.active ? 'inactive-row' : ''}>
                          <td>
                            <div className="promo-name-cell">
                              <strong>{promo.name}</strong>
                              {promo.description && <small>{promo.description}</small>}
                            </div>
                          </td>
                          <td>
                            <span className="promo-price">${promo.price}</span>
                            <br />
                            <small className="original-price">${promo.originalValue}</small>
                          </td>
                          <td>
                            <span className="savings-badge">
                              Save ${promo.savings} ({promo.savingsPercent}%)
                            </span>
                          </td>
                          <td>
                            <div className="promo-includes">
                              {promo.includesSession && (
                                <span className="include-tag"><i className="fas fa-microphone"></i> {promo.sessionHours}hr Session</span>
                              )}
                              {promo.includesBeat && (
                                <span className="include-tag"><i className="fas fa-music"></i> {promo.beatLicenseType} Beat</span>
                              )}
                              {promo.includesMixing && (
                                <span className="include-tag"><i className="fas fa-sliders-h"></i> {promo.mixingTier} Mix</span>
                              )}
                            </div>
                          </td>
                          <td>{promo.bookingsCount || 0}</td>
                          <td>
                            <span className={`status-badge ${promo.active ? 'status-active' : 'status-inactive'}`}>
                              {promo.active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button
                                className="btn-icon"
                                onClick={() => openPromoModal(promo)}
                                title="Edit Promo"
                              >
                                <i className="fas fa-edit"></i>
                              </button>
                              <button
                                className={`btn-icon ${promo.active ? 'btn-warning' : 'btn-success'}`}
                                onClick={() => togglePromoActive(promo)}
                                title={promo.active ? 'Deactivate' : 'Activate'}
                              >
                                <i className={`fas ${promo.active ? 'fa-pause' : 'fa-play'}`}></i>
                              </button>
                              <button
                                className="btn-icon btn-danger"
                                onClick={() => deletePromo(promo.id)}
                                title="Delete Promo"
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Promo Modal */}
          {showPromoModal && (
            <div className="modal-overlay" onClick={() => setShowPromoModal(false)}>
              <div className="modal-content promo-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>{editingPromo ? 'Edit Promo' : 'Create New Promo'}</h2>
                  <button className="modal-close" onClick={() => setShowPromoModal(false)}>
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                <div className="modal-body">
                  <div className="form-group">
                    <label>Promo Name *</label>
                    <input
                      type="text"
                      value={promoForm.name}
                      onChange={(e) => setPromoForm({ ...promoForm, name: e.target.value })}
                      placeholder="e.g., Session + Beat Bundle"
                    />
                  </div>
                  <div className="form-group">
                    <label>Description</label>
                    <textarea
                      value={promoForm.description}
                      onChange={(e) => setPromoForm({ ...promoForm, description: e.target.value })}
                      placeholder="Brief description of what's included"
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Sale Price *</label>
                      <input
                        type="number"
                        value={promoForm.price}
                        onChange={(e) => setPromoForm({ ...promoForm, price: e.target.value })}
                        placeholder="120"
                      />
                    </div>
                    <div className="form-group">
                      <label>Original Value *</label>
                      <input
                        type="number"
                        value={promoForm.originalValue}
                        onChange={(e) => setPromoForm({ ...promoForm, originalValue: e.target.value })}
                        placeholder="160"
                      />
                    </div>
                  </div>

                  <h4>What's Included</h4>

                  <div className="form-checkbox-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={promoForm.includesSession}
                        onChange={(e) => setPromoForm({ ...promoForm, includesSession: e.target.checked })}
                      />
                      <span>Recording Session</span>
                    </label>
                    {promoForm.includesSession && (
                      <div className="form-group inline-field">
                        <label>Hours:</label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={promoForm.sessionHours}
                          onChange={(e) => setPromoForm({ ...promoForm, sessionHours: e.target.value })}
                        />
                      </div>
                    )}
                  </div>

                  <div className="form-checkbox-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={promoForm.includesBeat}
                        onChange={(e) => setPromoForm({ ...promoForm, includesBeat: e.target.checked })}
                      />
                      <span>Beat License</span>
                    </label>
                    {promoForm.includesBeat && (
                      <div className="form-group inline-field">
                        <label>License Type:</label>
                        <select
                          value={promoForm.beatLicenseType}
                          onChange={(e) => setPromoForm({ ...promoForm, beatLicenseType: e.target.value })}
                        >
                          <option value="MP3">MP3 Lease</option>
                          <option value="WAV">WAV Lease</option>
                          <option value="UNLIMITED">Unlimited</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="form-checkbox-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={promoForm.includesMixing}
                        onChange={(e) => setPromoForm({ ...promoForm, includesMixing: e.target.checked })}
                      />
                      <span>Mixing Service</span>
                    </label>
                    {promoForm.includesMixing && (
                      <div className="form-group inline-field">
                        <label>Tier:</label>
                        <select
                          value={promoForm.mixingTier}
                          onChange={(e) => setPromoForm({ ...promoForm, mixingTier: e.target.value })}
                        >
                          <option value="">Select tier</option>
                          <option value="BASIC">Basic</option>
                          <option value="STANDARD">Standard</option>
                          <option value="PRO">Pro</option>
                          <option value="PREMIUM">Premium</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <h4>Availability</h4>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Valid From</label>
                      <input
                        type="date"
                        value={promoForm.validFrom}
                        onChange={(e) => setPromoForm({ ...promoForm, validFrom: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Valid Until</label>
                      <input
                        type="date"
                        value={promoForm.validUntil}
                        onChange={(e) => setPromoForm({ ...promoForm, validUntil: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-checkbox-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={promoForm.active}
                        onChange={(e) => setPromoForm({ ...promoForm, active: e.target.checked })}
                      />
                      <span>Active (visible to customers)</span>
                    </label>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn-secondary" onClick={() => setShowPromoModal(false)}>Cancel</button>
                  <button className="btn-primary" onClick={savePromo}>
                    {editingPromo ? 'Save Changes' : 'Create Promo'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Metrics Section */}
          {activeSection === 'metrics' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Analytics</h2>
                <div className="filter-group">
                  <select
                    value={metricsPeriod}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setMetricsPeriod(e.target.value)}
                    className="admin-select"
                  >
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                    <option value="90d">Last 90 Days</option>
                  </select>
                </div>
              </div>

              <div className="admin-stats-grid">
                <div className="admin-stat-card">
                  <div className="stat-icon orders">
                    <i className="fas fa-shopping-cart"></i>
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">{metrics?.totalOrders || 0}</span>
                    <span className="stat-label">Total Orders</span>
                  </div>
                </div>
                <div className="admin-stat-card">
                  <div className="stat-icon revenue">
                    <i className="fas fa-dollar-sign"></i>
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">{formatCurrency(metrics?.totalRevenue || 0)}</span>
                    <span className="stat-label">Revenue</span>
                  </div>
                </div>
                <div className="admin-stat-card">
                  <div className="stat-icon completed">
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">{metrics?.completedOrders || 0}</span>
                    <span className="stat-label">Completed</span>
                  </div>
                </div>
                <div className="admin-stat-card">
                  <div className="stat-icon average">
                    <i className="fas fa-chart-line"></i>
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">{formatCurrency(metrics?.averageOrderValue || 0)}</span>
                    <span className="stat-label">Avg Order Value</span>
                  </div>
                </div>
              </div>

              <div className="admin-grid">
                <div className="admin-card full-width">
                  <div className="admin-card-header">
                    <h2>Orders Over Time</h2>
                  </div>
                  <div className="admin-card-content chart-container">
                    {metrics?.ordersOverTime ? (
                      <div className="simple-chart">
                        {metrics.ordersOverTime.map((item, i: number) => (
                          <div key={i} className="chart-bar-wrapper">
                            <div
                              className="chart-bar"
                              style={{
                                height: `${Math.max(10, (item.count / Math.max(...metrics.ordersOverTime!.map((o) => o.count))) * 150)}px`
                              }}
                              title={`${item.date}: ${item.count} orders`}
                            ></div>
                            <span className="chart-label">{item.date.split('-').slice(1).join('/')}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="card-empty">
                        <i className="fas fa-chart-bar"></i>
                        <p>No data available</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Settings Section */}
          {activeSection === 'settings' && (
            <div className="admin-section">
              <div className="section-header">
                <h2>Settings</h2>
              </div>

              <div className="admin-card">
                <div className="admin-card-header">
                  <h2>Account</h2>
                </div>
                <div className="admin-card-content">
                  <div className="settings-info">
                    <p><strong>Username:</strong> {admin?.username}</p>
                    <p><strong>Role:</strong> {admin?.role || 'Administrator'}</p>
                  </div>
                  <button className="admin-btn danger" onClick={handleLogout}>
                    <i className="fas fa-sign-out-alt"></i> Sign Out
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {showModal && (
        <AdminModal
          type={modalType}
          item={editingItem}
          onClose={closeModal}
          onSave={() => { closeModal(); fetchAllData(); }}
          token={token}
        />
      )}
    </div>
  );
}

// ============================================
// Modal Component
// ============================================

function AdminModal({ type, item, onClose, onSave, token }: AdminModalProps): JSX.Element {
  const [formData, setFormData] = useState<FormDataType>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [files, setFiles] = useState<FileState>({});

  useEffect(() => {
    if (item) {
      setFormData(item);
    } else {
      setFormData({});
    }
  }, [item]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): void => {
    const target = e.target;
    const { name, value, type: inputType } = target;
    const checked = (target as HTMLInputElement).checked;
    setFormData((prev: FormDataType) => ({
      ...prev,
      [name]: inputType === 'checkbox' ? checked : value
    }));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const { name, files: fileList } = e.target;
    if (fileList && fileList[0]) {
      setFiles((prev: FileState) => ({ ...prev, [name]: fileList[0] }));
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setLoading(true);

    try {
      let endpoint = '';
      let method = item ? 'PUT' : 'POST';

      if (type === 'beat') {
        const beatItem = item as Beat | null;
        endpoint = beatItem ? `${API_URL}/beats/${beatItem.id}` : `${API_URL}/beats`;
      } else if (type === 'team') {
        const teamItem = item as TeamMember | null;
        endpoint = teamItem ? `${API_URL}/photos/${teamItem.id}` : `${API_URL}/photos`;
      } else if (type === 'user') {
        const userItem = item as User | null;
        endpoint = userItem ? `${API_URL}/users/${userItem.id}` : `${API_URL}/users`;
      } else if (type === 'customer') {
        const customerItem = item as Customer;
        endpoint = `${API_URL}/customers/admin/${customerItem.id}`;
        method = 'PUT';
      } else if (type === 'order-edit') {
        const orderItem = item as Order;
        endpoint = `${API_URL}/admin/orders/${orderItem.id}`;
        method = 'PUT';
      }

      // For beats and team with file uploads
      if ((type === 'beat' || type === 'team') && Object.keys(files).length > 0) {
        const fd = new FormData();
        Object.entries(formData).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            fd.append(key, String(value));
          }
        });
        Object.entries(files).forEach(([key, file]) => {
          if (file) {
            fd.append(key, file);
          }
        });

        const res = await fetch(endpoint, {
          method,
          headers: { 'Authorization': `Bearer ${token}` },
          body: fd
        });

        if (!res.ok) throw new Error('Failed to save');
      } else {
        const res = await fetch(endpoint, {
          method,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        });

        if (!res.ok) throw new Error('Failed to save');
      }

      onSave();
    } catch (err) {
      const error = err as Error;
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const getModalTitle = (): string => {
    if (type === 'order-view') return 'Order Details';
    if (type === 'order-edit') return 'Edit Order';
    if (type === 'customer') return 'Edit Customer';
    return `${item ? 'Edit' : 'Add'} ${type.charAt(0).toUpperCase() + type.slice(1)}`;
  };

  // Cast formData to specific types for type-safe access
  const beatFormData = formData as Partial<Beat>;
  const teamFormData = formData as Partial<TeamMember>;
  const userFormData = formData as Partial<User>;
  const customerFormData = formData as Partial<Customer>;
  const orderFormData = formData as Partial<Order>;

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h2>{getModalTitle()}</h2>
          <button className="modal-close" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="admin-modal-form">
          {type === 'beat' && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>Title *</label>
                  <input type="text" name="title" value={beatFormData.title || ''} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>Produced By</label>
                  <input type="text" name="producedBy" value={beatFormData.producedBy || ''} onChange={handleChange} placeholder="Doc Rolds" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Genre</label>
                  <input type="text" name="genre" value={beatFormData.genre || ''} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>BPM</label>
                  <input type="number" name="bpm" value={beatFormData.bpm || ''} onChange={handleChange} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Key</label>
                  <input type="text" name="key" value={beatFormData.key || ''} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Price *</label>
                  <input type="number" name="price" value={beatFormData.price || ''} onChange={handleChange} required step="0.01" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Duration (seconds)</label>
                  <input type="number" name="duration" value={beatFormData.duration || ''} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <input type="text" name="category" value={beatFormData.category || ''} onChange={handleChange} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>MP3 Audio</label>
                  <input type="file" name="audioFile" accept="audio/mp3,audio/mpeg" onChange={handleFileChange} />
                </div>
                <div className="form-group">
                  <label>WAV File</label>
                  <input type="file" name="wavFile" accept="audio/wav" onChange={handleFileChange} />
                </div>
              </div>
              <div className="form-group">
                <label>Cover Art</label>
                <input type="file" name="coverArt" accept="image/*" onChange={handleFileChange} />
              </div>
              <div className="form-group checkbox-group">
                <label>
                  <input type="checkbox" name="soldExclusively" checked={beatFormData.soldExclusively || false} onChange={handleChange} />
                  Mark as Sold Exclusively
                </label>
              </div>
              {beatFormData.soldExclusively && (
                <div className="form-group">
                  <label>Sold To</label>
                  <input type="text" name="soldExclusivelyTo" value={beatFormData.soldExclusivelyTo || ''} onChange={handleChange} placeholder="Customer name/email" />
                </div>
              )}
            </>
          )}

          {type === 'team' && (
            <>
              <div className="form-group">
                <label>Name *</label>
                <input type="text" name="name" value={teamFormData.name || ''} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>Role</label>
                <input type="text" name="role" value={teamFormData.role || ''} onChange={handleChange} placeholder="Producer, Artist, Engineer..." />
              </div>
              <div className="form-group">
                <label>Credits (comma separated)</label>
                <input type="text" name="credits" value={teamFormData.credits || ''} onChange={handleChange} placeholder="Drake, Future, Travis Scott" />
              </div>
              <div className="form-group">
                <label>Placements</label>
                <input type="text" name="placements" value={teamFormData.placements || ''} onChange={handleChange} placeholder="Song - Artist" />
              </div>
              <div className="form-group">
                <label>Bio</label>
                <textarea name="description" value={teamFormData.description || ''} onChange={handleChange} rows={3}></textarea>
              </div>
              <div className="form-group">
                <label>Photo</label>
                <input type="file" name="photoFile" accept="image/*" onChange={handleFileChange} />
              </div>
              <div className="form-group checkbox-group">
                <label>
                  <input type="checkbox" name="displayOnHome" checked={teamFormData.displayOnHome || false} onChange={handleChange} />
                  Show on Homepage
                </label>
              </div>
            </>
          )}

          {type === 'user' && (
            <>
              <div className="form-group">
                <label>Username *</label>
                <input type="text" name="username" value={userFormData.username || ''} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" name="email" value={userFormData.email || ''} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>{item ? 'New Password (leave blank to keep current)' : 'Password *'}</label>
                <input type="password" name="password" onChange={handleChange} required={!item} />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select name="role" value={userFormData.role || 'user'} onChange={handleChange}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </>
          )}

          {type === 'customer' && item && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label>First Name</label>
                  <input type="text" name="firstName" value={customerFormData.firstName || ''} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <input type="text" name="lastName" value={customerFormData.lastName || ''} onChange={handleChange} />
                </div>
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input type="email" name="email" value={customerFormData.email || ''} onChange={handleChange} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Phone</label>
                  <input type="text" name="phone" value={customerFormData.phone || ''} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Stage Name</label>
                  <input type="text" name="stageName" value={customerFormData.stageName || ''} onChange={handleChange} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Username</label>
                  <input type="text" name="username" value={customerFormData.username || ''} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Profession</label>
                  <input type="text" name="profession" value={customerFormData.profession || ''} onChange={handleChange} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>City</label>
                  <input type="text" name="city" value={customerFormData.city || ''} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>State</label>
                  <input type="text" name="state" value={customerFormData.state || ''} onChange={handleChange} />
                </div>
              </div>
              <div className="form-group checkbox-group">
                <label>
                  <input type="checkbox" name="isGuest" checked={customerFormData.isGuest || false} onChange={handleChange} />
                  Guest Account
                </label>
              </div>
            </>
          )}

          {type === 'order-view' && item && (
            <div className="order-details">
              <div className="order-detail-row">
                <span className="label">Order #:</span>
                <span className="value">#{orderFormData.orderNumber}</span>
              </div>
              <div className="order-detail-row">
                <span className="label">Customer:</span>
                <span className="value">{orderFormData.customerEmail}</span>
              </div>
              <div className="order-detail-row">
                <span className="label">Date:</span>
                <span className="value">{orderFormData.createdAt ? new Date(orderFormData.createdAt).toLocaleString() : '-'}</span>
              </div>
              <div className="order-detail-row">
                <span className="label">Status:</span>
                <span className={`status-badge ${orderFormData.status?.toLowerCase()}`}>{orderFormData.status}</span>
              </div>
              <div className="order-detail-row">
                <span className="label">Payment:</span>
                <span className={`status-badge ${orderFormData.paymentStatus?.toLowerCase()}`}>{orderFormData.paymentStatus}</span>
              </div>
              <div className="order-detail-row">
                <span className="label">Total:</span>
                <span className="value">${parseFloat(String(orderFormData.totalAmount || 0)).toFixed(2)}</span>
              </div>
              <div className="order-items-section">
                <h4>Items:</h4>
                {orderFormData.items?.map((orderItem: OrderItem, i: number) => (
                  <div key={i} className="order-item-row">
                    <span>{orderItem.beat?.title || 'Unknown Beat'}</span>
                    <span>{orderItem.licenseType} - ${parseFloat(String(orderItem.price || 0)).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {type === 'order-edit' && item && (
            <>
              <div className="order-edit-header">
                <div className="order-detail-row">
                  <span className="label">Order #:</span>
                  <span className="value">#{orderFormData.orderNumber}</span>
                </div>
                <div className="order-detail-row">
                  <span className="label">Customer:</span>
                  <span className="value">{orderFormData.customerEmail}</span>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Order Status</label>
                  <select name="status" value={orderFormData.status || ''} onChange={handleChange} className="admin-select">
                    <option value="PENDING">Pending</option>
                    <option value="PROCESSING">Processing</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Payment Status</label>
                  <select name="paymentStatus" value={orderFormData.paymentStatus || ''} onChange={handleChange} className="admin-select">
                    <option value="PENDING">Pending</option>
                    <option value="PAID">Paid</option>
                    <option value="FAILED">Failed</option>
                    <option value="REFUNDED">Refunded</option>
                  </select>
                </div>
              </div>

              <div className="order-items-edit-section">
                <h4>Items & License Upgrades</h4>
                <p className="section-hint">Upgrade a customer's license type (e.g., Standard to Unlimited)</p>
                {orderFormData.items?.map((orderItem: OrderItem, i: number) => (
                  <div key={i} className="order-item-edit-row">
                    <div className="order-item-info">
                      <span className="beat-title">{orderItem.beat?.title || 'Unknown Beat'}</span>
                      <span className="current-price">${parseFloat(String(orderItem.price || 0)).toFixed(2)}</span>
                    </div>
                    <div className="license-select-wrapper">
                      <select
                        value={orderItem.licenseType || 'STANDARD'}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                          const newItems = [...(orderFormData.items || [])];
                          const newLicenseType = e.target.value;
                          newItems[i] = {
                            ...newItems[i],
                            licenseType: newLicenseType,
                            price: newLicenseType === 'UNLIMITED' ? 150 : 50
                          };
                          const newTotal = newItems.reduce((sum: number, item: OrderItem) => sum + (parseFloat(String(item.price)) || 0), 0);
                          setFormData((prev: FormDataType) => ({
                            ...prev,
                            items: newItems,
                            totalAmount: newTotal
                          }));
                        }}
                        className="admin-select"
                      >
                        <option value="STANDARD">Standard ($50)</option>
                        <option value="UNLIMITED">Unlimited ($150)</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Total Amount</label>
                  <input
                    type="number"
                    name="totalAmount"
                    value={orderFormData.totalAmount || ''}
                    onChange={handleChange}
                    step="0.01"
                    className="total-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Admin Notes</label>
                <textarea
                  name="notes"
                  value={orderFormData.notes || ''}
                  onChange={handleChange}
                  placeholder="Internal notes about this order (e.g., license upgrade request, refund reason...)"
                  rows={3}
                ></textarea>
              </div>
            </>
          )}

          <div className="admin-modal-footer">
            <button type="button" className="admin-btn secondary" onClick={onClose}>
              {type === 'order-view' ? 'Close' : 'Cancel'}
            </button>
            {type !== 'order-view' && (
              <button type="submit" className="admin-btn primary" disabled={loading}>
                {loading ? (
                  <><i className="fas fa-spinner fa-spin"></i> Saving...</>
                ) : (
                  <><i className="fas fa-save"></i> Save</>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
