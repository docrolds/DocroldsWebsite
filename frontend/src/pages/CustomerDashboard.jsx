import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { useToast } from '../context/NotificationContext';
import { API_URL } from '../config';

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const { customer, token, loading: authLoading, isAuthenticated, logout, updateProfile, uploadProfilePicture, changePassword } = useCustomerAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('purchases');
  const [orders, setOrders] = useState([]);
  const [likedBeats, setLikedBeats] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Profile form
  const [profileForm, setProfileForm] = useState({});
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

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
      fetchData();
    }
  }, [isAuthenticated, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };

      if (activeTab === 'purchases') {
        const res = await fetch(`${API_URL}/customers/me/orders`, { headers });
        const data = await res.json();
        setOrders(data);
      } else if (activeTab === 'likes') {
        const res = await fetch(`${API_URL}/customers/me/likes`, { headers });
        const data = await res.json();
        setLikedBeats(data);
      } else if (activeTab === 'playlists') {
        const res = await fetch(`${API_URL}/customers/me/playlists`, { headers });
        const data = await res.json();
        setPlaylists(data);
      }
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    try {
      await updateProfile(profileForm);
      toast.success('Profile Updated', 'Your profile information has been saved');
    } catch (err) {
      setError(err.message);
      toast.error('Update Failed', err.message);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('Passwords do not match');
      toast.error('Passwords do not match', 'Please make sure both passwords are the same');
      return;
    }

    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      toast.success('Password Changed', 'Your password has been updated securely');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.message);
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
      setError(err.message);
      toast.error('Upload Failed', err.message);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 pt-24 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-950 pt-24 pb-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-zinc-800 overflow-hidden">
                {customer?.profilePicture ? (
                  <img src={customer.profilePicture} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-500 text-2xl font-bold">
                    {customer?.firstName?.[0] || customer?.email?.[0] || '?'}
                  </div>
                )}
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {customer?.stageName || customer?.firstName || 'Welcome'}
              </h1>
              <p className="text-zinc-400">{customer?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            Sign Out
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-6" role="alert">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="bg-green-500/10 border border-green-500 text-green-500 px-4 py-3 rounded-lg mb-6" role="status">
            {successMessage}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-zinc-900 rounded-lg p-1" role="tablist" aria-label="Dashboard sections">
          {['purchases', 'likes', 'playlists', 'profile'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`${tab}-panel`}
              className={`flex-1 py-2 px-4 rounded-md transition-colors capitalize ${
                activeTab === tab
                  ? 'bg-red-600 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-zinc-900 rounded-lg p-6">
          {/* Purchases Tab */}
          {activeTab === 'purchases' && (
            <div role="tabpanel" id="purchases-panel" aria-label="Purchased beats">
              <h2 className="text-xl font-semibold text-white mb-4">Purchased Beats</h2>
              {loading ? (
                <div className="text-center py-8 text-zinc-400">Loading...</div>
              ) : orders.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-zinc-400 mb-4">No purchases yet</p>
                  <Link to="/beats" className="text-red-500 hover:text-red-400">
                    Browse Beats
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map(order => (
                    <div key={order.id} className="bg-zinc-800 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-white font-medium">Order #{order.orderNumber}</p>
                          <p className="text-zinc-500 text-sm">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          order.paymentStatus === 'PAID'
                            ? 'bg-green-500/20 text-green-500'
                            : 'bg-yellow-500/20 text-yellow-500'
                        }`}>
                          {order.paymentStatus}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {order.items.map(item => (
                          <div key={item.id} className="flex items-center gap-3">
                            {item.beat.coverArt && (
                              <img src={item.beat.coverArt} alt="" className="w-10 h-10 rounded" />
                            )}
                            <div className="flex-1">
                              <p className="text-white text-sm">{item.beat.title}</p>
                              <p className="text-zinc-500 text-xs">{item.licenseName}</p>
                            </div>
                            {order.paymentStatus === 'PAID' && (
                              <Link
                                to={`/download/${order.downloadToken}`}
                                className="text-red-500 hover:text-red-400 text-sm"
                              >
                                Download
                              </Link>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Likes Tab */}
          {activeTab === 'likes' && (
            <div role="tabpanel" id="likes-panel" aria-label="Liked beats">
              <h2 className="text-xl font-semibold text-white mb-4">Liked Beats</h2>
              {loading ? (
                <div className="text-center py-8 text-zinc-400">Loading...</div>
              ) : likedBeats.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-zinc-400 mb-4">No liked beats yet</p>
                  <Link to="/beats" className="text-red-500 hover:text-red-400">
                    Browse Beats
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {likedBeats.map(beat => (
                    <div key={beat.id} className="bg-zinc-800 rounded-lg p-4 flex items-center gap-4">
                      {beat.coverArt && (
                        <img src={beat.coverArt} alt="" className="w-16 h-16 rounded" />
                      )}
                      <div className="flex-1">
                        <p className="text-white font-medium">{beat.title}</p>
                        <p className="text-zinc-500 text-sm">{beat.genre} • {beat.bpm} BPM</p>
                      </div>
                      <Link
                        to="/beats"
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm"
                      >
                        View
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Playlists Tab */}
          {activeTab === 'playlists' && (
            <div role="tabpanel" id="playlists-panel" aria-label="My playlists">
              <h2 className="text-xl font-semibold text-white mb-4">My Playlists</h2>
              {loading ? (
                <div className="text-center py-8 text-zinc-400">Loading...</div>
              ) : playlists.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-zinc-400 mb-4">No playlists yet</p>
                  <Link to="/beats" className="text-red-500 hover:text-red-400">
                    Save beats to create playlists
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {playlists.map(playlist => (
                    <div key={playlist.id} className="bg-zinc-800 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-white font-medium">
                          {playlist.name}
                          {playlist.isDefault && (
                            <span className="ml-2 text-xs text-zinc-500">(Default)</span>
                          )}
                        </h3>
                        <span className="text-zinc-500 text-sm">{playlist.beats.length} beats</span>
                      </div>
                      {playlist.beats.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {playlist.beats.slice(0, 4).map(pb => (
                            <div key={pb.id} className="bg-zinc-700 rounded p-2">
                              <p className="text-white text-sm truncate">{pb.beat.title}</p>
                              <p className="text-zinc-500 text-xs">{pb.beat.genre}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-8" role="tabpanel" id="profile-panel" aria-label="Profile settings">
              {/* Profile Picture */}
              <div>
                <h2 className="text-xl font-semibold text-white mb-4">Profile Picture</h2>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 rounded-full bg-zinc-800 overflow-hidden">
                    {customer?.profilePicture ? (
                      <img src={customer.profilePicture} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-500 text-3xl font-bold">
                        {customer?.firstName?.[0] || customer?.email?.[0] || '?'}
                      </div>
                    )}
                  </div>
                  <label className="bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded cursor-pointer">
                    Change Photo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePictureUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Profile Form */}
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <h2 className="text-xl font-semibold text-white">Profile Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-zinc-400 text-sm mb-2">First Name</label>
                    <input
                      type="text"
                      value={profileForm.firstName}
                      onChange={(e) => setProfileForm(p => ({ ...p, firstName: e.target.value }))}
                      className="w-full bg-zinc-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-sm mb-2">Last Name</label>
                    <input
                      type="text"
                      value={profileForm.lastName}
                      onChange={(e) => setProfileForm(p => ({ ...p, lastName: e.target.value }))}
                      className="w-full bg-zinc-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-sm mb-2">Stage Name</label>
                    <input
                      type="text"
                      value={profileForm.stageName}
                      onChange={(e) => setProfileForm(p => ({ ...p, stageName: e.target.value }))}
                      className="w-full bg-zinc-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-sm mb-2">Phone</label>
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                      className="w-full bg-zinc-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-sm mb-2">Profession</label>
                    <input
                      type="text"
                      value={profileForm.profession}
                      onChange={(e) => setProfileForm(p => ({ ...p, profession: e.target.value }))}
                      className="w-full bg-zinc-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="Artist, Producer, Rapper..."
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-sm mb-2">City</label>
                    <input
                      type="text"
                      value={profileForm.city}
                      onChange={(e) => setProfileForm(p => ({ ...p, city: e.target.value }))}
                      className="w-full bg-zinc-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-sm mb-2">State</label>
                    <input
                      type="text"
                      value={profileForm.state}
                      onChange={(e) => setProfileForm(p => ({ ...p, state: e.target.value }))}
                      className="w-full bg-zinc-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  Save Changes
                </button>
              </form>

              {/* Change Password */}
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <h2 className="text-xl font-semibold text-white">Change Password</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-zinc-400 text-sm mb-2">Current Password</label>
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm(p => ({ ...p, currentPassword: e.target.value }))}
                      className="w-full bg-zinc-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-sm mb-2">New Password</label>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
                      className="w-full bg-zinc-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-sm mb-2">Confirm Password</label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
                      className="w-full bg-zinc-800 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  Change Password
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
