import "./globals.css";

export const metadata = {
  title: "Tensile",
  description: "Coach and client training workspace",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
