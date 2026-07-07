import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import LayoutShell from '@/components/layout/LayoutShell';
import { ToastProvider } from '@/components/ui/ToastProvider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ZeroSheet Finance',
  description: 'Spreadsheet-driven finance app',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#050505',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="bg-black font-sans text-white antialiased">
        <ToastProvider>
          <LayoutShell>{children}</LayoutShell>
        </ToastProvider>
      </body>
    </html>
  );
}
