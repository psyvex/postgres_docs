import { buildCallFunctionSql, buildCreateFunctionSql, type FunctionDraft } from '@/lib/function-sql';

export type FunctionExecutionRequest = {
  connection: { host: string; port: number; database: string; username: string; password: string; sslMode: string };
  draft: FunctionDraft;
  values: string[];
};

export function buildFunctionExecutionSql(draft: FunctionDraft, values: string[]) {
  return { createSql: buildCreateFunctionSql(draft), callSql: buildCallFunctionSql(draft, values) };
}
