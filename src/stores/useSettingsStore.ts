import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

interface Settings {
  taxRate: number; // Percentage, e.g. 18 for 18% GST
  defaultLowStockThreshold: number;
  theme: 'light' | 'dark' | 'system';
  lastBackupDate: number | null;
  backendUrl: string;
  lastSyncTimestamp: number;
}

interface SettingsState {
  settings: Settings;
  isLoading: boolean;

  loadSettings: () => Promise<void>;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  updateBackupDate: () => Promise<void>;
}

const SETTINGS_KEY = 'brahma_associates_app_settings';

const defaultSettings: Settings = {
  taxRate: 18.0,
  defaultLowStockThreshold: 5,
  theme: 'system',
  lastBackupDate: null,
  backendUrl: Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000',
  lastSyncTimestamp: 0,
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  isLoading: true,

  loadSettings: async () => {
    try {
      set({ isLoading: true });
      const saved = await SecureStore.getItemAsync(SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        set({ settings: { ...defaultSettings, ...parsed }, isLoading: false });
      } else {
        set({ settings: defaultSettings, isLoading: false });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      set({ settings: defaultSettings, isLoading: false });
    }
  },

  updateSettings: async (updates: Partial<Settings>) => {
    try {
      const newSettings = { ...get().settings, ...updates };
      set({ settings: newSettings });
      await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  },

  updateBackupDate: async () => {
    await get().updateSettings({ lastBackupDate: Date.now() });
  },
}));
