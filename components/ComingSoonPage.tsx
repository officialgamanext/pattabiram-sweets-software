import Link from 'next/link';

interface ComingSoonPageProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}

export default function ComingSoonPage({ title, description, icon, color, bg }: ComingSoonPageProps) {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-116px)] p-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-md"
          style={{ background: bg, color }}>
          {icon}
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
          style={{ background: bg, color }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color }} />
          Coming Soon
        </div>

        <h1 className="text-2xl font-bold text-slate-800 mb-2">{title}</h1>
        <p className="text-slate-500 text-sm leading-relaxed mb-6">{description}</p>

        <div className="bg-slate-100 rounded-full h-1.5 overflow-hidden mb-1.5">
          <div className="h-full rounded-full" style={{ width: '65%', background: color }} />
        </div>
        <p className="text-xs text-slate-400">65% complete — launching soon</p>

        <Link href="/"
          className="inline-flex items-center gap-1.5 mt-6 text-sm font-semibold transition-colors"
          style={{ color }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
