import "./globals.css";

export const metadata = {
  title: "Class Voice | Teacher Ratings",
  description: "Student teacher rating and voting system",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
