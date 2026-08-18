import "@gravityinnovations/firsthand-recorder/styles.css";
import "./globals.css";

export const metadata = {
  title: "Firsthand Next.js Test",
  description: "Next.js integration test for the Firsthand recorder"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
