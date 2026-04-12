import type { Metadata } from "next";
// import localFont from "next/font/local";
import "./globals.css";
import { poppins } from './fonts';

const siteUrl = 'https://www.aisheeter.com';

export const metadata: Metadata = {
  title: {
    default: 'AISheeter – Smarter Google Sheets with AI',
    template: '%s | AISheeter',
  },
  description:
    'The only Google Sheets AI with multi-step workflows, conversation memory, and output control. No formulas. No copy-paste. Just results.',
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: 'AISheeter – Smarter Google Sheets with AI',
    description:
      'Multi-step AI workflows, conversation memory, and 10 specialized skills – all inside Google Sheets.',
    url: siteUrl,
    siteName: 'AISheeter',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AISheeter – Smarter Google Sheets with AI',
    description:
      'Multi-step AI workflows, conversation memory, and 10 specialized skills – all inside Google Sheets.',
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={poppins.className}>

      <body>{children}</body>
    </html>
  )
}
