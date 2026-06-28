import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from '@/components/symbol-view';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { exportDatabaseBackup, importDatabaseBackup } from '@/lib/backup';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, Button, Badge } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { format, differenceInDays } from 'date-fns';

export default function BackupRestoreScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { settings } = useSettingsStore();

  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const lastBackup = settings.lastBackupDate;
  const daysSinceBackup = lastBackup ? differenceInDays(new Date(), new Date(lastBackup)) : null;
  const needsBackup = lastBackup === null || (daysSinceBackup !== null && daysSinceBackup >= 30);

  const handleExport = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    setStatusMsg('Compiling ledger tables...');
    
    try {
      const success = await exportDatabaseBackup();
      setIsLoading(false);
      setStatusMsg('');
      if (success) {
        Alert.alert('Success', 'Backup JSON file compiled and shared successfully!');
      }
    } catch (error) {
      console.error(error);
      setIsLoading(false);
      setStatusMsg('');
      Alert.alert('Error', 'Failed to generate backup.');
    }
  };

  const handleImport = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    
    Alert.alert(
      'RESTORE WARNING',
      'Restoring a backup file will completely OVERWRITE and replace your current database. All sales, stock changes, and customers created since the backup will be deleted. Do you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore Now',
          style: 'destructive',
          onPress: triggerFilePicker,
        },
      ]
    );
  };

  const triggerFilePicker = async () => {
    setIsLoading(true);
    setStatusMsg('Opening file picker...');
    
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) {
        setIsLoading(false);
        setStatusMsg('');
        return;
      }

      const fileUri = res.assets[0].uri;
      setStatusMsg('Importing and overwriting database...');
      
      const importResult = await importDatabaseBackup(fileUri);
      setIsLoading(false);
      setStatusMsg('');

      if (importResult.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Database Restored',
          'All database tables have been successfully overwritten and restored to the backup version.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Import Failed', importResult.error || 'The chosen file is not a valid Brahma Associates backup.');
      }
    } catch (error) {
      console.error(error);
      setIsLoading(false);
      setStatusMsg('');
      Alert.alert('Error', 'Failed to load document.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={22} tintColor={theme.text} />
          </TouchableOpacity>
          <ThemedText type="subtitle" style={styles.pageTitle}>Backup & Restore</ThemedText>
        </View>

        {/* Offline Warning Banner */}
        <Card style={[styles.warningCard, { borderColor: theme.danger, borderLeftColor: theme.danger }]}>
          <View style={styles.warningHeader}>
            <SymbolView name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} size={20} tintColor={theme.danger} />
            <ThemedText style={[styles.warningTitle, { color: theme.danger }]}>CRITICAL DEVICE SECURITY</ThemedText>
          </View>
          <ThemedText type="small" style={styles.warningText} themeColor="textSecondary">
            Brahma Associates operates **locally offline** on this device. There is no cloud server.
            If this device is lost, damaged, or the app is uninstalled without a backup, **your entire sales ledger and customer directory will be permanently lost.**
          </ThemedText>
        </Card>

        {/* Backup Panel */}
        <Card style={styles.actionCard}>
          <ThemedText style={styles.sectionHeader}>Export Data Backup</ThemedText>
          
          <View style={styles.metaRow}>
            <ThemedText type="small" themeColor="textSecondary">Last Backup Taken: </ThemedText>
            <ThemedText type="smallBold">
              {lastBackup ? format(new Date(lastBackup), 'dd MMM yyyy, hh:mm a') : 'Never'}
            </ThemedText>
          </View>

          {needsBackup && (
            <View style={[styles.alertBanner, { backgroundColor: theme.warning + '1A' }]}>
              <SymbolView name={{ ios: 'clock.fill', android: 'access_time', web: 'timer' as any }} size={14} tintColor={theme.warning} />
              <ThemedText type="small" style={[styles.alertBannerText, { color: theme.warning }]}>
                No backup generated in over 30 days! Export now to secure your ledger.
              </ThemedText>
            </View>
          )}

          <Button
            title="Export & Share JSON Backup"
            variant="primary"
            disabled={isLoading}
            onPress={handleExport}
            style={styles.actionBtn}
          />
        </Card>

        {/* Restore Panel */}
        <Card style={styles.actionCard}>
          <ThemedText style={styles.sectionHeader}>Import & Restore Ledger</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: Spacing.two, lineHeight: 18 }}>
            Restore the shop database from a previously exported `.json` backup file.
            This action will replace all current tables.
          </ThemedText>

          <Button
            title="Import & Overwrite Database"
            variant="danger"
            disabled={isLoading}
            onPress={handleImport}
            style={styles.actionBtn}
          />
        </Card>

        {/* Loading Overlay */}
        {isLoading && (
          <View style={[styles.loadingOverlay, { backgroundColor: theme.background + 'B3' }]}>
            <ActivityIndicator size="large" color="#2563EB" />
            <ThemedText style={styles.loadingText}>{statusMsg}</ThemedText>
          </View>
        )}
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
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  backBtn: {
    padding: 4,
  },
  pageTitle: {
    fontWeight: '800',
  },
  warningCard: {
    borderLeftWidth: 4,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  warningTitle: {
    fontWeight: '800',
    fontSize: 13,
  },
  warningText: {
    lineHeight: 18,
  },
  actionCard: {
    padding: Spacing.three,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.two,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: Spacing.two,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.two,
    borderRadius: Spacing.one,
    marginBottom: Spacing.three,
    gap: 6,
  },
  alertBannerText: {
    fontWeight: '600',
    flex: 1,
  },
  actionBtn: {
    width: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    gap: Spacing.two,
  },
  loadingText: {
    fontWeight: '600',
    fontSize: 15,
  },
});
