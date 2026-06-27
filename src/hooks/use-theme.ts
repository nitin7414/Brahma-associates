/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSettingsStore } from '@/stores/useSettingsStore';

export function useTheme() {
  const settings = useSettingsStore((state) => state.settings);
  const scheme = useColorScheme();
  const theme = settings?.theme === 'dark' || (settings?.theme === 'system' && scheme === 'dark')
    ? 'dark'
    : 'light';

  return Colors[theme];
}
