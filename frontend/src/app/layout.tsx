import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '../context/ThemeContext';
import { Sidebar } from '../components/layout/Sidebar';
import { Navbar } from '../components/layout/Navbar';

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
          <div className="flex h-full w-full">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
              <Navbar />
              <main className="flex-1 overflow-y-auto p-6 flex flex-col min-h-0">
                <div className="max-w-7xl w-full mx-auto flex-1 flex flex-col min-h-0">{children}</div>
              </main>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
