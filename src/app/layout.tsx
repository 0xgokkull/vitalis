import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Figtree } from 'next/font/google';
import './globals.css';
import { Ambient } from '@/components/Ambient';

const bricolage = Bricolage_Grotesque({ variable: '--font-bricolage', subsets: ['latin'] });
const figtree = Figtree({ variable: '--font-figtree', subsets: ['latin'] });

const description =
  'Vitalis turns your Fitbit band data into one 24-hour view of your sleep, heart and movement, with a coach that answers from your own numbers.';

// Absolute base for share images: the configured URL, else Vercel's production domain.
const siteUrl =
  process.env.NEXTAUTH_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Vitalis', template: '%s · Vitalis' },
  description,
  applicationName: 'Vitalis',
  keywords: ['Vitalis', 'Fitbit', 'sleep tracking', 'heart rate', 'HRV', 'health dashboard', 'Google Health'],
  appleWebApp: { capable: true, title: 'Vitalis', statusBarStyle: 'default' },
  openGraph: {
    type: 'website',
    siteName: 'Vitalis',
    title: 'Vitalis: your sleep, heart and movement around the clock',
    description,
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vitalis: your sleep, heart and movement around the clock',
    description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#eef1f5' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1424' },
  ],
};

// Runs before paint so the saved theme applies without a flash.
const themeScript = `(function(){try{var t=localStorage.getItem('theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${figtree.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen">
        <Ambient />
        {children}
      </body>
    </html>
  );
}
