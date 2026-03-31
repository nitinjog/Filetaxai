import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'FileTaxAI – File Your ITR in Minutes',
    template: '%s | FileTaxAI',
  },
  description:
    'AI-powered Indian income tax filing. Upload Form 16, get instant Old vs New regime comparison, and file your ITR with confidence. Assessment Year 2024-25.',
  keywords: [
    'ITR filing',
    'income tax India',
    'Form 16',
    'old regime',
    'new regime',
    'tax computation',
    'AY 2024-25',
    'FileTaxAI',
  ],
  authors: [{ name: 'FileTaxAI' }],
  openGraph: {
    title: 'FileTaxAI – AI-Powered Indian Income Tax Filing',
    description: 'File your ITR in minutes with AI assistance. Compare Old vs New Regime instantly.',
    locale: 'en_IN',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#1e1b4b',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
