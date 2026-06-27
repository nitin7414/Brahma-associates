import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from '@/components/symbol-view';
import * as Haptics from 'expo-haptics';
import { useAuthStore, User } from '@/stores/useAuthStore';
import { ThemedText } from '@/components/themed-text';
import { Card, Badge, Button, Input } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { format } from 'date-fns';

const PERMISSIONS_LIST = [
  { action: 'View Stock Catalog', staff: true, owner: true, desc: 'Browse available scales, PCBs, and parts' },
  { action: 'Add Stock Items', staff: true, owner: true, desc: 'Register new models or spare parts in inventory' },
  { action: 'Edit Stock Quantities', staff: true, owner: true, desc: 'Update units in hand or upload photos' },
  { action: 'Edit Cost & Sell Prices', staff: false, owner: true, desc: 'Modify buying/selling rates & thresholds' },
  { action: 'Delete Stock Items', staff: false, owner: true, desc: 'Permanently remove products from database' },
  { action: 'Add & Edit Customers', staff: true, owner: true, desc: 'Create new customer entries and details' },
  { action: 'Delete Customers', staff: false, owner: true, desc: 'Remove customers from system directory' },
  { action: 'Create Sales & Invoices', staff: true, owner: true, desc: 'Generate sales invoices or record purchases' },
  { action: 'Void Transactions', staff: false, owner: true, desc: 'Delete or void historical ledgers' },
  { action: 'View Revenue & Reports', staff: false, owner: true, desc: 'Check sales charts, margins, & asset valuations' },
  { action: 'Manage Staff Logins', staff: false, owner: true, desc: 'Add staff members and set security PINs' },
  { action: 'Database Backups', staff: false, owner: true, desc: 'Export or import database JSON files' },
];

export default function ManageStaffScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { staffList, currentUser, addStaff, deactivateStaff } = useAuthStore();

  // Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [role, setRole] = useState<'owner' | 'staff'>('staff');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleAddStaff = async () => {
    if (!name.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMsg('Please enter a name.');
      return;
    }
    if (pin.length < 4 || pin.length > 6) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMsg('PIN must be between 4 and 6 digits.');
      return;
    }
    if (pin !== confirmPin) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMsg('PINs do not match.');
      setConfirmPin('');
      return;
    }

    setIsSaving(true);
    const success = await addStaff(name.trim(), pin, role);
    setIsSaving(false);

    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setName('');
      setPin('');
      setConfirmPin('');
      setRole('staff');
      setErrorMsg('');
      setShowAddForm(false);
      Alert.alert('Success', 'Profile created successfully.');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMsg('Failed to create account.');
    }
  };

  const handleDeactivate = (user: User) => {
    if (user.id === currentUser?.id) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Action Blocked', 'You cannot deactivate your own active session account.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Remove Staff Profile',
      `Are you sure you want to deactivate "${user.name}"? They will no longer be able to log in with their PIN.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            await deactivateStaff(user.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={22} tintColor={theme.text} />
          </TouchableOpacity>
          <ThemedText type="subtitle" style={styles.pageTitle}>Staff Accounts</ThemedText>
        </View>

        {/* Permissions Matrix Accordion */}
        <Card style={styles.permissionsCard}>
          <TouchableOpacity 
            activeOpacity={0.8} 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowPermissions(!showPermissions);
            }}
            style={styles.permissionsHeader}
          >
            <View style={styles.permissionsTitleRow}>
              <SymbolView name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }} size={18} tintColor={theme.primary} />
              <ThemedText style={styles.permissionsTitle}>Staff Access & Permissions Directory</ThemedText>
            </View>
            <SymbolView 
              name={{ ios: showPermissions ? 'chevron.up' : 'chevron.down', android: showPermissions ? 'expand_less' : 'expand_more', web: showPermissions ? 'chevron_up' : 'chevron_down' }} 
              size={18} 
              tintColor={theme.textSecondary} 
            />
          </TouchableOpacity>

          {showPermissions && (
            <View style={styles.permissionsList}>
              <View style={[styles.permissionRow, styles.permissionRowHeader, { borderBottomColor: theme.backgroundSelected }]}>
                <ThemedText type="smallBold" style={[styles.permCol, { flex: 1.5 }]}>System Operation</ThemedText>
                <ThemedText type="smallBold" style={[styles.permCol, styles.centerText, { color: theme.primary }]}>Staff</ThemedText>
                <ThemedText type="smallBold" style={[styles.permCol, styles.centerText, { color: theme.success }]}>Owner</ThemedText>
              </View>
              {PERMISSIONS_LIST.map((perm, idx) => (
                <View key={idx} style={[styles.permissionRow, { borderBottomColor: theme.backgroundSelected + '40' }]}>
                  <View style={{ flex: 1.5, gap: 2 }}>
                    <ThemedText style={{ fontSize: 13, fontWeight: '600' }}>{perm.action}</ThemedText>
                    <ThemedText style={{ fontSize: 10, color: theme.textSecondary }}>{perm.desc}</ThemedText>
                  </View>
                  <View style={[styles.permCol, styles.centerText]}>
                    <SymbolView 
                      name={perm.staff ? { ios: 'checkmark', android: 'check', web: 'check' } : { ios: 'xmark', android: 'close', web: 'close' }} 
                      size={16} 
                      tintColor={perm.staff ? theme.success : theme.danger} 
                    />
                  </View>
                  <View style={[styles.permCol, styles.centerText]}>
                    <SymbolView 
                      name={perm.owner ? { ios: 'checkmark', android: 'check', web: 'check' } : { ios: 'xmark', android: 'close', web: 'close' }} 
                      size={16} 
                      tintColor={perm.owner ? theme.success : theme.danger} 
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Toggle Form Button */}
        {!showAddForm ? (
          <TouchableOpacity
            style={[styles.btnAddTrigger, { backgroundColor: theme.primary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowAddForm(true);
            }}
          >
            <SymbolView name={{ ios: 'person.badge.plus', android: 'add', web: 'plus' } as any} size={16} tintColor="#FFFFFF" />
            <ThemedText style={styles.btnAddTriggerText}>Add Staff Account</ThemedText>
          </TouchableOpacity>
        ) : (
          <Card style={styles.addCard}>
            <ThemedText style={styles.formTitle}>New Account Registration</ThemedText>
            
            <View style={styles.form}>
              <Input
                label="Full Name"
                placeholder="e.g. Sanjay Patel"
                value={name}
                onChangeText={setName}
              />

              {/* Role selector */}
              <ThemedText style={styles.label}>Account Permission Level</ThemedText>
              <View style={styles.chipRow}>
                {(['staff', 'owner'] as const).map((r) => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setRole(r)}
                    style={[
                      styles.roleChip,
                      { backgroundColor: theme.background },
                      role === r && { backgroundColor: theme.primary },
                    ]}
                  >
                    <ThemedText 
                      style={[
                        styles.roleChipText, 
                        { fontWeight: '600' },
                        role === r && { color: '#FFFFFF', fontWeight: '800' }
                      ]}
                      themeColor={role === r ? 'text' : 'textSecondary'}
                    >
                      {r.toUpperCase()}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              <Input
                label="PIN Code (4-6 digits)"
                placeholder="Numbers only"
                keyboardType="numeric"
                secureTextEntry
                maxLength={6}
                value={pin}
                onChangeText={(t) => setPin(t.replace(/[^0-9]/g, ''))}
              />

              <Input
                label="Confirm PIN Code"
                placeholder="Re-enter PIN"
                keyboardType="numeric"
                secureTextEntry
                maxLength={6}
                value={confirmPin}
                onChangeText={(t) => setConfirmPin(t.replace(/[^0-9]/g, ''))}
              />

              {errorMsg ? <ThemedText style={styles.errorText}>{errorMsg}</ThemedText> : null}

              <View style={styles.formActions}>
                <Button
                  title="Cancel"
                  variant="secondary"
                  onPress={() => setShowAddForm(false)}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Save User"
                  variant="primary"
                  onPress={handleAddStaff}
                  loading={isSaving}
                  style={{ flex: 1.5 }}
                />
              </View>
            </View>
          </Card>
        )}

        {/* Existing Accounts List */}
        <ThemedText style={styles.listHeader}>Active Accounts Directory</ThemedText>
        <View style={styles.listWrapper}>
          {staffList.map((user) => (
            <Card key={user.id} style={styles.staffItemCard}>
              <View style={styles.staffRow}>
                <View style={styles.staffInfo}>
                  <ThemedText style={styles.staffName}>{user.name}</ThemedText>
                  <View style={styles.badgeRow}>
                    <Badge
                      label={user.role}
                      variant={user.role === 'owner' ? 'info' : 'neutral'}
                    />
                    <ThemedText type="small" themeColor="textSecondary">
                      Created: {format(new Date(user.createdAt), 'dd MMM yyyy')}
                    </ThemedText>
                  </View>
                </View>

                {user.id !== currentUser?.id && (
                  <TouchableOpacity
                    style={styles.btnDelete}
                    onPress={() => handleDeactivate(user)}
                  >
                    <SymbolView name={{ ios: 'trash.fill', android: 'delete', web: 'delete' }} size={18} tintColor={theme.danger} />
                  </TouchableOpacity>
                )}
              </View>
            </Card>
          ))}
        </View>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  backBtn: {
    padding: 4,
  },
  pageTitle: {
    fontWeight: '800',
  },
  permissionsCard: {
    marginBottom: Spacing.four,
    padding: 0,
    overflow: 'hidden',
  },
  permissionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
  },
  permissionsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  permissionsTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  permissionsList: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    gap: 8,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  permissionRowHeader: {
    paddingVertical: 6,
    borderBottomWidth: 1.5,
  },
  permCol: {
    flex: 1,
  },
  centerText: {
    textAlign: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnAddTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    gap: 6,
    marginBottom: Spacing.four,
  },
  btnAddTriggerText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  addCard: {
    marginBottom: Spacing.four,
  },
  formTitle: {
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.two,
  },
  form: {
    gap: Spacing.two,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    marginLeft: 2,
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.one,
    marginBottom: Spacing.one,
  },
  roleChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  roleChipText: {
    fontSize: 12,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  formActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  listHeader: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.two,
    opacity: 0.7,
  },
  listWrapper: {
    gap: Spacing.one,
  },
  staffItemCard: {
    paddingVertical: Spacing.two,
  },
  staffRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  staffInfo: {
    flex: 1,
    gap: 2,
  },
  staffName: {
    fontSize: 15,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  btnDelete: {
    padding: Spacing.two,
  },
});
