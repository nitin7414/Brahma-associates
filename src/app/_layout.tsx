import { useEffect, useState } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useColorScheme, ActivityIndicator, View, StyleSheet, Alert, Platform } from 'react-native';

if (Platform.OS === 'web') {
  Alert.alert = (title, message, buttons) => {
    const fullMessage = message ? `${title}\n\n${message}` : title;
    if (!buttons || buttons.length === 0) {
      window.alert(fullMessage);
    } else if (buttons.length === 1) {
      window.alert(fullMessage);
      if (buttons[0].onPress) buttons[0].onPress();
    } else {
      const cancelBtn = buttons.find((b) => b.style === 'cancel');
      const primaryBtn = buttons.find((b) => b.style !== 'cancel') || buttons[0];
      const confirmed = window.confirm(fullMessage);
      if (confirmed) {
        if (primaryBtn && primaryBtn.onPress) primaryBtn.onPress();
      } else {
        if (cancelBtn && cancelBtn.onPress) cancelBtn.onPress();
      }
    }
  };
}

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import LoginScreen from './login';
import { initializeDatabase } from '@/db/client';
import { useAuthStore } from '@/stores/useAuthStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { GradientContainer } from '@/components/gradient-container';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { currentUser, isLoading: authLoading, initializeAuth } = useAuthStore();
  const { settings, loadSettings } = useSettingsStore();
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    async function setupApp() {
      try {
        // 1. Initialize SQLite Database & seed if needed
        await initializeDatabase();
        setDbReady(true);
        
        // 2. Load general app configuration settings
        await loadSettings();
        
        // 3. Load staff users & check if owner is set up
        await initializeAuth();
      } catch (error) {
        console.error('Critical: App initialization failed', error);
      }
    }
    setupApp();
  }, []);

  // Determine active theme (respect settings custom override if set)
  const baseTheme = settings?.theme === 'dark' || (settings?.theme === 'system' && colorScheme === 'dark')
    ? DarkTheme 
    : DefaultTheme;

  const appTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      background: 'transparent',
    },
  };

  if (!dbReady || authLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <ThemeProvider value={appTheme}>
      <GradientContainer>
        <AnimatedSplashOverlay />
        {currentUser ? <AppTabs /> : <LoginScreen />}
      </GradientContainer>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});

