import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { SymbolView } from '@/components/symbol-view';
import { useAuthStore } from '@/stores/useAuthStore';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Image } from 'expo-image';

export default function LoginScreen() {
  const { isInitialized, initializeAuth, login, createOwner, isLoading } = useAuthStore();
  const theme = useTheme();
  
  // Auth state
  const [pin, setPin] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Animation refs
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    initializeAuth();
  }, []);

  const triggerShake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true })
    ]).start();
  };

  const handleKeyPress = (char: string) => {
    if (pin.length >= 6) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newPin = pin + char;
    setPin(newPin);
    setErrorMsg('');
    
    // Auto-submit if PIN reaches 4 or 6 digits
    if (newPin.length === 4 || newPin.length === 6) {
      checkPin(newPin);
    }
  };

  const checkPin = async (enteredPin: string) => {
    const success = await login(enteredPin);
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      if (enteredPin.length === 6) {
        setTimeout(() => {
          triggerShake();
          setPin('');
          setErrorMsg('Invalid PIN. Please try again.');
        }, 150);
      }
    }
  };

  const handlePinSubmit = () => {
    if (pin.length < 4) {
      triggerShake();
      setErrorMsg('PIN must be at least 4 digits');
      return;
    }
    checkPin(pin);
    setTimeout(() => {
      if (!useAuthStore.getState().currentUser) {
        triggerShake();
        setPin('');
        setErrorMsg('Invalid PIN. Please try again.');
      }
    }, 200);
  };

  const handleDelete = () => {
    if (pin.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPin(pin.slice(0, -1));
    setErrorMsg('');
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPin('');
    setErrorMsg('');
  };

  const handleCreateOwner = async () => {
    if (!ownerName.trim()) {
      triggerShake();
      setErrorMsg('Please enter your name.');
      return;
    }
    if (pin.length < 4 || pin.length > 6) {
      triggerShake();
      setErrorMsg('PIN must be between 4 and 6 digits.');
      return;
    }
    if (pin !== confirmPin) {
      triggerShake();
      setErrorMsg('PINs do not match.');
      setConfirmPin('');
      return;
    }

    const success = await createOwner(ownerName, pin);
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      triggerShake();
      setErrorMsg('Failed to create profile.');
    }
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText style={styles.loadingText}>Initializing system...</ThemedText>
      </ThemedView>
    );
  }

  // 1. SETUP WIZARD (First Launch)
  if (!isInitialized) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
            <View style={styles.header}>
              <View style={[styles.iconWrapper, { backgroundColor: theme.primary + '15' }]}>
                <SymbolView
                  name={{ ios: 'shield.fill', android: 'lock', web: 'lock' }}
                  size={32}
                  tintColor={theme.primary}
                />
              </View>
              <ThemedText type="subtitle" style={styles.wizardTitle}>
                Setup Owner Profile
              </ThemedText>
              <ThemedText style={styles.wizardSubtitle} themeColor="textSecondary">
                This is a local offline device. Create the primary Owner PIN to secure the app.
              </ThemedText>
            </View>

            <View style={styles.form}>
              <ThemedText style={styles.label}>Owner Name</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    backgroundColor: theme.background,
                    borderColor: theme.backgroundSelected,
                  },
                ]}
                placeholder="e.g. Ramesh Kumar"
                placeholderTextColor={theme.textSecondary}
                value={ownerName}
                onChangeText={(text) => {
                  setOwnerName(text);
                  setErrorMsg('');
                }}
              />

              <ThemedText style={styles.label}>Create PIN (4-6 digits)</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    backgroundColor: theme.background,
                    borderColor: theme.backgroundSelected,
                  },
                ]}
                placeholder="Enter numbers only"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
                secureTextEntry
                maxLength={6}
                value={pin}
                onChangeText={(text) => {
                  setPin(text.replace(/[^0-9]/g, ''));
                  setErrorMsg('');
                }}
              />

              <ThemedText style={styles.label}>Confirm PIN</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    backgroundColor: theme.background,
                    borderColor: theme.backgroundSelected,
                  },
                ]}
                placeholder="Re-enter PIN"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
                secureTextEntry
                maxLength={6}
                value={confirmPin}
                onChangeText={(text) => {
                  setConfirmPin(text.replace(/[^0-9]/g, ''));
                  setErrorMsg('');
                }}
              />

              {errorMsg ? (
                <ThemedText style={[styles.errorText, { color: theme.danger }]}>{errorMsg}</ThemedText>
              ) : null}

              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.btnPrimary, { backgroundColor: theme.primary }]}
                onPress={handleCreateOwner}
              >
                <ThemedText style={styles.btnText}>Create & Get Started</ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // 2. PIN PAD LOGIN SCREEN
  const currentPinLength = Math.max(4, pin.length);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Animated.View 
        style={[
          styles.loginWrapper, 
          { transform: [{ translateX: shakeAnim }] }
        ]}
      >
        {/* Top Header */}
        <View style={styles.loginHeader}>
          <Image
            source={require('@/assets/images/Logo_main.png')}
            style={styles.logoMain}
            contentFit="contain"
          />
          <ThemedText type="subtitle" style={[styles.brandTitle, { color: theme.primary }]}>
            Brahma Associates
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.brandSubtitle}>
            Weighing Scales & Spares
          </ThemedText>
          
          <ThemedText type="small" style={styles.loginInstruction} themeColor="textSecondary">
            Enter PIN to log in
          </ThemedText>
        </View>

        {/* Dynamic PIN Indicators (Displays 4 dots by default, grows to 5 or 6 if entered) */}
        <View style={styles.dotContainer}>
          {Array.from({ length: currentPinLength }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                { backgroundColor: theme.backgroundSelected },
                pin.length > index && { backgroundColor: theme.primary },
              ]}
            />
          ))}
        </View>

        {errorMsg ? (
          <ThemedText style={[styles.errorTextCenter, { color: theme.danger }]}>{errorMsg}</ThemedText>
        ) : (
          <View style={{ height: 20 }} />
        )}

        {/* Keypad Grid */}
        <View style={styles.keypad}>
          <View style={styles.row}>
            {['1', '2', '3'].map((num) => (
              <TouchableOpacity
                key={num}
                style={[styles.key, { backgroundColor: theme.backgroundElement }]}
                onPress={() => handleKeyPress(num)}
              >
                <ThemedText style={styles.keyText}>{num}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.row}>
            {['4', '5', '6'].map((num) => (
              <TouchableOpacity
                key={num}
                style={[styles.key, { backgroundColor: theme.backgroundElement }]}
                onPress={() => handleKeyPress(num)}
              >
                <ThemedText style={styles.keyText}>{num}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.row}>
            {['7', '8', '9'].map((num) => (
              <TouchableOpacity
                key={num}
                style={[styles.key, { backgroundColor: theme.backgroundElement }]}
                onPress={() => handleKeyPress(num)}
              >
                <ThemedText style={styles.keyText}>{num}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.keyAction]}
              onPress={handleClear}
            >
              <ThemedText style={styles.actionText}>C</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.key, { backgroundColor: theme.backgroundElement }]}
              onPress={() => handleKeyPress('0')}
            >
              <ThemedText style={styles.keyText}>0</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.keyAction]}
              onPress={handleDelete}
            >
              <SymbolView
                name={{ ios: 'delete.left.fill', android: 'backspace', web: 'backspace' }}
                size={22}
                tintColor={theme.text}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Action Button for shorter 4-digit PINs if needed */}
        {pin.length >= 4 && (
          <TouchableOpacity
            style={[styles.btnLoginSubmit, { backgroundColor: theme.primary }]}
            onPress={handlePinSubmit}
          >
            <ThemedText style={styles.btnSubmitText}>Submit PIN</ThemedText>
          </TouchableOpacity>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
  },
  loadingText: {
    fontSize: 16,
  },
  keyboardView: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: Spacing.four,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.four,
    gap: Spacing.one,
  },
  iconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  wizardTitle: {
    fontWeight: '700',
    fontSize: 22,
    textAlign: 'center',
  },
  wizardSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: Spacing.one,
    lineHeight: 20,
  },
  form: {
    gap: Spacing.two,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: Spacing.one,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  btnPrimary: {
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.three,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: Spacing.one,
    textAlign: 'center',
  },
  errorTextCenter: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginVertical: Spacing.one,
    height: 20,
  },
  loginWrapper: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  loginHeader: {
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  logoMain: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    alignSelf: 'center',
    marginBottom: Spacing.two,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  brandSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: Spacing.half,
    textAlign: 'center',
    opacity: 0.8,
  },
  loginInstruction: {
    fontSize: 14,
    marginTop: Spacing.five,
    textAlign: 'center',
    fontWeight: '600',
  },
  dotContainer: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    height: 30,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  keypad: {
    width: '100%',
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  key: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  keyAction: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyText: {
    fontSize: 26,
    fontWeight: '600',
  },
  actionText: {
    fontSize: 22,
    fontWeight: '600',
    opacity: 0.7,
  },
  btnLoginSubmit: {
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.four,
    borderRadius: 12,
    marginTop: Spacing.four,
    width: '100%',
    alignItems: 'center',
  },
  btnSubmitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
