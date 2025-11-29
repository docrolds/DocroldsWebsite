// API Configuration
// This file is processed by Vite and environment variables are replaced at build time

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default {
  API_URL,
  // Add other config values as needed
  timeout: 10000,
  retries: 3
};
