import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GrowEasy CRM — AI CSV Importer',
  description:
    'Upload any CSV from Facebook Leads, Google Ads, or Excel — our AI intelligently maps your data into GrowEasy CRM format instantly.',
  keywords: 'CRM, CSV importer, AI, leads, GrowEasy, lead management',
  authors: [{ name: 'GrowEasy' }],
  openGraph: {
    title: 'GrowEasy CRM — AI CSV Importer',
    description: 'AI-powered CSV importer that maps any CSV to CRM fields automatically.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  );
}
