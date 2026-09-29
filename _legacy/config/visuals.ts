export const visualConfig = {
  motion: { fastMs: 180, normalMs: 350, slowMs: 700, flowDuration: 1400, floatDuration: 4000 },
  nodes: {
    session: { label: 'Session', subLabel: 'request context' },
    policy: { label: 'RLS Policy', subLabel: 'authorization boundary' },
    database: { label: 'PostgreSQL', subLabel: 'rows & operations' },
    function: { label: 'Function', subLabel: 'database logic' },
    trigger: { label: 'Trigger', subLabel: 'database event' },
  },
  colors: { cyan: 'var(--cyan)', green: 'var(--green)', purple: 'var(--purple)', orange: 'var(--orange)', red: 'var(--red)' },
} as const;
