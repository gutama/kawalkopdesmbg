import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { SessionProvider } from '@/components/session-provider';
import { AppHeader } from '@/components/app-header';

const jakartaSans = Plus_Jakarta_Sans({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'KawalKopdesMBG — Transparansi Pangan Desa untuk Makan Bergizi Gratis',
  description:
    'Platform pemantauan gotong royong dan transparansi rantai pasok Koperasi Desa ke dapur SPPG dalam program Makan Bergizi Gratis (MBG).',
  openGraph: {
    title: 'KawalKopdesMBG — Transparansi Pangan Desa untuk Makan Bergizi Gratis',
    description:
      'Platform pemantauan gotong royong dan transparansi rantai pasok Koperasi Desa ke dapur SPPG dalam program Makan Bergizi Gratis (MBG).',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KawalKopdesMBG — Transparansi Pangan Desa untuk Makan Bergizi Gratis',
    description:
      'Platform pemantauan gotong royong dan transparansi rantai pasok Koperasi Desa ke dapur SPPG dalam program Makan Bergizi Gratis (MBG).',
  },
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
      className={`${jakartaSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-stone-50 text-stone-900 font-sans"
      >
        <SessionProvider>
          <AppHeader />
          <div className="flex-1 flex flex-col">{children}</div>
        </SessionProvider>
      </body>
    </html>
  );
}
