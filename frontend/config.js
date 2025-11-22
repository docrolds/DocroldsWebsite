const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
window.VITE_API_URL = window.VITE_API_URL || (typeof process !== 'undefined' && process.env?.VITE_API_URL) || (isProduction ? 'https://doc-rolds-api.onrender.com/api' : 'http://localhost:3000/api');
