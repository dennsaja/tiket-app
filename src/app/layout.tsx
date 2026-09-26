import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: "%s | HelpDesk",
    default: "HelpDesk — Support Ticketing System",
  },
  description:
    "Professional help desk and ticketing system for managing customer support requests.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('helpdesk-theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();
            (function(){
              if(typeof window !== 'undefined'){
                window.addEventListener('error', function(e){
                  var msg = (e && e.message) ? e.message : '';
                  if(msg.indexOf('Loading chunk') !== -1 || msg.indexOf('ChunkLoadError') !== -1 || msg.indexOf('Failed to fetch dynamically imported module') !== -1){
                    var key = 'chunk_reload_' + window.location.pathname;
                    var last = sessionStorage.getItem(key);
                    var now = Date.now();
                    if(!last || (now - parseInt(last, 10) > 10000)){
                      sessionStorage.setItem(key, String(now));
                      window.location.reload();
                    }
                  }
                }, true);
              }
            })();`,
          }}
        />
        <SessionProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: "#fff",
                color: "#111827",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                fontSize: "13px",
                padding: "10px 14px",
                boxShadow:
                  "0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)",
              },
              success: {
                iconTheme: { primary: "#16a34a", secondary: "#fff" },
              },
              error: {
                iconTheme: { primary: "#dc2626", secondary: "#fff" },
              },
            }}
          />
        </SessionProvider>
      </body>
    </html>
  );
}
