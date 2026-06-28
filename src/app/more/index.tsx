import React from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Alert,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from '@/components/symbol-view';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/stores/useAuthStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { hasPermission } from '@/lib/permissions';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, Badge, Button } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function MoreMenuScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { currentUser, logout } = useAuthStore();
  const { settings, updateSettings } = useSettingsStore();

  const handleLogout = () => {
    console.log('[SettingsMenu] handleLogout pressed, currentUser:', currentUser);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert('Logout', 'Are you sure you want to end your session?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() }
    ]);
  };

  const toggleTheme = () => {
    console.log('[SettingsMenu] toggleTheme pressed');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    let nextTheme: 'light' | 'dark' | 'system' = 'light';
    if (settings.theme === 'light') nextTheme = 'dark';
    else if (settings.theme === 'dark') nextTheme = 'system';
    
    updateSettings({ theme: nextTheme });
  };

  const isOwner = currentUser?.role === 'owner';

  const menuItems = [
    {
      title: 'Manage Staff Profiles',
      subtitle: 'Add, remove or edit staff login PINs',
      icon: 'person.2.fill',
      action: () => router.push('/more/staff'),
      restricted: !hasPermission(currentUser?.role, 'manage_staff'),
    },
    {
      title: 'Database Backup & Restore',
      subtitle: 'Export data JSON or restore from backup file',
      icon: 'arrow.down.doc.fill',
      action: () => router.push('/more/backup'),
      restricted: !hasPermission(currentUser?.role, 'backup_restore'),
    },
    {
      title: 'Revenue & Stock Reports',
      subtitle: 'Sales charts, product profit margin overview',
      icon: 'chart.bar.xaxis',
      action: () => router.push('/more/reports'),
      restricted: !hasPermission(currentUser?.role, 'view_reports'),
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <ThemedText type="subtitle" style={styles.pageTitle}>More Settings</ThemedText>

        {/* Profile Details Card */}
        <Card style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
              <SymbolView
                name={{ ios: 'person.crop.circle.fill', android: 'person', web: 'person' }}
                size={48}
                tintColor={theme.textSecondary}
              />
            </View>
            <View style={styles.profileInfo}>
              <ThemedText style={styles.profileName}>{currentUser?.name}</ThemedText>
              <View style={styles.roleRow}>
                <Badge 
                  label={currentUser?.role === 'owner' ? 'OWNER' : 'STAFF MEMBER'} 
                  variant={currentUser?.role === 'owner' ? 'info' : 'neutral'} 
                />
              </View>
            </View>
          </View>
        </Card>

        {/* General App Customization settings */}
        <Card style={styles.themeCard}>
          <ThemedText style={styles.sectionTitle}>App Preferences</ThemedText>
          <View style={styles.settingRow}>
            <View>
              <ThemedText style={styles.settingName}>App Theme</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Current: {settings.theme.toUpperCase()}
              </ThemedText>
            </View>
            <TouchableOpacity
              style={[styles.themeBtn, { backgroundColor: theme.backgroundSelected }]}
              onPress={toggleTheme}
            >
              <SymbolView 
                name={{ 
                  ios: settings.theme === 'light' ? 'sun.max.fill' : settings.theme === 'dark' ? 'moon.fill' : 'iphone.circle', 
                  android: 'settings', 
                  web: 'settings' 
                } as any} 
                size={16} 
                tintColor={theme.text} 
              />
              <ThemedText style={[styles.themeBtnText, { color: theme.text }]}>Cycle</ThemedText>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Cloud Sync Settings */}
        <Card style={styles.themeCard}>
          <ThemedText style={styles.sectionTitle}>Cloud Sync Settings</ThemedText>
          <View style={styles.inputContainer}>
            <ThemedText style={styles.settingName}>Backend Server URL</ThemedText>
            <TextInput
              style={[
                styles.textInput,
                { 
                  color: theme.text, 
                  borderColor: theme.backgroundSelected, 
                  backgroundColor: theme.backgroundSelected + '20' 
                }
              ]}
              value={settings.backendUrl}
              onChangeText={(text) => updateSettings({ backendUrl: text })}
              placeholder="e.g. http://192.168.1.100:3000"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <ThemedText type="small" themeColor="textSecondary" style={{ marginTop: 4 }}>
              Enter the backend API server URL (e.g. http://10.0.2.2:3000 for Android emulator or a cloud hosting URL).
            </ThemedText>
          </View>
        </Card>

        {/* Action Lists */}
        <ThemedText style={styles.listHeader}>Management Console</ThemedText>
        <View style={styles.menuList}>
          {menuItems.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              activeOpacity={item.restricted ? 1 : 0.8}
              onPress={() => {
                console.log('[SettingsMenu] Item clicked:', item.title, 'restricted:', item.restricted);
                if (item.restricted) {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                  Alert.alert('Permission Restricted', 'Only the business Owner account can access this management screen.');
                } else if (item.action) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  item.action();
                } else {
                  console.warn('[SettingsMenu] No action defined for:', item.title);
                }
              }}
              style={[
                styles.menuItem,
                { backgroundColor: theme.backgroundElement, borderBottomColor: theme.backgroundSelected },
                item.restricted && { opacity: 0.5 }
              ]}
            >
              <View style={styles.menuLeft}>
                <View style={[styles.menuIconWrapper, { backgroundColor: theme.backgroundSelected }]}>
                  <SymbolView name={{ ios: item.icon as any, android: 'settings', web: 'settings' }} size={16} tintColor={theme.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.menuItemTitle}>{item.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{item.subtitle}</ThemedText>
                </View>
              </View>
              
              {item.restricted ? (
                <SymbolView name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }} size={14} tintColor={theme.textSecondary} />
              ) : (
                <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={14} tintColor={theme.textSecondary} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout button */}
        <Button
          title="Sign Out Session"
          variant="danger"
          onPress={handleLogout}
          style={styles.btnLogout}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    padding: Spacing.four,
    paddingBottom: 120,
  },
  pageTitle: {
    marginBottom: Spacing.four,
    fontWeight: '800',
  },
  profileCard: {
    marginBottom: Spacing.three,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    justifyContent: 'center',
    gap: 2,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
  },
  roleRow: {
    flexDirection: 'row',
  },
  themeCard: {
    marginBottom: Spacing.three,
  },
  inputContainer: {
    gap: 4,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: Spacing.one,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.two,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingName: {
    fontWeight: '700',
    fontSize: 14,
  },
  themeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
  },
  themeBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listHeader: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
    opacity: 0.7,
  },
  menuList: {
    borderRadius: Spacing.two,
    overflow: 'hidden',
    marginBottom: Spacing.four,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderBottomWidth: 1,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flex: 1,
    marginRight: Spacing.two,
  },
  menuIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemTitle: {
    fontWeight: '700',
    fontSize: 14,
  },
  btnLogout: {
    marginTop: Spacing.two,
  },
});
