import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  TextInput,
  View,
  Text,
  ActivityIndicator,
  TextInputProps,
  TouchableOpacityProps,
  Animated,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { ThemedText } from '../themed-text';

// 1. Premium Card with spring scale-on-press animation
interface CardProps {
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
}

export function Card({ children, style, onPress }: CardProps) {
  const theme = useTheme();
  const scaleValue = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (!onPress) return;
    Animated.spring(scaleValue, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    if (!onPress) return;
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  };

  const cardStyle = [
    styles.card,
    {
      backgroundColor: theme.backgroundElement,
      borderColor: theme.backgroundSelected,
      shadowColor: theme.text,
    },
    style,
  ];

  const flatStyle = StyleSheet.flatten(style);
  const flexVal = flatStyle?.flex;

  if (onPress) {
    return (
      <Animated.View style={{ transform: [{ scale: scaleValue }], flex: flexVal }}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onPress();
          }}
          style={cardStyle}
        >
          {children}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

// 2. Styled Button with tactile press-scale feedback
interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  loading?: boolean;
}

export function Button({
  title,
  variant = 'primary',
  loading = false,
  style,
  disabled,
  onPress,
  ...props
}: ButtonProps) {
  const theme = useTheme();
  const scaleValue = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleValue, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 20,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
    }).start();
  };

  const getBackgroundColor = () => {
    if (disabled) return theme.backgroundSelected;
    switch (variant) {
      case 'primary': return theme.primary;
      case 'danger': return theme.danger;
      case 'success': return theme.success;
      case 'secondary': return theme.backgroundSelected;
    }
  };

  const getTextColor = () => {
    if (disabled) return theme.textSecondary;
    if (variant === 'secondary') return theme.text;
    return '#FFFFFF';
  };

  const handlePress = (e: any) => {
    if (loading || disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onPress) onPress(e);
  };

  const flatStyle = StyleSheet.flatten(style);
  const flexVal = flatStyle?.flex;

  return (
    <Animated.View style={{ transform: [{ scale: scaleValue }], flex: flexVal }}>
      <TouchableOpacity
        activeOpacity={0.85}
        disabled={disabled || loading}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={[
          styles.button,
          { backgroundColor: getBackgroundColor() },
          style,
        ]}
        {...props}
      >
        {loading ? (
          <ActivityIndicator size="small" color={getTextColor()} />
        ) : (
          <Text style={[styles.buttonText, { color: getTextColor() }]}>
            {title}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// 3. Styled TextInput with custom border transition on focus
interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<TextInput, InputProps>(
  ({ label, error, style, onFocus, onBlur, ...props }, ref) => {
    const theme = useTheme();
    const [isFocused, setIsFocused] = useState(false);

    return (
      <View style={styles.inputContainer}>
        {label && (
          <ThemedText style={styles.label} themeColor="textSecondary">
            {label}
          </ThemedText>
        )}
        <TextInput
          ref={ref}
          style={[
            styles.input,
            {
              color: theme.text,
              backgroundColor: theme.backgroundElement,
              borderColor: error
                ? theme.danger
                : isFocused
                ? theme.primary
                : theme.backgroundSelected,
            },
            style,
          ]}
          placeholderTextColor={theme.textSecondary}
          onFocus={(e) => {
            setIsFocused(true);
            if (onFocus) onFocus(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            if (onBlur) onBlur(e);
          }}
          {...props}
        />
        {error && <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>}
      </View>
    );
  }
);

// 4. Status Badge utilizing theme variables
interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'danger' | 'neutral' | 'info';
  style?: any;
}

export function Badge({ label, variant = 'neutral', style }: BadgeProps) {
  const theme = useTheme();

  const getColors = () => {
    switch (variant) {
      case 'success': return { bg: theme.success + '1A', text: theme.success };
      case 'warning': return { bg: theme.warning + '1A', text: theme.warning };
      case 'danger': return { bg: theme.danger + '1A', text: theme.danger };
      case 'info': return { bg: theme.primary + '1A', text: theme.primary };
      default: return { bg: theme.textSecondary + '1A', text: theme.textSecondary };
    }
  };

  const colors = getColors();

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }, style]}>
      <Text style={[styles.badgeText, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.three,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: Spacing.two,
  },
  button: {
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  inputContainer: {
    marginBottom: Spacing.two,
    width: '100%',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Spacing.one,
    marginLeft: 2,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    marginLeft: 4,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
