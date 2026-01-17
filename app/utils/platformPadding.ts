import { EdgeInsets } from 'react-native-safe-area-context';

/**
 * Get platform-aware top padding
 * Mobile: insets.top + offset (to avoid system status bar)
 * Desktop/Web: insets.top only (no system status bar overlap)
 * 
 * @param insets - Safe area insets from useSafeAreaInsets()
 * @param isMobile - Platform flag from useTelegram()
 * @param offset - Additional offset for mobile (default: 85)
 * @returns Calculated top padding
 */
export function getPlatformPadding(
    insets: EdgeInsets,
    isMobile: boolean,
    offset: number = 85
): number {
    // For Desktop/Web, we usually don't need extra padding as the window handles it.
    // We force 0 to avoid "Padding 92" issues mentioned by the user.
    return isMobile ? insets.top + offset : 0;
}

/**
 * Get platform-aware padding object
 * Useful for style objects that need multiple padding values
 */
export function getPlatformPaddingStyle(
    insets: EdgeInsets,
    isMobile: boolean,
    offset: number = 85
) {
    return {
        paddingTop: getPlatformPadding(insets, isMobile, offset),
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
    };
}
