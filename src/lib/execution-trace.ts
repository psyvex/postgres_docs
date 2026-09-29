export type ExecutionTraceStatus = 'idle' | 'running' | 'complete' | 'failed';

export type ExecutionTrace = {
  status: ExecutionTraceStatus;
  activeStep: number;
  durationMs?: number;
  rowCount?: number | null;
  error?: string;
};

export function createTrace(status: ExecutionTraceStatus = 'idle'): ExecutionTrace {
  return { status, activeStep: status === 'idle' ? -1 : 0 };
}
