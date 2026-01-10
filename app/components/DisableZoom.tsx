import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Component to disable pinch-zoom and double-tap zoom on mobile devices
 * This is a no-op on web as CSS handles it via global.css
 */
export function DisableZoom() {
    useEffect(() => {
        // Only run on web platform (Telegram Mini App web view)
        if (Platform.OS !== 'web') return;

        // Prevent pinch zoom
        const preventZoom = (e: TouchEvent) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        };

        // Prevent double-tap zoom
        let lastTouchEnd = 0;
        const preventDoubleTapZoom = (e: TouchEvent) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        };

        // Add event listeners
        document.addEventListener('touchstart', preventZoom, { passive: false });
        document.addEventListener('touchend', preventDoubleTapZoom, { passive: false });
        document.addEventListener('touchmove', preventZoom, { passive: false });

        // Prevent gesturestart (Safari specific)
        const preventGesture = (e: Event) => e.preventDefault();
        document.addEventListener('gesturestart', preventGesture);
        document.addEventListener('gesturechange', preventGesture);
        document.addEventListener('gestureend', preventGesture);

        return () => {
            document.removeEventListener('touchstart', preventZoom);
            document.removeEventListener('touchend', preventDoubleTapZoom);
            document.removeEventListener('touchmove', preventZoom);
            document.removeEventListener('gesturestart', preventGesture);
            document.removeEventListener('gesturechange', preventGesture);
            document.removeEventListener('gestureend', preventGesture);
        };
    }, []);

    return null;
}
