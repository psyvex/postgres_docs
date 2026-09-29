export type ScenarioRow = Record<string, unknown>;

export function rowKey(row: ScenarioRow, index: number) {
  return String(row.id ?? row.uuid ?? row.key ?? index + 1);
}

export function compareScenarioRows(candidateRows: ScenarioRow[], returnedRows: ScenarioRow[]) {
  const returned = new Set(returnedRows.map((row, index) => rowKey(row, index)));
  return candidateRows.map((row, index) => ({
    row,
    id: rowKey(row, index),
    visible: returned.has(rowKey(row, index)),
  }));
}

export function summarizeScenario(candidateRows: ScenarioRow[], returnedRows: ScenarioRow[]) {
  const compared = compareScenarioRows(candidateRows, returnedRows);
  return {
    candidate: candidateRows.length,
    returned: returnedRows.length,
    filtered: compared.filter((item) => !item.visible).length,
  };
}
