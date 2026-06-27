import React from 'react';
import { Platform, ViewProps, ColorValue } from 'react-native';
import * as Lucide from 'lucide-react-native';

// Try to load native SymbolView if we are on iOS
let NativeSymbolView: any = null;
if (Platform.OS === 'ios') {
  try {
    NativeSymbolView = require('expo-symbols').SymbolView;
  } catch (e) {
    console.warn('expo-symbols is not available even on iOS');
  }
}

// Maps common SF Symbols / fallback names to Lucide icon components
const lucideMap: Record<string, React.ComponentType<any>> = {
  'house.fill': Lucide.Home,
  'home': Lucide.Home,
  'square.grid.3x3.fill': Lucide.Boxes,
  'inventory': Lucide.Package,
  'doc.text.fill': Lucide.Receipt,
  'receipt_long': Lucide.Receipt,
  'person.2.fill': Lucide.Users,
  'group': Lucide.Users,
  'gearshape.fill': Lucide.Settings,
  'settings': Lucide.Settings,
  'arrow.triangle.2.circlepath': Lucide.RefreshCw,
  'sync': Lucide.RefreshCw,
  'magnifyingglass': Lucide.Search,
  'search': Lucide.Search,
  'power': Lucide.LogOut,
  'exit_to_app': Lucide.LogOut,
  'logout': Lucide.LogOut,
  'cart.badge.plus': Lucide.ShoppingCart,
  'add_shopping_cart': Lucide.ShoppingCart,
  'plus': Lucide.Plus,
  'plus.square.fill': Lucide.PlusSquare,
  'add_box': Lucide.PlusSquare,
  'add': Lucide.Plus,
  'person.badge.plus.fill': Lucide.UserPlus,
  'person.badge.plus': Lucide.UserPlus,
  'person_add': Lucide.UserPlus,
  'checkmark.seal.fill': Lucide.CheckCircle2,
  'check_circle': Lucide.CheckCircle2,
  'check': Lucide.Check,
  'person.crop.circle': Lucide.User,
  'person.crop.circle.fill': Lucide.User,
  'person.crop.circle.badge.plus': Lucide.UserPlus,
  'trash.fill': Lucide.Trash2,
  'delete': Lucide.Trash2,
  'chevron.left': Lucide.ChevronLeft,
  'arrow_back': Lucide.ArrowLeft,
  'clock.badge.exclamationmark': Lucide.History,
  'history': Lucide.History,
  'circle': Lucide.Circle,
  'camera.fill': Lucide.Camera,
  'camera': Lucide.Camera,
  'photo': Lucide.Image,
  'image': Lucide.Image,
  'xmark.circle.fill': Lucide.XCircle,
  'cancel': Lucide.XCircle,
  'close': Lucide.X,
  'questionmark.circle.fill': Lucide.HelpCircle,
  'help': Lucide.HelpCircle,
  'magnifyingglass.circle.fill': Lucide.Search,
  'arrow.down.doc.fill': Lucide.FileDown,
  'backup': Lucide.FileDown,
  'chart.bar.xaxis': Lucide.BarChart3,
  'reports': Lucide.BarChart3,
  'lock.fill': Lucide.Lock,
  'lock': Lucide.Lock,
  'chevron.right': Lucide.ChevronRight,
  'chevron_right': Lucide.ChevronRight,
  'sun.max.fill': Lucide.Sun,
  'sun': Lucide.Sun,
  'moon.fill': Lucide.Moon,
  'moon': Lucide.Moon,
  'iphone.circle': Lucide.Smartphone,
  'system': Lucide.Smartphone,
  'arrow.clockwise': Lucide.RotateCw,
  'clock.fill': Lucide.Clock,
  'time': Lucide.Clock,
  'printer.fill': Lucide.Printer,
  'print': Lucide.Printer,
  'doc.text': Lucide.FileText,
  'exclamationmark.triangle.fill': Lucide.AlertTriangle,
  'warning': Lucide.AlertTriangle,
  'indianrupeesign.circle.fill': Lucide.Coins,
  'indianrupeesign.circle': Lucide.IndianRupee,
  'rupee': Lucide.Coins,
  'payment': Lucide.Coins,
  'slider.horizontal.3': Lucide.SlidersHorizontal,
  'filter_list': Lucide.SlidersHorizontal,
  'filter': Lucide.Filter,
};

export interface SymbolViewProps extends ViewProps {
  name: any;
  fallback?: React.ReactNode;
  type?: 'monochrome' | 'hierarchical' | 'palette' | 'multicolor';
  scale?: 'default' | 'unspecified' | 'small' | 'medium' | 'large';
  weight?: 'unspecified' | 'ultraLight' | 'thin' | 'light' | 'regular' | 'medium' | 'semibold' | 'bold' | 'heavy' | 'black';
  colors?: ColorValue | ColorValue[];
  size?: number;
  tintColor?: ColorValue;
  resizeMode?: any;
  animationSpec?: any;
}

export function SymbolView({
  name,
  size = 24,
  tintColor,
  style,
  fallback,
  ...props
}: SymbolViewProps) {
  let resolvedName = '';
  if (typeof name === 'string') {
    resolvedName = name;
  } else if (name && typeof name === 'object') {
    if (Platform.OS === 'ios') {
      resolvedName = name.ios;
    } else if (Platform.OS === 'android') {
      resolvedName = name.android || name.ios;
    } else {
      resolvedName = name.web || name.android || name.ios;
    }
  }

  if (Platform.OS === 'ios' && NativeSymbolView) {
    return (
      <NativeSymbolView
        name={resolvedName}
        size={size}
        tintColor={tintColor}
        style={style}
        {...props}
      />
    );
  }

  // Fallback to Lucide React Native for Android and Web
  const LucideIcon = lucideMap[resolvedName] || Lucide.HelpCircle;
  return <LucideIcon size={size} color={tintColor as string} style={style} {...props} />;
}
