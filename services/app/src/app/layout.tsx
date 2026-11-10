import type { Metadata } from "next";
import { AppProviders } from "@/components/providers/app-providers";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { PwaInstallTracker } from "@/components/pwa-install-tracker";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kontrol | Serkoi",
  description:
    "Plataforma de Gestión de ISPs Kontrol.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport = {
  themeColor: "#f59e0b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 transition-colors duration-200 antialiased">
        <AppProviders>
          <PwaInstallTracker />
          <Navbar />
          <div className="flex-1">{children}</div>
          <Footer />
        </AppProviders>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    document.addEventListener('visibilitychange', function() {
                      if (document.visibilityState === 'visible' && navigator.onLine) {
                        reg.update();
                      }
                    });
                  });

                  let refreshing = false;
                  navigator.serviceWorker.addEventListener('controllerchange', function() {
                    if (refreshing) return;
                    refreshing = true;
                    window.dispatchEvent(new CustomEvent('pwa_update_available'));
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
