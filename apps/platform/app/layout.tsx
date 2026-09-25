import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { DownloadToastProvider } from '@/components/download-toast';
import { BrandProvider } from '@/components/providers/brand-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { getBrand } from '@/lib/brand-server';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
});

// Title, description and icons follow the brand of the host (lib/brand.ts),
// so a white-labelled client never sees Unicorn in a tab or bookmark. The
// icons are declared here rather than as app/icon.png, which Next would
// serve on every host.
export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();
  return {
    title: brand.productName,
    description: brand.description,
    icons: { icon: brand.icon, apple: brand.appleIcon },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }): Promise<ReactNode> {
  const brand = await getBrand();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("gallery-theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme:dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})()`,
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
        style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif' }}
      >
        <BrandProvider brandId={brand.id}>
          <ThemeProvider>
            <DownloadToastProvider>{children}</DownloadToastProvider>
          </ThemeProvider>
        </BrandProvider>
      </body>
    </html>
  );
}
