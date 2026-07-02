// API Configuration
// This file is processed by Vite and environment variables are replaced at build time

export const API_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface Config {
  API_URL: string;
  timeout: number;
  retries: number;
}

const config: Config = {
  API_URL,
  timeout: 10000,
  retries: 3
};

export default config;
