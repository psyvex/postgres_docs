export type TriggerChainStatus = 'idle' | 'running' | 'complete' | 'failed';

export type TriggerChainState = {
  status: TriggerChainStatus;
  activeStep: number;
  durationMs?: number;
  error?: string;
};

export const triggerChainStepIds = ['event', 'trigger', 'function', 'result'] as const;

export function createTriggerChainState(status: TriggerChainStatus = 'idle'): TriggerChainState {
  return { status, activeStep: status === 'idle' ? -1 : 0 };
}
