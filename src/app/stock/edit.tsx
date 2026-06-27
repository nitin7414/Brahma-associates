import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Text,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { SymbolView } from '@/components/symbol-view';
import * as Haptics from 'expo-haptics';
import { useStockStore } from '@/stores/useStockStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { ThemedText } from '@/components/themed-text';
import { Button, Input } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const CATEGORIES = [
  { value: 'scale', label: 'Scale' },
  { value: 'loadcell', label: 'Load Cell' },
  { value: 'pcb', label: 'PCB' },
  { value: 'display', label: 'Display' },
  { value: 'spare_part', label: 'Spare Part' },
];

const BRANDS = [
  { value: 'ASK', label: 'ASK' },
  { value: 'Essae', label: 'Essae' },
  { value: 'MIC', label: 'MIC' },
  { value: 'None', label: 'None / Generic' },
];

const SPARE_PART_TYPES = ['connector', 'switch', 'cable', 'transformer', 'other'];

export default function EditStockScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const { currentUser } = useAuthStore();
  const { items, addStockItem, editStockItem } = useStockStore();

  const isEditMode = !!id && id !== 'edit';
  const isOwner = currentUser?.role === 'owner';

  // Form State
  const [category, setCategory] = useState('scale');
  const [brand, setBrand] = useState('None');
  const [capacity, setCapacity] = useState('');
  const [variant, setVariant] = useState('');
  const [sparePartType, setSparePartType] = useState('connector');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Load existing data if editing
  useEffect(() => {
    if (isEditMode && id) {
      const item = items.find((i) => i.id === id);
      if (item) {
        setCategory(item.category);
        setBrand(item.brand || 'None');
        setCapacity(item.capacityLabel || '');
        setVariant(item.variant || '');
        setName(item.name);
        setQuantity(String(item.quantity));
        setCostPrice(item.costPrice !== null ? String(item.costPrice) : '');
        setSellingPrice(item.sellingPrice !== null ? String(item.sellingPrice) : '');
        setLowStockThreshold(String(item.lowStockThreshold));
        setPhotoUri(item.photoUri);
        setNotes(item.notes || '');

        if (item.category === 'spare_part') {
          const varLower = (item.variant || '').toLowerCase();
          if (SPARE_PART_TYPES.includes(varLower)) {
            setSparePartType(varLower);
          } else {
            setSparePartType('other');
          }
        }
      }
    }
  }, [id, isEditMode, items]);

  // Autofill name based on selections dynamically
  useEffect(() => {
    if (!isEditMode) {
      if (category === 'scale') {
        const catLabel = CATEGORIES.find((c) => c.value === category)?.label || '';
        const brandStr = brand !== 'None' ? brand : '';
        const parts = [brandStr, catLabel, capacity, variant].filter(Boolean);
        setName(parts.join(' '));
      } else if (category === 'loadcell') {
        setName(`Loadcell ${capacity}`.trim());
      } else if (category === 'pcb') {
        const brandStr = brand !== 'None' ? brand : '';
        setName(`PCB ${brandStr}`.trim());
      } else if (category === 'display') {
        const brandStr = brand !== 'None' ? brand : '';
        setName(`Display ${brandStr} ${variant}`.trim());
      } else if (category === 'spare_part') {
        setName(`Spare Part ${sparePartType.charAt(0).toUpperCase() + sparePartType.slice(1)}`.trim());
      }
    }
  }, [category, brand, capacity, variant, sparePartType, isEditMode]);

  const handlePickImage = async (useCamera: boolean) => {
    try {
      let permissionResult;
      if (useCamera) {
        permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      } else {
        permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      }

      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Permission to access camera/gallery is required.');
        return;
      }

      const pickerResult = useCamera
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            quality: 0.7,
            aspect: [1, 1],
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
            aspect: [1, 1],
          });

      if (!pickerResult.canceled && pickerResult.assets[0].uri) {
        setIsLoading(true);
        const sourceUri = pickerResult.assets[0].uri;
        const filename = `stock_${Date.now()}.jpg`;
        const destUri = `${(FileSystem as any).documentDirectory}${filename}`;
        
        await FileSystem.copyAsync({
          from: sourceUri,
          to: destUri,
        });

        setPhotoUri(destUri);
        setIsLoading(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Image picking error:', error);
      setIsLoading(false);
      Alert.alert('Error', 'Failed to select image.');
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Validation Error', 'Item Name is required.');
      return;
    }

    setIsLoading(true);

    const parsedCost = costPrice ? parseFloat(costPrice) : 0;
    const parsedSell = sellingPrice ? parseFloat(sellingPrice) : 0;
    const parsedQty = quantity ? parseInt(quantity, 10) : 0;
    const parsedThreshold = lowStockThreshold ? parseInt(lowStockThreshold, 10) : 5;

    // Filter fields based on category constraints
    let finalBrand: string | null = brand === 'None' ? null : brand;
    let finalCapacity: string | null = capacity.trim() || null;
    let finalVariant: string | null = variant.trim() || null;
    let finalName = name.trim();

    if (category === 'loadcell') {
      finalBrand = null;
      finalVariant = null;
      finalName = `Loadcell ${capacity.trim()}`.trim();
    } else if (category === 'pcb') {
      finalCapacity = null;
      finalVariant = null;
      finalName = `PCB ${brand === 'None' ? '' : brand}`.trim();
    } else if (category === 'display') {
      finalCapacity = null;
      finalName = `Display ${brand === 'None' ? '' : brand} ${variant.trim()}`.trim();
    } else if (category === 'spare_part') {
      finalBrand = null;
      finalCapacity = null;
      finalVariant = sparePartType;
      finalName = `Spare Part ${sparePartType.charAt(0).toUpperCase() + sparePartType.slice(1)}`.trim();
    }

    const notesVal = notes.trim() || null;

    if (isEditMode && id) {
      const updates: any = {
        photoUri,
        notes: notesVal,
      };

      if (isOwner) {
        updates.category = category;
        updates.brand = finalBrand;
        updates.capacityLabel = finalCapacity;
        updates.variant = finalVariant;
        updates.name = finalName;
        updates.costPrice = parsedCost;
        updates.sellingPrice = parsedSell;
        updates.lowStockThreshold = parsedThreshold;
        updates.quantity = parsedQty;
      } else {
        updates.quantity = parsedQty;
      }

      const success = await editStockItem(id, updates);
      setIsLoading(false);
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/stock');
      } else {
        Alert.alert('Error', 'Failed to update stock item.');
      }
    } else {
      const newItemData = {
        category,
        brand: finalBrand,
        name: finalName,
        capacityLabel: finalCapacity,
        variant: finalVariant,
        costPrice: parsedCost,
        sellingPrice: parsedSell,
        lowStockThreshold: parsedThreshold,
        photoUri,
        notes: notesVal,
        quantity: parsedQty,
      };

      const success = await addStockItem(newItemData);
      setIsLoading(false);
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/stock');
      } else {
        Alert.alert('Error', 'Failed to add stock item.');
      }
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <ThemedText type="subtitle" style={styles.pageTitle}>
            {isEditMode ? 'Edit Stock Item' : 'Add Stock Item'}
          </ThemedText>

          {/* Photo Section */}
          <View style={styles.photoContainer}>
            <View style={[styles.photoBox, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photo} />
              ) : (
                <SymbolView
                  name={{ ios: 'camera.fill', android: 'camera', web: 'camera' }}
                  size={32}
                  tintColor={theme.textSecondary}
                />
              )}
            </View>
            <View style={styles.photoButtons}>
              <TouchableOpacity
                style={[styles.photoBtn, { backgroundColor: theme.backgroundElement }]}
                onPress={() => handlePickImage(true)}
              >
                <SymbolView name={{ ios: 'camera', android: 'camera', web: 'camera' }} size={14} tintColor={theme.text} />
                <ThemedText type="small" style={styles.photoBtnText}>Camera</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.photoBtn, { backgroundColor: theme.backgroundElement }]}
                onPress={() => handlePickImage(false)}
              >
                <SymbolView name={{ ios: 'photo', android: 'image', web: 'image' }} size={14} tintColor={theme.text} />
                <ThemedText type="small" style={styles.photoBtnText}>Gallery</ThemedText>
              </TouchableOpacity>
              {photoUri && (
                <TouchableOpacity
                  style={[styles.photoBtn, { backgroundColor: theme.danger + '12' }]}
                  onPress={() => setPhotoUri(null)}
                >
                  <ThemedText type="small" style={{ color: theme.danger, fontWeight: '800' }}>Remove</ThemedText>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Item details form */}
          <View style={styles.form}>
            {/* Category selection - always visible */}
            <ThemedText style={styles.sectionLabel}>Category</ThemedText>
            <View style={styles.chipRow}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.value}
                  disabled={isEditMode && !isOwner}
                  onPress={() => setCategory(cat.value)}
                  style={[
                    styles.formChip,
                    { backgroundColor: theme.backgroundElement },
                    category === cat.value && { backgroundColor: theme.primary },
                    isEditMode && !isOwner && { opacity: 0.5 },
                  ]}
                >
                  <Text 
                    style={[
                      styles.chipText, 
                      { color: theme.text, fontWeight: '600' },
                      category === cat.value && { color: '#FFFFFF', fontWeight: '800' }
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 1. Brand selection - visible for Scale, PCB, Display */}
            {(category === 'scale' || category === 'pcb' || category === 'display') && (
              <View style={styles.formGroup}>
                <ThemedText style={styles.sectionLabel}>
                  {category === 'display' ? 'Company (Brand)' : 'Brand'}
                </ThemedText>
                <View style={styles.chipRow}>
                  {BRANDS.map((b) => (
                    <TouchableOpacity
                      key={b.value}
                      disabled={isEditMode && !isOwner}
                      onPress={() => setBrand(b.value)}
                      style={[
                        styles.formChip,
                        { backgroundColor: theme.backgroundElement },
                        brand === b.value && { backgroundColor: theme.primary },
                        isEditMode && !isOwner && { opacity: 0.5 },
                      ]}
                    >
                      <Text 
                        style={[
                          styles.chipText, 
                          { color: theme.text, fontWeight: '600' },
                          brand === b.value && { color: '#FFFFFF', fontWeight: '800' }
                        ]}
                      >
                        {b.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* 2. Spare Part Type options - visible ONLY for spare_part */}
            {category === 'spare_part' && (
              <View style={styles.formGroup}>
                <ThemedText style={styles.sectionLabel}>Spare Part Type</ThemedText>
                <View style={styles.chipRow}>
                  {SPARE_PART_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      disabled={isEditMode && !isOwner}
                      onPress={() => setSparePartType(type)}
                      style={[
                        styles.formChip,
                        { backgroundColor: theme.backgroundElement },
                        sparePartType === type && { backgroundColor: theme.primary },
                        isEditMode && !isOwner && { opacity: 0.5 },
                      ]}
                    >
                      <Text 
                        style={[
                          styles.chipText, 
                          { color: theme.text, fontWeight: '600' },
                          sparePartType === type && { color: '#FFFFFF', fontWeight: '800' }
                        ]}
                      >
                        {type.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* 3. Capacity Input - visible for Scale, Loadcell */}
            {(category === 'scale' || category === 'loadcell') && (
              <Input
                label={category === 'loadcell' ? "Capacity / Weight (e.g. 40 Kg)" : "Capacity / Spec (e.g. 50 Kg)"}
                placeholder="e.g. 50 Kg, 40 Kg"
                value={capacity}
                editable={!isEditMode || isOwner}
                onChangeText={setCapacity}
                style={isEditMode && !isOwner && { opacity: 0.6 }}
              />
            )}

            {/* 4. Variant/Color Input - visible for Scale, Display */}
            {(category === 'scale' || category === 'display') && (
              <Input
                label={category === 'display' ? "Color" : "Variant (e.g. Dual Range, Large)"}
                placeholder={category === 'display' ? "e.g. Red, Green" : "e.g. Dual Range, Large"}
                value={variant}
                editable={!isEditMode || isOwner}
                onChangeText={setVariant}
                style={isEditMode && !isOwner && { opacity: 0.6 }}
              />
            )}

            {/* 5. Display Name Preview / Edit - Hide for Loadcell, PCB, Display, Spare Part as requested to keep form lean */}
            {category === 'scale' && (
              <Input
                label="Item Name (Autofilled)"
                placeholder="Item display name"
                value={name}
                editable={!isEditMode || isOwner}
                onChangeText={setName}
                style={isEditMode && !isOwner && { opacity: 0.6 }}
              />
            )}

            {/* Quantity selection - always visible */}
            <Input
              label="Stock Quantity"
              placeholder="0"
              keyboardType="numeric"
              value={quantity}
              onChangeText={(t) => setQuantity(t.replace(/[^0-9]/g, ''))}
            />

            {/* Owner-only Financial Fields - always visible */}
            {isOwner ? (
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: Spacing.two }}>
                  <Input
                    label="Cost Price (₹)"
                    placeholder="0.00"
                    keyboardType="numeric"
                    value={costPrice}
                    onChangeText={(t) => setCostPrice(t.replace(/[^0-9.]/g, ''))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Selling Price (₹)"
                    placeholder="0.00"
                    keyboardType="numeric"
                    value={sellingPrice}
                    onChangeText={(t) => setSellingPrice(t.replace(/[^0-9.]/g, ''))}
                  />
                </View>
              </View>
            ) : null}

            {isOwner ? (
              <Input
                label="Low-Stock Alert Threshold"
                placeholder="5"
                keyboardType="numeric"
                value={lowStockThreshold}
                onChangeText={(t) => setLowStockThreshold(t.replace(/[^0-9]/g, ''))}
              />
            ) : null}

            <Input
              label="Notes"
              placeholder="Additional specifications or notes..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              style={styles.notesInput}
            />

            <View style={styles.actionRow}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => router.replace('/stock')}
                style={{ flex: 1 }}
              />
              <Button
                title={isEditMode ? 'Update Item' : 'Save Item'}
                variant="primary"
                onPress={handleSave}
                loading={isLoading}
                style={{ flex: 1.5 }}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    padding: Spacing.four,
    paddingBottom: 40,
  },
  pageTitle: {
    marginBottom: Spacing.four,
    fontWeight: '800',
  },
  photoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.four,
    gap: Spacing.two,
  },
  photoBox: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: 14,
    gap: 4,
  },
  photoBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  form: {
    gap: Spacing.two,
  },
  formGroup: {
    gap: Spacing.one,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: Spacing.one,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginBottom: Spacing.one,
    marginTop: 4,
  },
  formChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  chipText: {
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
    paddingTop: Spacing.two,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
});
