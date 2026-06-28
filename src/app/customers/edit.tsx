import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { SymbolView } from '@/components/symbol-view';
import * as Haptics from 'expo-haptics';
import { useCustomerStore, Customer } from '@/stores/useCustomerStore';
import { useStockStore } from '@/stores/useStockStore';
import { useTransactionStore } from '@/stores/useTransactionStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { db } from '@/db/client';
import { stockItems } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, Input } from '@/components/ui/primitives';
import { Spacing, ListPaddingBottom } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function EditCustomerScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { customersList, addCustomer, editCustomer } = useCustomerStore();
  const isEditMode = !!id && id !== 'edit';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  
  // Purchased Scale fields
  const [purchasedScaleName, setPurchasedScaleName] = useState('');
  const [model, setModel] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [gstCharged, setGstCharged] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);

  // Live calculations
  const priceNum = parseFloat(sellingPrice) || 0;
  const gstPercent = parseFloat(gstCharged) || 0;
  const gstAmount = priceNum * (gstPercent / 100);
  const totalWithGst = priceNum + gstAmount;

  const { items: stockList, loadStock } = useStockStore();
  
  const [showScaleSuggestions, setShowScaleSuggestions] = useState(false);
  const [showModelSuggestions, setShowModelSuggestions] = useState(false);

  useEffect(() => {
    loadStock();
  }, []);

  // Filter scale names dynamically from stock inventory
  const uniqueScaleNames = Array.from(new Set(
    stockList
      .filter(s => s.category === 'scale' && s.name)
      .map(s => s.name)
  ));
  const filteredScaleNames = purchasedScaleName.trim()
    ? uniqueScaleNames.filter(name => name.toLowerCase().includes(purchasedScaleName.toLowerCase()))
    : uniqueScaleNames;

  // Filter model names dynamically from existing customer records and stock specs
  const uniqueCustomerModels = Array.from(new Set(
    customersList
      .map(c => c.model)
      .filter(Boolean) as string[]
  ));
  const uniqueStockModels = Array.from(new Set(
    stockList
      .map(s => s.capacityLabel)
      .filter(Boolean) as string[]
  ));
  const combinedModels = Array.from(new Set([
    ...uniqueCustomerModels,
    ...uniqueStockModels,
    'ASK-50', 'ASK-100', 'ASK-30', 'Essae-30', 'MIC-50'
  ]));
  const filteredModels = model.trim()
    ? combinedModels.filter(m => m.toLowerCase().includes(model.toLowerCase()))
    : combinedModels;

  // Load existing data if editing
  useEffect(() => {
    if (isEditMode && id) {
      const cust = customersList.find((c) => c.id === id);
      if (cust) {
        setName(cust.name);
        setPhone(cust.phone || '');
        setAltPhone(cust.altPhone || '');
        setBusinessName(cust.businessName || '');
        setAddress(cust.address || '');
        setGstNumber(cust.gstNumber || '');
        setPhotoUri(cust.photoUri);
        setNotes(cust.notes || '');
        setPurchasedScaleName(cust.purchasedScaleName || '');
        setModel(cust.model || '');
        setSellingPrice(cust.sellingPrice !== null ? String(cust.sellingPrice) : '');
        setGstCharged(cust.gstCharged !== null ? String(cust.gstCharged) : '');
      }
    }
  }, [id, isEditMode, customersList]);

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
            quality: 0.6,
            aspect: [1, 1],
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.6,
            aspect: [1, 1],
          });

      if (!pickerResult.canceled && pickerResult.assets[0].uri) {
        setIsLoading(true);
        const sourceUri = pickerResult.assets[0].uri;
        const filename = `customer_${Date.now()}.jpg`;
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
      console.error('Customer image picking error:', error);
      setIsLoading(false);
      Alert.alert('Error', 'Failed to capture or select image.');
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Validation Error', 'Customer Name is required.');
      return;
    }

    setIsLoading(true);

    const parsedPrice = sellingPrice ? parseFloat(sellingPrice) : null;
    const parsedGst = gstCharged ? parseFloat(gstCharged) : null;

    const custData = {
      name: name.trim(),
      phone: phone.trim() || null,
      altPhone: altPhone.trim() || null,
      businessName: businessName.trim() || null,
      address: address.trim() || null,
      gstNumber: gstNumber.trim() || null,
      photoUri,
      notes: notes.trim() || null,
      purchasedScaleName: purchasedScaleName.trim() || null,
      model: model.trim() || null,
      sellingPrice: parsedPrice,
      gstCharged: parsedGst,
    };

    let shouldLogTransaction = false;
    let existingCust: Customer | undefined;

    if (isEditMode && id) {
      existingCust = customersList.find(c => c.id === id);
      if (
        purchasedScaleName.trim() &&
        parsedPrice !== null &&
        parsedPrice > 0 &&
        (!existingCust?.purchasedScaleName || !existingCust?.sellingPrice)
      ) {
        shouldLogTransaction = true;
      }
    } else {
      if (purchasedScaleName.trim() && parsedPrice !== null && parsedPrice > 0) {
        shouldLogTransaction = true;
      }
    }

    let targetCustomerId: string | null = null;

    if (isEditMode && id) {
      const success = await editCustomer(id, custData);
      if (success) {
        targetCustomerId = id;
      }
    } else {
      const newId = await addCustomer(custData);
      if (newId) {
        targetCustomerId = newId;
      }
    }

    if (targetCustomerId) {
      if (shouldLogTransaction) {
        try {
          const scaleNameTrimmed = purchasedScaleName.trim();
          const priceNum = parsedPrice || 0;
          const gstPercent = parsedGst || 0;
          const gstAmount = priceNum * (gstPercent / 100);
          const grandTotal = priceNum + gstAmount;

          let stockItem = stockList.find(
            s => s.name.toLowerCase() === scaleNameTrimmed.toLowerCase()
          );

          const now = Date.now();

          if (!stockItem) {
            const newStockItemId = `stock_${Date.now()}`;
            const newStockItem = {
              id: newStockItemId,
              category: 'scale',
              brand: null,
              name: scaleNameTrimmed,
              capacityLabel: model.trim() || null,
              variant: null,
              quantity: 1,
              lowStockThreshold: 1,
              costPrice: null,
              sellingPrice: priceNum,
              photoUri: null,
              notes: `Auto-created during customer ${name.trim()} scale purchase entry.`,
              isActive: 1,
              isSynced: 0,
              createdAt: now,
              updatedAt: now,
            };

            await db.insert(stockItems).values(newStockItem).run();
            await useStockStore.getState().loadStock();
            stockItem = newStockItem as any;
          } else {
            if (stockItem.quantity < 1) {
              await db.update(stockItems)
                .set({ quantity: 1, updatedAt: now, isSynced: 0 })
                .where(eq(stockItems.id, stockItem.id))
                .run();
              await useStockStore.getState().loadStock();
            }
          }

          if (stockItem) {
            const txSuccess = await useTransactionStore.getState().createTransaction({
              type: 'sale',
              customerId: targetCustomerId,
              supplierName: null,
              subtotal: priceNum,
              discount: 0,
              taxAmount: gstAmount,
              grandTotal: grandTotal,
              amountPaid: 0,
              paymentMode: 'credit',
              paymentStatus: 'pending',
              createdByStaffId: useAuthStore.getState().currentUser?.id || null,
              notes: `Auto-generated ledger entry for scale purchase: ${scaleNameTrimmed} (Model: ${model.trim() || 'N/A'}).`,
              items: [
                {
                  stockItemId: stockItem.id,
                  quantity: 1,
                  unitPrice: priceNum,
                },
              ],
            });

            if (!txSuccess) {
              console.error('[handleSave] Failed to auto-create transaction in store.');
            }
          }
        } catch (txErr) {
          console.error('[handleSave] Error creating auto-transaction for scale:', txErr);
        }
      }

      setIsLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/customers');
    } else {
      setIsLoading(false);
      Alert.alert('Error', isEditMode ? 'Failed to update customer.' : 'Failed to add customer.');
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
            {isEditMode ? 'Edit Customer' : 'Add Customer'}
          </ThemedText>

          {/* Customer Avatar photo picker */}
          <View style={styles.photoContainer}>
            <View style={[styles.photoBox, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photo} />
              ) : (
                <SymbolView
                  name={{ ios: 'person.crop.circle.badge.plus', android: 'person', web: 'person' }}
                  size={48}
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
                  style={[styles.photoBtn, { backgroundColor: theme.danger + '20' }]}
                  onPress={() => setPhotoUri(null)}
                >
                  <ThemedText type="small" style={{ color: theme.danger, fontWeight: 'bold' }}>Remove</ThemedText>
                </TouchableOpacity>
              )}
            </View>
          </View>

            {/* Form */}
            <View style={styles.form}>
              <Input
                label="Customer Name *"
                placeholder="e.g. Anil Weighing Systems"
                value={name}
                onChangeText={setName}
              />

              <Input
                label="Business / Shop Name (Optional)"
                placeholder="e.g. Anil Traders"
                value={businessName}
                onChangeText={setBusinessName}
              />

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: Spacing.two }}>
                  <Input
                    label="Primary Phone"
                    placeholder="e.g. 9876543210"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={(t) => setPhone(t.replace(/[^0-9+]/g, ''))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Alt Phone"
                    placeholder="Alternate Contact"
                    keyboardType="phone-pad"
                    value={altPhone}
                    onChangeText={(t) => setAltPhone(t.replace(/[^0-9+]/g, ''))}
                  />
                </View>
              </View>

              <Input
                label="GST Number (Optional)"
                placeholder="e.g. 22AAAAA1111A1Z1"
                autoCapitalize="characters"
                value={gstNumber}
                onChangeText={setGstNumber}
              />

              <Input
                label="Business Address"
                placeholder="Full billing/shipping address"
                value={address}
                onChangeText={setAddress}
                multiline
                numberOfLines={2}
                style={styles.addressInput}
              />

              {/* Purchased Scale Details Section */}
              <ThemedText style={styles.sectionTitle}>Scale Purchase Information</ThemedText>

              <View style={{ zIndex: 20 }}>
                <Input
                  label="Purchased Scale Name"
                  placeholder="e.g. ASK Bench Scale"
                  value={purchasedScaleName}
                  onChangeText={(text) => {
                    setPurchasedScaleName(text);
                    setShowScaleSuggestions(true);
                  }}
                  onFocus={() => setShowScaleSuggestions(true)}
                />
                {showScaleSuggestions && filteredScaleNames.length > 0 && (
                  <View style={[styles.suggestionList, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                    <ScrollView nestedScrollEnabled={true} keyboardShouldPersistTaps="handled" style={{ maxHeight: 150 }}>
                      {filteredScaleNames.map((name) => {
                        const stockItem = stockList.find(s => s.name === name);
                        const priceInfo = stockItem?.sellingPrice ? ` (₹${stockItem.sellingPrice})` : '';
                        
                        return (
                          <TouchableOpacity
                            key={name}
                            onPress={() => {
                              setPurchasedScaleName(name);
                              if (stockItem?.sellingPrice) {
                                setSellingPrice(String(stockItem.sellingPrice));
                              }
                              setShowScaleSuggestions(false);
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                            style={[styles.suggestionItem, { borderBottomColor: theme.backgroundSelected }]}
                          >
                            <ThemedText style={{ fontSize: 13, fontWeight: '600', paddingVertical: 4 }}>
                              {name}
                              <ThemedText type="small" themeColor="textSecondary">{priceInfo}</ThemedText>
                            </ThemedText>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={{ zIndex: 10 }}>
                <Input
                  label="Model"
                  placeholder="e.g. ASK-50"
                  value={model}
                  onChangeText={(text) => {
                    setModel(text);
                    setShowModelSuggestions(true);
                  }}
                  onFocus={() => setShowModelSuggestions(true)}
                />
                {showModelSuggestions && filteredModels.length > 0 && (
                  <View style={[styles.suggestionList, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                    <ScrollView nestedScrollEnabled={true} keyboardShouldPersistTaps="handled" style={{ maxHeight: 150 }}>
                      {filteredModels.map((m) => (
                        <TouchableOpacity
                          key={m}
                          onPress={() => {
                            setModel(m);
                            setShowModelSuggestions(false);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }}
                          style={[styles.suggestionItem, { borderBottomColor: theme.backgroundSelected }]}
                        >
                          <ThemedText style={{ fontSize: 13, fontWeight: '600', paddingVertical: 4 }}>{m}</ThemedText>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: Spacing.two }}>
                  <Input
                    label="Selling Price (₹)"
                    placeholder="0.00"
                    keyboardType="numeric"
                    value={sellingPrice}
                    onChangeText={(t) => setSellingPrice(t.replace(/[^0-9.]/g, ''))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="GST Charged (%)"
                    placeholder="e.g. 18"
                    keyboardType="numeric"
                    value={gstCharged}
                    onChangeText={(t) => setGstCharged(t.replace(/[^0-9.]/g, ''))}
                  />
                </View>
              </View>

              {priceNum > 0 && gstPercent > 0 ? (
                <View style={[styles.gstCalcBox, { backgroundColor: theme.backgroundSelected, borderColor: theme.backgroundSelected }]}>
                  <ThemedText type="smallBold" style={{ color: theme.primary, marginBottom: 4 }}>
                    Live GST Calculation
                  </ThemedText>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                    <ThemedText type="small" themeColor="textSecondary">Base Price:</ThemedText>
                    <ThemedText type="small" style={{ fontWeight: '600' }}>₹{priceNum.toFixed(2)}</ThemedText>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <ThemedText type="small" themeColor="textSecondary">GST Amount ({gstPercent}%):</ThemedText>
                    <ThemedText type="small" style={{ fontWeight: '600', color: theme.warning }}>+ ₹{gstAmount.toFixed(2)}</ThemedText>
                  </View>
                  <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginVertical: 6 }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <ThemedText type="smallBold">Total Amount (with GST):</ThemedText>
                    <ThemedText type="smallBold" style={{ color: theme.success, fontSize: 13 }}>₹{totalWithGst.toFixed(2)}</ThemedText>
                  </View>
                </View>
              ) : null}

              <Input
                label="Credit / Khata Notes"
                placeholder="e.g. Credit terms 30 days, friendly client..."
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
                  onPress={() => router.replace('/customers')}
                  style={{ flex: 1 }}
                />
                <Button
                  title={isEditMode ? 'Update Customer' : 'Create Customer'}
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
    paddingBottom: ListPaddingBottom,
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
    paddingVertical: 6,
    paddingHorizontal: 12,
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
  row: {
    flexDirection: 'row',
  },
  addressInput: {
    height: 60,
    textAlignVertical: 'top',
    paddingTop: Spacing.two,
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
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.8,
  },
  gstCalcBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.two,
    marginTop: Spacing.one,
    marginBottom: Spacing.one,
  },
  suggestionList: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 2,
    maxHeight: 150,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    zIndex: 99,
  },
  suggestionItem: {
    padding: Spacing.two,
    borderBottomWidth: 1,
  },
});
