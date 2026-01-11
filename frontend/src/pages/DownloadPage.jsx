import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_URL } from '../config';

export default function DownloadPage() {
  const { token } = useParams();
  const [downloadData, setDownloadData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    fetchDownloadInfo();
  }, [token]);

  const fetchDownloadInfo = async () => {
    try {
      const response = await fetch(`${API_URL}/orders/download/${token}`);
      const data = await response.json();

      if (!response.ok) {
        if (data.expired) {
          setExpired(true);
        }
        throw new Error(data.message || 'Download not available');
      }

      setDownloadData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (downloadItem, file) => {
    // Create download URL
    const downloadUrl = `${API_URL}/orders/download/${token}/${downloadItem.beatId}/${file.type}`;

    // Trigger download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = file.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black pt-24 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="min-h-screen bg-black pt-24 pb-12">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4" aria-hidden="true">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Download Link Expired</h1>
          <p className="text-zinc-400 mb-6">
            Your guest download link has expired. Create an account to get unlimited access to your purchases.
          </p>
          <div className="space-x-4">
            <Link
              to="/register"
              className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Create Account
            </Link>
            <Link
              to="/login"
              className="inline-block bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black pt-24 pb-12">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-6 py-4 rounded-lg" role="alert">
            {error}
          </div>
          <Link to="/beats" className="inline-block mt-6 text-red-500 hover:text-red-400">
            &larr; Back to Beats
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-24 pb-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4" aria-hidden="true">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Download Your Beats</h1>
          <p className="text-zinc-400">Order #{downloadData.orderNumber}</p>
        </div>

        {/* Expiry Warning */}
        {downloadData.expiresAt && (
          <div className="bg-yellow-500/10 border border-yellow-500 text-yellow-500 px-6 py-4 rounded-lg mb-6 text-center" role="alert">
            Download link expires on {new Date(downloadData.expiresAt).toLocaleDateString()}.
            <Link to="/register" className="ml-2 underline hover:no-underline">
              Create an account
            </Link>{' '}
            for unlimited access.
          </div>
        )}

        {/* Download Items */}
        <div className="space-y-4">
          {downloadData.downloads.map((item, index) => (
            <div key={index} className="bg-zinc-900 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">{item.beatTitle}</h2>
                  <Link
                    to={`/licenses?type=${item.licenseType?.toLowerCase() || 'standard'}`}
                    className="text-red-500 hover:text-red-400 text-sm inline-flex items-center gap-1"
                  >
                    {item.license}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {item.files.map((file, fileIndex) => (
                  <button
                    key={fileIndex}
                    onClick={() => handleDownload(item, file)}
                    aria-label={`Download ${item.beatTitle} as ${file.type.toUpperCase()}`}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-colors ${
                      file.type === 'wav'
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-zinc-700 hover:bg-zinc-600 text-white'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download {file.type.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* License Info */}
        <div className="mt-8 bg-zinc-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-white">License Information</h3>
            <Link
              to="/licenses"
              className="text-red-500 hover:text-red-400 text-sm inline-flex items-center gap-1"
            >
              View Full Terms
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Link>
          </div>
          <ul className="text-zinc-400 text-sm space-y-2">
            <li>- Standard Lease: Credit producer, up to 100,000 streams</li>
            <li>- Unlimited Lease: No stream limits, sync licensing included</li>
            <li>- Exclusive: Beat removed from store (Producer retains master)</li>
            <li>- All licenses are perpetual (lifetime validity)</li>
          </ul>
        </div>

        <div className="mt-8 text-center">
          <Link to="/beats" className="text-zinc-400 hover:text-white">
            &larr; Back to Beats
          </Link>
        </div>
      </div>
    </div>
  );
}
