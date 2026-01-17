import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Based on standard iPhone 13/Pro layout width (390px)
// This serves as the reference design width
const SCALE_BASE_WIDTH = 390;

/**
 * Normalizes a size value based on the screen width.
 * Useful for adapting font sizes, margins, and extensive widths across different devices.
 * 
 * @param size - The size in the reference design (e.g., 16 for a 16px font)
 * @returns The scaled size for the current device screen
 */
export function normalize(size: number): number {
    const newSize = size * (SCREEN_WIDTH / SCALE_BASE_WIDTH);
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
}
