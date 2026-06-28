import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform, NativeModules } from 'react-native';
import Constants from 'expo-constants';

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

const getDevHostIp = (): string => {
  // 1. Try scriptURL (bundle source url) which is highly reliable on devices and emulators
  const scriptURL = NativeModules.SourceCode?.scriptURL;
  if (scriptURL) {
    const match = scriptURL.match(/^https?:\/\/([^:/]+)(:\d+)?\//);
    if (match && match[1]) {
      console.log('[useSettingsStore] Resolved host IP from scriptURL:', match[1]);
      return match[1];
    }
  }

  // 2. Try expoConfig hostUri
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    console.log('[useSettingsStore] Resolved host IP from hostUri:', ip);
    return ip;
  }

  // 3. Try manifest2 debuggerHost
  const debuggerHost = (Constants.manifest2 as any)?.extra?.expoGo?.debuggerHost;
  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    console.log('[useSettingsStore] Resolved host IP from debuggerHost:', ip);
    return ip;
  }

  console.log('[useSettingsStore] Host IP fallback to localhost');
  return 'localhost';
};

const getInitialBackendUrl = (): string => {
  if (__DEV__) {
    const ip = getDevHostIp();
    return `http://${ip}:3000`;
  }
  return process.env.EXPO_PUBLIC_PROD_BACKEND_URL || 
         process.env.EXPO_PUBLIC_BACKEND_URL || 
         'https://brahma-associates-sync.vercel.app';
};

const defaultSettings: Settings = {
  taxRate: 18.0,
  defaultLowStockThreshold: 5,
  theme: 'system',
  lastBackupDate: null,
  backendUrl: getInitialBackendUrl(),
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
        // Overwrite backend URL with the current dynamically resolved developer IP in dev mode
        if (__DEV__) {
          parsed.backendUrl = getInitialBackendUrl();
        }
        console.log('[useSettingsStore] Loaded backendUrl:', parsed.backendUrl);
        set({ settings: { ...defaultSettings, ...parsed }, isLoading: false });
      } else {
        console.log('[useSettingsStore] No saved settings, using defaults:', defaultSettings.backendUrl);
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
