import { useState, useEffect, ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_URL } from '../config';

// ============================================
// Type Definitions
// ============================================

interface DownloadFile {
  type: string;
  filename: string;
}

interface DownloadItem {
  beatId: string | number;
  beatTitle: string;
  license: string;
  licenseType?: string;
  files: DownloadFile[];
}

interface DownloadData {
  orderNumber: string;
  expiresAt?: string;
  downloads: DownloadItem[];
}

interface DownloadApiResponse extends DownloadData {
  expired?: boolean;
  message?: string;
}

// ============================================
// DownloadPage Component
// ============================================

export default function DownloadPage(): ReactNode {
  const { token } = useParams<{ token: string }>();
  const [downloadData, setDownloadData] = useState<DownloadData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [expired, setExpired] = useState<boolean>(false);

  useEffect(() => {
    fetchDownloadInfo();
  }, [token]);

  const fetchDownloadInfo = async (): Promise<void> => {
    try {
      const response = await fetch(`${API_URL}/orders/download/${token}`);
      const data: DownloadApiResponse = await response.json();

      if (!response.ok) {
        if (data.expired) {
          setExpired(true);
        }
        throw new Error(data.message || 'Download not available');
      }

      setDownloadData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (downloadItem: DownloadItem, file: DownloadFile): void => {
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
      <div className="download-page">
        <div className="download-loading">
          <div className="download-spinner"></div>
        </div>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="download-page">
        <div className="download-container">
          <div className="download-header">
            <div className="download-status-icon expired" aria-hidden="true">
              <i className="fas fa-clock"></i>
            </div>
            <h1>Download Link Expired</h1>
            <p>Your guest download link has expired. Create an account to get unlimited access to your purchases.</p>
          </div>
          <div className="download-actions">
            <Link to="/register" className="download-btn primary">
              <i className="fas fa-user-plus"></i>
              Create Account
            </Link>
            <Link to="/login" className="download-btn secondary">
              <i className="fas fa-sign-in-alt"></i>
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="download-page">
        <div className="download-container">
          <div className="download-alert error" role="alert">
            <i className="fas fa-exclamation-circle"></i>
            {error}
          </div>
          <Link to="/beats" className="download-back-link">
            <i className="fas fa-arrow-left"></i>
            Back to Beats
          </Link>
        </div>
      </div>
    );
  }

  if (!downloadData) {
    return null;
  }

  return (
    <div className="download-page">
      <div className="download-container">
        {/* Header */}
        <div className="download-header">
          <div className="download-status-icon success" aria-hidden="true">
            <i className="fas fa-download"></i>
          </div>
          <h1>Download Your Beats</h1>
          <p>Order #{downloadData.orderNumber}</p>
        </div>

        {/* Expiry Warning */}
        {downloadData.expiresAt && (
          <div className="download-alert warning" role="alert">
            <i className="fas fa-exclamation-triangle"></i>
            <span>
              Download link expires on {new Date(downloadData.expiresAt).toLocaleDateString()}.
              <Link to="/register" className="alert-link">Create an account</Link> for unlimited access.
            </span>
          </div>
        )}

        {/* Download Items */}
        <div className="download-items">
          {downloadData.downloads.map((item: DownloadItem, index: number) => (
            <div key={index} className="download-item-card">
              <div className="download-item-header">
                <div className="download-item-info">
                  <h2>{item.beatTitle}</h2>
                  <Link
                    to={`/licenses?type=${item.licenseType?.toLowerCase() || 'standard'}&beatId=${item.beatId}`}
                    className="download-license-link"
                  >
                    {item.license}
                    <i className="fas fa-external-link-alt"></i>
                  </Link>
                </div>
              </div>

              <div className="download-file-grid">
                {item.files.map((file: DownloadFile, fileIndex: number) => (
                  <button
                    key={fileIndex}
                    onClick={() => handleDownload(item, file)}
                    aria-label={`Download ${item.beatTitle} as ${file.type.toUpperCase()}`}
                    className={`download-file-btn ${file.type === 'wav' ? 'primary' : 'secondary'}`}
                  >
                    <i className="fas fa-download"></i>
                    Download {file.type.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* License Info - Show terms specific to purchased license(s) */}
        {downloadData.downloads.map((item: DownloadItem, index: number) => {
          const licenseType = (item.licenseType || 'standard').toLowerCase();
          return (
            <div key={`license-${index}`} className="download-info-card">
              <div className="download-info-header">
                <h3>
                  <i className="fas fa-file-contract"></i>
                  {item.beatTitle} - Your License Terms
                </h3>
                <Link to={`/licenses?type=${licenseType}&beatId=${item.beatId}`} className="download-info-link">
                  View Full Agreement
                  <i className="fas fa-arrow-right"></i>
                </Link>
              </div>
              <ul className="download-info-list">
                {licenseType === 'standard' && (
                  <>
                    <li><i className="fas fa-check"></i> 100,000 Streams</li>
                    <li><i className="fas fa-check"></i> 5,000 Paid Downloads</li>
                    <li><i className="fas fa-check"></i> 1 Music Video</li>
                    <li><i className="fas fa-times" style={{color: '#e83628'}}></i> No Radio</li>
                    <li><i className="fas fa-times" style={{color: '#e83628'}}></i> No Sync Licensing</li>
                    <li><i className="fas fa-exclamation-triangle" style={{color: '#f59e0b'}}></i> Credit Required</li>
                    <li><i className="fas fa-info-circle"></i> Non-Exclusive</li>
                    <li><i className="fas fa-info-circle"></i> 50/50 Publishing</li>
                  </>
                )}
                {licenseType === 'unlimited' && (
                  <>
                    <li><i className="fas fa-check"></i> Unlimited Streams</li>
                    <li><i className="fas fa-check"></i> Unlimited Downloads</li>
                    <li><i className="fas fa-check"></i> Unlimited Music Videos</li>
                    <li><i className="fas fa-check"></i> Radio Included</li>
                    <li><i className="fas fa-check"></i> Sync Licensing Included</li>
                    <li><i className="fas fa-exclamation-triangle" style={{color: '#f59e0b'}}></i> Credit Required</li>
                    <li><i className="fas fa-info-circle"></i> Non-Exclusive</li>
                    <li><i className="fas fa-info-circle"></i> 50/50 Publishing</li>
                  </>
                )}
                {licenseType === 'exclusive' && (
                  <>
                    <li><i className="fas fa-check"></i> Unlimited Distribution</li>
                    <li><i className="fas fa-check"></i> Full Sync Rights</li>
                    <li><i className="fas fa-check"></i> Beat Removed from Store</li>
                    <li><i className="fas fa-exclamation-triangle" style={{color: '#f59e0b'}}></i> Credit Required</li>
                    <li><i className="fas fa-info-circle"></i> 50/50 Publishing (Negotiable)</li>
                    <li><i className="fas fa-info-circle"></i> Producer Retains Master</li>
                  </>
                )}
              </ul>
            </div>
          );
        })}

        <div className="download-footer">
          <Link to="/beats" className="download-back-link">
            <i className="fas fa-arrow-left"></i>
            Back to Beats
          </Link>
        </div>
      </div>
    </div>
  );
}
