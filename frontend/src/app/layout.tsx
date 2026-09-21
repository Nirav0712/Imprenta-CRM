import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '../context/ThemeContext';
import { AppShell } from '../components/layout/AppShell';

export const metadata: Metadata = {
  title: 'AutoMarket — Marketing Automation OS',
  description: 'Enterprise Marketing Automation OS with WhatsApp, Email Hub, and Unified CRM',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full font-sans antialiased overflow-hidden">
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
