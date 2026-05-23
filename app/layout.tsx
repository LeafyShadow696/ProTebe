import type {Metadata} from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || 'https://fkdev.xyz'),
  title: {
    default: 'Srdce pro Michaelku',
    template: '%s | Srdce pro Michaelku',
  },
  description: 'Soukromá romantická PWA pro společné vzpomínky, vzkazy, místa a AI básně.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Srdce pro Michaelku',
  appleWebApp: {
    capable: true,
    title: 'Srdce',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      {url: '/icons/icon.svg', type: 'image/svg+xml'},
    ],
    apple: [
      {url: '/icons/apple-touch-icon.svg', type: 'image/svg+xml'},
    ],
  },
  openGraph: {
    title: 'Srdce pro Michaelku',
    description: 'Soukromá romantická PWA pro společné vzpomínky, vzkazy, místa a AI básně.',
    type: 'website',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#FF2D55',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="cs">
      <body suppressHydrationWarning>
        {children}
        <Script id="register-service-worker" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator && window.isSecureContext) {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').catch(() => {});
              });
            }
          `}
        </Script>
      </body>
    </html>
  );
}
