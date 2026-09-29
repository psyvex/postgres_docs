import { Icon } from '@/components/icons';

/** Inline yes/no markers for comparison tables in lessons. */
export function Yes({ children }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-good">
      <Icon name="ok" size={17} /> {children ?? 'Yes'}
    </span>
  );
}

export function No({ children }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-bad">
      <Icon name="fail" size={17} /> {children ?? 'No'}
    </span>
  );
}
