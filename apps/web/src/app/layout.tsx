import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Video Meetings',
  description: 'Video meetings web client',
};

// HeroUI switches its dark tokens by the `dark` class, not by the media query.
// Runs before paint so the page never flashes the light theme.
const colorSchemeScript = `(() => {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => document.documentElement.classList.toggle('dark', media.matches);
  apply();
  media.addEventListener('change', apply);
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: colorSchemeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
