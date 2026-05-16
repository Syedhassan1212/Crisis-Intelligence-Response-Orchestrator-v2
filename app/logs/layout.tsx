import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CIRO — Agent Log Viewer',
  description: 'Full call records and reasoning traces from all CIRO AI agents and engines',
};

export default function LogsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
