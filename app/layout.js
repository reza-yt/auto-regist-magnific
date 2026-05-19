import './globals.css';

export const metadata = {
  title: 'Magnific Auto Register - API Key Generator',
  description: 'Auto registration tool for magnific.ai with temp mail, proxy rotation, and anti-detect browser',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-white">
        {children}
      </body>
    </html>
  );
}
