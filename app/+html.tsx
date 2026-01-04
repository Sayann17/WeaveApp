import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * This file is web-only and used to configure the root HTML for every
 * web page during static rendering.
 * The contents of this function only run in Node.js environments and
 * do not have access to the DOM or browser APIs.
 */
export default function Root({ children }: PropsWithChildren) {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta httpEquiv="X-UA-Compatible" content="IE=edge" />

                {/* 
          CRITICAL: Viewport settings for Telegram Mini Apps 
          Prevent zooming and ensure proper scaling on all devices.
        */}
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
                />

                {/* 
          Disable body scrolling on web to behave like a native app. 
          The actual scrolling should happen within ScrollViews.
        */}
                <ScrollViewStyleReset />

                {/* Universal background color optimization */}
                <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
            </head>
            <body>{children}</body>
        </html>
    );
}

const responsiveBackground = `
body {
  background-color: #fff;
}
@media (prefers-color-scheme: dark) {
  body {
    background-color: #000;
  }
}
`;
