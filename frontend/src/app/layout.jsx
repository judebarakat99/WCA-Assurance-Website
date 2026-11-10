import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow/700.css";
import "@fontsource/barlow/800.css";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/components.css";
import Header from "@/components/organisms/Header";
import LegacyScripts from "@/legacy/LegacyScripts";
import { themeInitScript } from "@/lib/theme.mjs";

export const metadata = {
  title: "Compliance Assurance Suite",
  description: "FIFA World Cup 2034 assurance demo",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2e3569" },
    { media: "(prefers-color-scheme: dark)", color: "#15183a" },
  ],
};

export default function RootLayout({ children }) {
  return (
    // data-theme is set before hydration by themeInitScript.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Header />
        {children}
        {/* Hidden target for the simulated-clock writer; not shown in the header. */}
        <b id="today" hidden></b>
        <div id="drawerRoot"></div>
        <div id="toastRoot"></div>
        <div id="tourRoot"></div>
        <div id="aiRoot"></div>
        <LegacyScripts />
      </body>
    </html>
  );
}
