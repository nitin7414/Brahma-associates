import { ViewProps, ColorValue } from 'react-native';
import React from 'react';

declare module 'expo-symbols' {
  export interface SymbolViewProps extends ViewProps {
    name: any;
    fallback?: React.ReactNode;
    type?: 'monochrome' | 'hierarchical' | 'palette' | 'multicolor';
    scale?: 'default' | 'unspecified' | 'small' | 'medium' | 'large';
    weight?: 'unspecified' | 'ultraLight' | 'thin' | 'light' | 'regular' | 'medium' | 'semibold' | 'bold' | 'heavy' | 'black';
    colors?: ColorValue | ColorValue[];
    size?: number;
    tintColor?: ColorValue;
    resizeMode?: 'scaleToFill' | 'scaleAspectFit' | 'scaleAspectFill' | 'redraw' | 'center' | 'top' | 'bottom' | 'left' | 'right' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
    animationSpec?: any;
  }

  export function SymbolView(props: SymbolViewProps): React.JSX.Element;
}
