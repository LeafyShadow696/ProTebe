import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Beru & FáFa 💞',
  description: 'Naše krásná PWA aplikace lásky',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Beru & FáFa',
  },
  manifest: '/manifest.json',
  icons: {
    apple: '/icon.png',
  },
};

export const viewport = {
  themeColor: '#F2F2F7',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
