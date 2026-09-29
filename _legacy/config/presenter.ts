export const presenterConfig = {
  modes: [
    { id: 'guided', label: 'Guided', description: 'Reveal one database step at a time.' },
    { id: 'live', label: 'Live', description: 'Let the execution animation run automatically.' },
  ],
  shortcuts: { next: 'ArrowRight', previous: 'ArrowLeft', play: 'Space', reset: 'r' },
  revealLabels: ['SQL', 'Role', 'RLS', 'Rows', 'Result'],
} as const;
