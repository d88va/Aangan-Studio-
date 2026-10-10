export const metadata = { title: "Aangan Calls", description: "AI call agent results" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fafaf8", color: "#1a1a1a" }}>{children}</body>
    </html>
  );
}
