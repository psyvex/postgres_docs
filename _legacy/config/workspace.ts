export const workspaceCopy = {
  explorer: 'Database explorer',
  workspace: 'Workspace',
  results: 'Results',
  messages: 'Messages',
  queryReady: 'Ready to execute',
  noResults: 'Run a query to see results here.',
  noSelection: 'Select a database object to inspect it.',
} as const;

export const workspacePanels = [
  { id: 'explorer', label: workspaceCopy.explorer, defaultSize: 240, minSize: 190 },
  { id: 'workspace', label: workspaceCopy.workspace, defaultSize: 1, minSize: 420 },
  { id: 'results', label: workspaceCopy.results, defaultSize: 320, minSize: 240 },
] as const;
