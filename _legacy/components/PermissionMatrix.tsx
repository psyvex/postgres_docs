'use client';

import { Check, LockKeyhole, X } from 'lucide-react';
import { useState } from 'react';
import { permissionMatrix, type Permission } from '@/config/permissions';
import { focusVisuals } from '@/config/focus-visuals';
import { usePresenterStore } from '@/lib/presenter-store';
import { useLabStore } from '@/lib/store';

export function PermissionMatrix() {
  const [roleId, setRoleId] = useState(permissionMatrix.roles[0]?.id ?? '');
  const role = permissionMatrix.roles.find((item) => item.id === roleId) ?? permissionMatrix.roles[0];
  const reveal = usePresenterStore((state) => state.isRevealed('role'));
  const executionStage = useLabStore((state) => state.executionStage);
  const permissions: Permission[] = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
  return <div className={`glass rounded-2xl p-5 transition-all duration-[360ms] ${reveal && executionStage === 'authorize' ? 'ring-1 ring-violet-300/40 shadow-[0_0_40px_rgba(167,139,250,.12)]' : ''}`}><div className="mb-4 flex items-center gap-2"><LockKeyhole size={15} className="text-violet-300"/><div><div className="text-sm font-semibold">Role privileges</div><div className="text-[11px] text-[var(--muted)]">{focusVisuals.role.label} · evaluated before row policies.</div></div></div><div className="mb-4 flex flex-wrap gap-2">{permissionMatrix.roles.map((item) => <button key={item.id} onClick={() => setRoleId(item.id)} className={`rounded-lg border px-3 py-2 text-[11px] ${item.id === role?.id ? 'border-violet-400/30 bg-violet-400/[.06] text-violet-200' : 'border-[var(--line)] text-slate-500'}`}>{item.label}</button>)}</div><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-xs"><thead><tr className="border-b border-[var(--line)]"><th className="px-3 py-2 text-[10px] uppercase text-slate-500">Resource</th>{permissions.map((permission) => <th key={permission} className="px-3 py-2 text-[10px] uppercase text-slate-500">{permission}</th>)}</tr></thead><tbody>{permissionMatrix.resources.map((resource) => <tr key={resource} className="border-b border-[var(--line)] last:border-0"><td className="px-3 py-3 font-mono text-slate-300">{resource}</td>{permissions.map((permission) => { const allowed = resource === 'orders' && role?.permissions.orders.includes(permission); return <td key={permission} className="px-3 py-3">{allowed ? <Check size={14} className="text-emerald-300"/> : <X size={14} className="text-slate-700"/>}</td>})}</tr>)}</tbody></table></div></div>;
}
