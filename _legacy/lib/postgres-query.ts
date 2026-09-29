export type PostgresConnection = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  sslMode?: string;
};

export type QueryRequest = {
  connection: PostgresConnection;
  sql: string;
};

export function validateQueryRequest(request: QueryRequest) {
  if (!request?.connection) throw new Error('PostgreSQL connection is required.');
  if (!request.connection.host || !request.connection.database || !request.connection.username) throw new Error('Host, database and username are required.');
  if (!request.sql?.trim()) throw new Error('SQL query is required.');
  if (request.sql.length > 100_000) throw new Error('SQL query exceeds the maximum size.');
}
