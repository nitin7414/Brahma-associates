import React from 'react';
import { StyleSheet, ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from 'react-native';
import { useSettingsStore } from '@/stores/useSettingsStore';

export function GradientContainer({ style, children, ...otherProps }: ViewProps) {
  const colorScheme = useColorScheme();
  const settings = useSettingsStore((state) => state.settings);
  const isDark = settings?.theme === 'dark' || (settings?.theme === 'system' && colorScheme === 'dark');

  // Colors:
  // Light: Pure White to Light Orange/Peach
  // Dark: Deep Warm slate-blue to dark warm charcoal-orange
  const colors = isDark
    ? (['#0B0F19', '#1C1510'] as const)
    : (['#FFFFFF', '#FFF2E6'] as const);

  return (
    <LinearGradient
      colors={colors}
      style={[styles.container, style]}
      {...otherProps}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
