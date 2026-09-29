import { DatabaseExplorer } from './DatabaseExplorer';
import { WorkspaceTabs } from '@/components/app-shell/WorkspaceTabs';
import { workspaceCopy } from '@/config/workspace';

export function WorkspaceFrame({ children }: { children: React.ReactNode }) { return <div className="flex min-h-[calc(100vh-3.5rem)] min-w-0 flex-col"><WorkspaceTabs/><div className="grid min-h-0 flex-1 lg:grid-cols-[240px_minmax(0,1fr)]"><div className="hidden min-h-0 border-r border-[var(--border)] lg:block"><DatabaseExplorer/></div><section className="min-w-0 bg-[var(--background)]"><div className="flex min-h-full flex-col"><div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3"><div className="text-xs font-semibold">{workspaceCopy.workspace}</div><div className="mt-0.5 text-[10px] text-[var(--muted)]">Interactive PostgreSQL workspace</div></div><div className="min-h-0 flex-1 p-4 lg:p-6">{children}</div></div></section></div></div>; }
