import "./globals.css";
import Header from "../components/Header";
import LegacyScripts from "../components/LegacyScripts";

export const metadata = {
  title: "Compliance Assurance Suite",
  description: "FIFA World Cup 2034 compliance assurance demo with sample data.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
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
