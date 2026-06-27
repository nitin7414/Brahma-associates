import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';

export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Keep splash screen visible for exactly 2 seconds (2000ms)
    const timer = setTimeout(() => {
      // Smooth fade out over 500ms
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        setVisible(false);
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.splashContainer, { opacity: fadeAnim }]}>
      <Image
        source={require('@/assets/images/splash-screen.png')}
        style={styles.splashImage}
        contentFit="cover"
      />
    </Animated.View>
  );
}

// Keep AnimatedIcon export stub for compatibility
export function AnimatedIcon() {
  return null;
}

const styles = StyleSheet.create({
  splashContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    zIndex: 99999, // Render on top of everything
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashImage: {
    width: '100%',
    height: '100%',
  },
});
