export function getApiUrl() {
  const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
  return isProduction ? 'https://doc-rolds-api.onrender.com/api' : 'http://localhost:3000/api';
}

export function getBaseUrl() {
  return getApiUrl().replace('/api', '');
}
