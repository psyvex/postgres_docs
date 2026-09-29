'use client';

import { ExecutionStageBar } from './ExecutionStageBar';
import { RowFilterVisualizer } from './RowFilterVisualizer';
import { PermissionMatrix } from './PermissionMatrix';
import { RowCompare } from './RowCompare';
import { DatabaseGraph } from './DatabaseGraph';
import { TriggerSimulator } from './TriggerSimulator';

export function InteractiveDatabasePanel() {
  return <div className="space-y-4"><ExecutionStageBar/><div className="grid gap-4 xl:grid-cols-2"><RowFilterVisualizer/><PermissionMatrix/></div><div className="grid gap-4 xl:grid-cols-2"><RowCompare/><TriggerSimulator/></div><DatabaseGraph/></div>;
}
