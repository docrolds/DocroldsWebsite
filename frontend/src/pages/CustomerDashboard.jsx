import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { useToast } from '../context/NotificationContext';
import { useNotifications } from '../context/NotificationContext';
import { API_URL } from '../config';

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const { customer, token, loading: authLoading, isAuthenticated, logout, updateProfile, uploadProfilePicture, changePassword } = useCustomerAuth();
  const toast = useToast();
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const [activeSection, setActiveSection] = useState('overview');
  const [orders, setOrders] = useState([]);
  const [likedBeats, setLikedBeats] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPurchases: 0,
    totalSpent: 0,
    totalDownloads: 0,
    likedBeats: 0
  });

  // Profile form
  const [profileForm, setProfileForm] = useState({});
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login?returnTo=/dashboard');
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (customer) {
      setProfileForm({
        firstName: customer.firstName || '',
        lastName: customer.lastName || '',
        stageName: customer.stageName || '',
        phone: customer.phone || '',
        profession: customer.profession || '',
        city: customer.city || '',
        state: customer.state || ''
      });
    }
  }, [customer]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAllData();
    }
  }, [isAuthenticated]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };

      const [ordersRes, likesRes, playlistsRes] = await Promise.all([
        fetch(`${API_URL}/customers/me/orders`, { headers }),
        fetch(`${API_URL}/customers/me/likes`, { headers }),
        fetch(`${API_URL}/customers/me/playlists`, { headers })
      ]);

      const ordersData = await ordersRes.json();
      const likesData = await likesRes.json();
      const playlistsData = await playlistsRes.json();

      setOrders(ordersData);
      setLikedBeats(likesData);
      setPlaylists(playlistsData);

      // Calculate stats
      const paidOrders = ordersData.filter(o => o.paymentStatus === 'PAID');
      setStats({
        totalPurchases: paidOrders.length,
        totalSpent: paidOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
        totalDownloads: paidOrders.reduce((sum, o) => sum + (o.items?.length || 0), 0),
        likedBeats: likesData.length
      });
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      await updateProfile(profileForm);
      toast.success('Profile Updated', 'Your profile information has been saved');
    } catch (err) {
      toast.error('Update Failed', err.message);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match', 'Please make sure both passwords are the same');
      return;
    }
    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      toast.success('Password Changed', 'Your password has been updated securely');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error('Password Change Failed', err.message);
    }
  };

  const handleProfilePictureUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await uploadProfilePicture(file);
      toast.success('Photo Updated', 'Your profile picture has been changed');
    } catch (err) {
      toast.error('Upload Failed', err.message);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getTimeAgo = (date) => {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return past.toLocaleDateString();
  };

  if (authLoading) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-spinner"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const navItems = [
    { id: 'overview', label: 'Overview', icon: 'fa-th-large' },
    { id: 'purchases', label: 'Purchases', icon: 'fa-shopping-bag' },
    { id: 'downloads', label: 'Downloads', icon: 'fa-download' },
    { id: 'likes', label: 'Liked Beats', icon: 'fa-heart' },
    { id: 'playlists', label: 'Playlists', icon: 'fa-list' },
    { id: 'notifications', label: 'Notifications', icon: 'fa-bell' },
    { id: 'profile', label: 'Profile', icon: 'fa-user' },
    { id: 'settings', label: 'Settings', icon: 'fa-cog' },
  ];

  return (
    <div className="customer-dashboard">
      {/* Sidebar */}
      <aside className={`dashboard-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {customer?.profilePicture ? (
                <img src={customer.profilePicture} alt="" />
              ) : (
                <span>{customer?.firstName?.[0] || customer?.email?.[0] || '?'}</span>
              )}
            </div>
            {!sidebarCollapsed && (
              <div className="sidebar-user-info">
                <h3>{customer?.stageName || customer?.firstName || 'Welcome'}</h3>
                <p>{customer?.email}</p>
              </div>
            )}
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <i className={`fas ${sidebarCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i>
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`sidebar-nav-item ${activeSection === item.id ? 'active' : ''}`}
              onClick={() => setActiveSection(item.id)}
            >
              <i className={`fas ${item.icon}`}></i>
              {!sidebarCollapsed && <span>{item.label}</span>}
              {item.id === 'notifications' && notifications.filter(n => !n.isRead).length > 0 && (
                <span className="nav-badge">{notifications.filter(n => !n.isRead).length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-nav-item logout" onClick={handleLogout}>
            <i className="fas fa-sign-out-alt"></i>
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Top Bar */}
        <header className="dashboard-topbar">
          <div className="topbar-left">
            <h1 className="topbar-title">
              {navItems.find(n => n.id === activeSection)?.label || 'Dashboard'}
            </h1>
          </div>
          <div className="topbar-right">
            <Link to="/beats" className="topbar-action">
              <i className="fas fa-music"></i>
              Browse Beats
            </Link>
          </div>
        </header>

        {/* Content Area */}
        <div className="dashboard-content">
          {/* Overview Section */}
          {activeSection === 'overview' && (
            <div className="dashboard-section">
              {/* Stats Cards */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon purchases">
                    <i className="fas fa-shopping-bag"></i>
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">{stats.totalPurchases}</span>
                    <span className="stat-label">Total Purchases</span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon revenue">
                    <i className="fas fa-dollar-sign"></i>
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">${stats.totalSpent.toFixed(2)}</span>
                    <span className="stat-label">Total Spent</span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon downloads">
                    <i className="fas fa-download"></i>
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">{stats.totalDownloads}</span>
                    <span className="stat-label">Beats Downloaded</span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon likes">
                    <i className="fas fa-heart"></i>
                  </div>
                  <div className="stat-info">
                    <span className="stat-value">{stats.likedBeats}</span>
                    <span className="stat-label">Liked Beats</span>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="dashboard-grid">
                <div className="dashboard-card">
                  <div className="card-header">
                    <h2>Recent Purchases</h2>
                    <button className="card-action" onClick={() => setActiveSection('purchases')}>
                      View All <i className="fas fa-arrow-right"></i>
                    </button>
                  </div>
                  <div className="card-content">
                    {loading ? (
                      <div className="card-loading"><div className="dashboard-spinner small"></div></div>
                    ) : orders.length === 0 ? (
                      <div className="card-empty">
                        <i className="fas fa-shopping-bag"></i>
                        <p>No purchases yet</p>
                        <Link to="/beats" className="empty-action">Browse Beats</Link>
                      </div>
                    ) : (
                      <div className="order-list">
                        {orders.slice(0, 3).map(order => (
                          <div key={order.id} className="order-item">
                            <div className="order-info">
                              <span className="order-number">#{order.orderNumber}</span>
                              <span className="order-date">{new Date(order.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div className="order-details">
                              <span className="order-items">{order.items?.length || 0} beat{order.items?.length !== 1 ? 's' : ''}</span>
                              <span className={`order-status ${order.paymentStatus.toLowerCase()}`}>
                                {order.paymentStatus}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="dashboard-card">
                  <div className="card-header">
                    <h2>Recent Notifications</h2>
                    <button className="card-action" onClick={() => setActiveSection('notifications')}>
                      View All <i className="fas fa-arrow-right"></i>
                    </button>
                  </div>
                  <div className="card-content">
                    {notifications.length === 0 ? (
                      <div className="card-empty">
                        <i className="fas fa-bell"></i>
                        <p>No notifications</p>
                      </div>
                    ) : (
                      <div className="notification-list">
                        {notifications.slice(0, 4).map(notif => (
                          <div key={notif.id} className={`notification-item ${!notif.isRead ? 'unread' : ''}`}>
                            <div className="notification-icon">
                              <i className={`fas ${
                                notif.type === 'ORDER_COMPLETED' ? 'fa-check-circle' :
                                notif.type === 'DOWNLOAD_READY' ? 'fa-download' :
                                notif.type === 'WELCOME' ? 'fa-hand-wave' : 'fa-bell'
                              }`}></i>
                            </div>
                            <div className="notification-content">
                              <p className="notification-title">{notif.title}</p>
                              <span className="notification-time">{getTimeAgo(notif.createdAt)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Liked Beats Preview */}
              <div className="dashboard-card full-width">
                <div className="card-header">
                  <h2>Liked Beats</h2>
                  <button className="card-action" onClick={() => setActiveSection('likes')}>
                    View All <i className="fas fa-arrow-right"></i>
                  </button>
                </div>
                <div className="card-content">
                  {likedBeats.length === 0 ? (
                    <div className="card-empty">
                      <i className="fas fa-heart"></i>
                      <p>No liked beats yet</p>
                      <Link to="/beats" className="empty-action">Discover Beats</Link>
                    </div>
                  ) : (
                    <div className="beats-grid">
                      {likedBeats.slice(0, 4).map(beat => (
                        <div key={beat.id} className="beat-card">
                          <div className="beat-cover">
                            {beat.coverArt ? (
                              <img src={beat.coverArt} alt={beat.title} />
                            ) : (
                              <div className="beat-cover-placeholder">
                                <i className="fas fa-music"></i>
                              </div>
                            )}
                          </div>
                          <div className="beat-info">
                            <h4>{beat.title}</h4>
                            <p>{beat.genre} • {beat.bpm} BPM</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Purchases Section */}
          {activeSection === 'purchases' && (
            <div className="dashboard-section">
              <div className="dashboard-card full-width">
                <div className="card-header">
                  <h2>All Purchases</h2>
                  <span className="card-count">{orders.length} order{orders.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="card-content">
                  {loading ? (
                    <div className="card-loading"><div className="dashboard-spinner small"></div></div>
                  ) : orders.length === 0 ? (
                    <div className="card-empty large">
                      <i className="fas fa-shopping-bag"></i>
                      <h3>No purchases yet</h3>
                      <p>When you buy beats, they'll appear here</p>
                      <Link to="/beats" className="btn-primary">Browse Beats</Link>
                    </div>
                  ) : (
                    <div className="orders-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Order</th>
                            <th>Date</th>
                            <th>Items</th>
                            <th>Total</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.map(order => (
                            <tr key={order.id}>
                              <td className="order-number-cell">#{order.orderNumber}</td>
                              <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                              <td>
                                <div className="order-items-preview">
                                  {order.items?.slice(0, 2).map((item, i) => (
                                    <span key={i}>{item.beat?.title}</span>
                                  ))}
                                  {order.items?.length > 2 && (
                                    <span className="more">+{order.items.length - 2} more</span>
                                  )}
                                </div>
                              </td>
                              <td className="order-total">${order.totalAmount?.toFixed(2) || '0.00'}</td>
                              <td>
                                <span className={`status-badge ${order.paymentStatus.toLowerCase()}`}>
                                  {order.paymentStatus}
                                </span>
                              </td>
                              <td>
                                {order.paymentStatus === 'PAID' && order.downloadToken && (
                                  <Link to={`/download/${order.downloadToken}`} className="action-btn">
                                    <i className="fas fa-download"></i> Download
                                  </Link>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Downloads Section */}
          {activeSection === 'downloads' && (
            <div className="dashboard-section">
              <div className="dashboard-card full-width">
                <div className="card-header">
                  <h2>Available Downloads</h2>
                </div>
                <div className="card-content">
                  {loading ? (
                    <div className="card-loading"><div className="dashboard-spinner small"></div></div>
                  ) : orders.filter(o => o.paymentStatus === 'PAID').length === 0 ? (
                    <div className="card-empty large">
                      <i className="fas fa-download"></i>
                      <h3>No downloads available</h3>
                      <p>Purchase beats to access your downloads</p>
                      <Link to="/beats" className="btn-primary">Browse Beats</Link>
                    </div>
                  ) : (
                    <div className="downloads-grid">
                      {orders.filter(o => o.paymentStatus === 'PAID').map(order => (
                        order.items?.map(item => (
                          <div key={item.id} className="download-card">
                            <div className="download-cover">
                              {item.beat?.coverArt ? (
                                <img src={item.beat.coverArt} alt={item.beat.title} />
                              ) : (
                                <div className="download-cover-placeholder">
                                  <i className="fas fa-music"></i>
                                </div>
                              )}
                            </div>
                            <div className="download-info">
                              <h4>{item.beat?.title}</h4>
                              <Link
                                to={`/licenses?type=${item.licenseType?.toLowerCase() || 'standard'}`}
                                className="download-license license-link"
                              >
                                {item.licenseName} <i className="fas fa-external-link-alt"></i>
                              </Link>
                              <p className="download-order">Order #{order.orderNumber}</p>
                            </div>
                            <Link to={`/download/${order.downloadToken}`} className="download-btn">
                              <i className="fas fa-download"></i>
                              Download
                            </Link>
                          </div>
                        ))
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Likes Section */}
          {activeSection === 'likes' && (
            <div className="dashboard-section">
              <div className="dashboard-card full-width">
                <div className="card-header">
                  <h2>Liked Beats</h2>
                  <span className="card-count">{likedBeats.length} beat{likedBeats.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="card-content">
                  {loading ? (
                    <div className="card-loading"><div className="dashboard-spinner small"></div></div>
                  ) : likedBeats.length === 0 ? (
                    <div className="card-empty large">
                      <i className="fas fa-heart"></i>
                      <h3>No liked beats</h3>
                      <p>Like beats to save them for later</p>
                      <Link to="/beats" className="btn-primary">Discover Beats</Link>
                    </div>
                  ) : (
                    <div className="likes-grid">
                      {likedBeats.map(beat => (
                        <div key={beat.id} className="like-card">
                          <div className="like-cover">
                            {beat.coverArt ? (
                              <img src={beat.coverArt} alt={beat.title} />
                            ) : (
                              <div className="like-cover-placeholder">
                                <i className="fas fa-music"></i>
                              </div>
                            )}
                            <div className="like-overlay">
                              <button className="play-btn">
                                <i className="fas fa-play"></i>
                              </button>
                            </div>
                          </div>
                          <div className="like-info">
                            <h4>{beat.title}</h4>
                            <p>{beat.genre} • {beat.bpm} BPM</p>
                            <span className="like-price">From ${beat.priceBasic || 29.99}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Playlists Section */}
          {activeSection === 'playlists' && (
            <div className="dashboard-section">
              <div className="dashboard-card full-width">
                <div className="card-header">
                  <h2>My Playlists</h2>
                  <span className="card-count">{playlists.length} playlist{playlists.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="card-content">
                  {loading ? (
                    <div className="card-loading"><div className="dashboard-spinner small"></div></div>
                  ) : playlists.length === 0 ? (
                    <div className="card-empty large">
                      <i className="fas fa-list"></i>
                      <h3>No playlists yet</h3>
                      <p>Create playlists to organize your favorite beats</p>
                      <Link to="/beats" className="btn-primary">Browse Beats</Link>
                    </div>
                  ) : (
                    <div className="playlists-grid">
                      {playlists.map(playlist => (
                        <div key={playlist.id} className="playlist-card">
                          <div className="playlist-cover">
                            {playlist.beats?.[0]?.beat?.coverArt ? (
                              <img src={playlist.beats[0].beat.coverArt} alt="" />
                            ) : (
                              <div className="playlist-cover-placeholder">
                                <i className="fas fa-music"></i>
                              </div>
                            )}
                          </div>
                          <div className="playlist-info">
                            <h4>
                              {playlist.name}
                              {playlist.isDefault && <span className="default-badge">Default</span>}
                            </h4>
                            <p>{playlist.beats?.length || 0} beats</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Notifications Section */}
          {activeSection === 'notifications' && (
            <div className="dashboard-section">
              <div className="dashboard-card full-width">
                <div className="card-header">
                  <h2>Notifications</h2>
                  {notifications.some(n => !n.isRead) && (
                    <button className="card-action" onClick={markAllAsRead}>
                      Mark all as read
                    </button>
                  )}
                </div>
                <div className="card-content">
                  {notifications.length === 0 ? (
                    <div className="card-empty large">
                      <i className="fas fa-bell"></i>
                      <h3>No notifications</h3>
                      <p>You're all caught up!</p>
                    </div>
                  ) : (
                    <div className="notifications-list">
                      {notifications.map(notif => (
                        <div
                          key={notif.id}
                          className={`notification-row ${!notif.isRead ? 'unread' : ''}`}
                          onClick={() => !notif.isRead && markAsRead(notif.id)}
                        >
                          <div className={`notification-icon-lg ${notif.type?.toLowerCase().replace('_', '-')}`}>
                            <i className={`fas ${
                              notif.type === 'ORDER_COMPLETED' ? 'fa-check-circle' :
                              notif.type === 'DOWNLOAD_READY' ? 'fa-download' :
                              notif.type === 'DOWNLOAD_EXPIRING' ? 'fa-clock' :
                              notif.type === 'WELCOME' ? 'fa-hand-wave' : 'fa-bell'
                            }`}></i>
                          </div>
                          <div className="notification-body">
                            <h4>{notif.title}</h4>
                            <p>{notif.message}</p>
                            <span className="notification-timestamp">{getTimeAgo(notif.createdAt)}</span>
                          </div>
                          {!notif.isRead && <span className="unread-dot"></span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Profile Section */}
          {activeSection === 'profile' && (
            <div className="dashboard-section">
              <div className="dashboard-grid">
                {/* Profile Picture Card */}
                <div className="dashboard-card">
                  <div className="card-header">
                    <h2>Profile Picture</h2>
                  </div>
                  <div className="card-content">
                    <div className="profile-picture-section">
                      <div className="profile-avatar-large">
                        {customer?.profilePicture ? (
                          <img src={customer.profilePicture} alt="" />
                        ) : (
                          <span>{customer?.firstName?.[0] || customer?.email?.[0] || '?'}</span>
                        )}
                      </div>
                      <label className="upload-btn">
                        <i className="fas fa-camera"></i>
                        Change Photo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleProfilePictureUpload}
                          hidden
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Account Info Card */}
                <div className="dashboard-card">
                  <div className="card-header">
                    <h2>Account Info</h2>
                  </div>
                  <div className="card-content">
                    <div className="account-info">
                      <div className="info-row">
                        <span className="info-label">Email</span>
                        <span className="info-value">{customer?.email}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Member Since</span>
                        <span className="info-value">
                          {customer?.createdAt ? new Date(customer.createdAt).toLocaleDateString() : '-'}
                        </span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Total Orders</span>
                        <span className="info-value">{stats.totalPurchases}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Profile Form */}
              <div className="dashboard-card full-width">
                <div className="card-header">
                  <h2>Profile Information</h2>
                </div>
                <div className="card-content">
                  <form onSubmit={handleProfileUpdate} className="profile-form">
                    <div className="form-grid">
                      <div className="form-field">
                        <label>First Name</label>
                        <input
                          type="text"
                          value={profileForm.firstName}
                          onChange={(e) => setProfileForm(p => ({ ...p, firstName: e.target.value }))}
                        />
                      </div>
                      <div className="form-field">
                        <label>Last Name</label>
                        <input
                          type="text"
                          value={profileForm.lastName}
                          onChange={(e) => setProfileForm(p => ({ ...p, lastName: e.target.value }))}
                        />
                      </div>
                      <div className="form-field">
                        <label>Stage Name</label>
                        <input
                          type="text"
                          value={profileForm.stageName}
                          onChange={(e) => setProfileForm(p => ({ ...p, stageName: e.target.value }))}
                        />
                      </div>
                      <div className="form-field">
                        <label>Phone</label>
                        <input
                          type="tel"
                          value={profileForm.phone}
                          onChange={(e) => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                        />
                      </div>
                      <div className="form-field">
                        <label>Profession</label>
                        <input
                          type="text"
                          value={profileForm.profession}
                          onChange={(e) => setProfileForm(p => ({ ...p, profession: e.target.value }))}
                          placeholder="Artist, Producer, Rapper..."
                        />
                      </div>
                      <div className="form-field">
                        <label>City</label>
                        <input
                          type="text"
                          value={profileForm.city}
                          onChange={(e) => setProfileForm(p => ({ ...p, city: e.target.value }))}
                        />
                      </div>
                      <div className="form-field">
                        <label>State</label>
                        <input
                          type="text"
                          value={profileForm.state}
                          onChange={(e) => setProfileForm(p => ({ ...p, state: e.target.value }))}
                        />
                      </div>
                    </div>
                    <button type="submit" className="btn-primary">
                      <i className="fas fa-save"></i>
                      Save Changes
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Settings Section */}
          {activeSection === 'settings' && (
            <div className="dashboard-section">
              <div className="dashboard-card full-width">
                <div className="card-header">
                  <h2>Change Password</h2>
                </div>
                <div className="card-content">
                  <form onSubmit={handlePasswordChange} className="password-form">
                    <div className="form-grid three-cols">
                      <div className="form-field">
                        <label>Current Password</label>
                        <input
                          type="password"
                          value={passwordForm.currentPassword}
                          onChange={(e) => setPasswordForm(p => ({ ...p, currentPassword: e.target.value }))}
                        />
                      </div>
                      <div className="form-field">
                        <label>New Password</label>
                        <input
                          type="password"
                          value={passwordForm.newPassword}
                          onChange={(e) => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
                        />
                      </div>
                      <div className="form-field">
                        <label>Confirm Password</label>
                        <input
                          type="password"
                          value={passwordForm.confirmPassword}
                          onChange={(e) => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
                        />
                      </div>
                    </div>
                    <button type="submit" className="btn-secondary">
                      <i className="fas fa-lock"></i>
                      Change Password
                    </button>
                  </form>
                </div>
              </div>

              <div className="dashboard-card full-width danger-zone">
                <div className="card-header">
                  <h2>Danger Zone</h2>
                </div>
                <div className="card-content">
                  <div className="danger-action">
                    <div>
                      <h4>Sign Out</h4>
                      <p>Sign out of your account on this device</p>
                    </div>
                    <button className="btn-danger" onClick={handleLogout}>
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
