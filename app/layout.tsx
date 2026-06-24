import './globals.css';
import type { Metadata } from 'next';
import LayoutShell from '@/components/layout/LayoutShell';
import { ToastProvider } from '@/components/ui/ToastProvider';

export const metadata: Metadata = {
  title: 'ZeroSheet Finance',
  description: 'Spreadsheet-driven finance app',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="bg-black text-white">
        <ToastProvider>
          <LayoutShell>{children}</LayoutShell>
        </ToastProvider>
      </body>
    </html>
  );
}
