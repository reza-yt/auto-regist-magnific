import './globals.css';

export const metadata = {
  title: 'Magnific Auto Register',
  description: 'Auto registration tool for magnific.ai with anti-detect browser',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
