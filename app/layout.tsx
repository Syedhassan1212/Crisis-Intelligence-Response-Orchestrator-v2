import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'CIRO — Crisis Intelligence & Response Orchestrator',
  description: 'Real-time AI-powered smart city emergency command system fusing Google Maps, Weather, and social media signals.',
  keywords: 'crisis management, emergency response, AI, smart city, disaster intelligence',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={`${inter.variable} font-sans antialiased bg-[#090c10] text-[#f0f6fc] grid-background relative min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
