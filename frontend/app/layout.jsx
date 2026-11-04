import "./globals.css";

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
  return <html lang="en"><body>{children}</body></html>;
}
