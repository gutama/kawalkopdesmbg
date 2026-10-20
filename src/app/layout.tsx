import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { SessionProvider } from '@/components/session-provider';
import { AppHeader } from '@/components/app-header';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'KawalKopdesMBG — Transparansi Pangan Desa untuk Makan Bergizi Gratis',
  description:
    'Platform pemantauan gotong royong dan transparansi rantai pasok Koperasi Desa ke dapur SPPG dalam program Makan Bergizi Gratis (MBG).',
};

/** Root application layout wrapping all pages in the demo role session and responsive header. */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-stone-50 text-stone-900">
        <SessionProvider>
          <AppHeader />
          <div className="flex-1 flex flex-col">{children}</div>
        </SessionProvider>
      </body>
    </html>
  );
}
