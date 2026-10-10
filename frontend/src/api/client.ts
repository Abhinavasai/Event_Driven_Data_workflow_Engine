import axios from 'axios';
import { API_BASE_URL, API_KEY_STORAGE } from '../lib/constants';

export function getStoredApiKey(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(API_KEY_STORAGE);
    if (stored) return stored;
  }
  return import.meta.env.VITE_API_KEY ?? '';
}

export function setStoredApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE, key);
}

export function clearStoredApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE);
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const key = getStoredApiKey();
  if (key) {
    config.headers.set('X-API-Key', key);
  }
  return config;
});

export async function getHealth() {
  const { data } = await axios.get(`${API_BASE_URL}/health`);
  return data;
}
