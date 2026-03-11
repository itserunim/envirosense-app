import "./globals.css";

export const metadata = {
  title: "EnviroSense",
  description: "Wearable Air Quality Monitor — CO₂, CO, VOC, PM2.5, Temperature & Pressure",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
