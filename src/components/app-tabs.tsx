import { Tabs, TabList, TabTrigger, TabSlot, TabTriggerSlotProps } from 'expo-router/ui';
import { SymbolView } from '@/components/symbol-view';
import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { ThemedText } from './themed-text';

export default function AppTabs() {
  return (
    <Tabs style={styles.container}>
      <TabSlot style={styles.slot} />
      <TabList style={styles.tabBar}>
        <TabTrigger name="index" href="/" asChild>
          <MobileTabButton  
            icon={{ ios: 'house.fill', android: 'home', web: 'home' }} 
          />
        </TabTrigger>

        <TabTrigger name="stock" href="/stock" asChild>
          <MobileTabButton 
            icon={{ ios: 'square.grid.3x3.fill', android: 'inventory', web: 'inventory' }} 
          />
        </TabTrigger>

        <TabTrigger name="transactions" href="/transactions" asChild>
          <MobileTabButton 
            icon={{ ios: 'doc.text.fill', android: 'receipt_long', web: 'receipt_long' }} 
          />
        </TabTrigger>

        <TabTrigger name="customers" href="/customers" asChild>
          <MobileTabButton 
            icon={{ ios: 'person.2.fill', android: 'group', web: 'group' }} 
          />
        </TabTrigger>

        <TabTrigger name="more" href="/more" asChild>
          <MobileTabButton 
            icon={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }} 
          />
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}

interface MobileTabButtonProps extends TabTriggerSlotProps {
  icon: { ios: string; android: string; web: string };
}

function MobileTabButton({icon, isFocused, ...props }: MobileTabButtonProps) {
  const activeColor = '#FFFFFF'; // White when active
  const inactiveColor = '#8E8E93'; // Muted iOS gray when inactive

  return (
    <Pressable {...props} style={styles.tabButton}>
      <View style={[
        styles.iconContainer, 
        isFocused && styles.activeIconContainer
      ]}>
        <SymbolView
          name={icon as any}
          size={20}
          tintColor={isFocused ? activeColor : inactiveColor}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slot: {
    flex: 1,
  },
  tabBar: {
    position: 'absolute',
    bottom: process.env.EXPO_OS === 'ios' ? 34 : 24,
    left: 20,
    right: 20,
    height: 72,
    borderRadius: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(20, 20, 24, 0.94)', // Matte dark glass
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.16)', // Watery shiny inset border highlight
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)', // Premium iOS soft shadow
    elevation: 8,
    paddingHorizontal: 8,
    borderCurve: 'continuous', // Smooth rounded corners
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  activeIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)', // Translucent circular active highlight
  },
  labelText: {
    fontSize: 9.5,
    letterSpacing: 0.2,
  },
});
