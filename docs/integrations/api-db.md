# Database API — `/api/db/query`

Runs arbitrary SQL against a PostgreSQL database. **Use with caution:** this route executes whatever it is given.

## Base URL

```
POST https://your-deployment.example/api/db/query
```

---

## Authentication

The route has two modes, controlled by server environment variables.

### Local mode (default)

Only connections to `localhost`, `127.0.0.1`, `::1`, and `host.docker.internal` are allowed. No token required.

```
ALLOW_REMOTE_DB=   # not set, or anything other than "true"
```

### Remote mode

```bash
ALLOW_REMOTE_DB=true
DB_QUERY_TOKEN=<your-secret-token>
```

Remote mode lets any caller reach any host, so it is gated behind a shared secret. Every request to a non-local host must carry the token in the `x-db-token` header. Localhost connections work without the token even in remote mode, so the operator is never locked out of their own machine.

---

## Endpoints

### `GET /api/db/query`

Returns the gate configuration. Use this before prompting the user for a server token.

**Response** `200 OK`

```json
{
  "remoteAllowed": false,
  "tokenRequired": false,
  "tokenConfigured": false
}
```

| Field | Type | Description |
|---|---|---|
| `remoteAllowed` | boolean | Whether `ALLOW_REMOTE_DB=true` is set |
| `tokenRequired` | boolean | Whether a token is required (always `true` when remote is allowed) |
| `tokenConfigured` | boolean | Whether `DB_QUERY_TOKEN` is set on the server |

---

### `POST /api/db/query`

Executes SQL. Each request gets a fresh connection; `SET ROLE` and `search_path` are reset after every run.

**Request headers**

| Header | Required | Description |
|---|---|---|
| `Content-Type` | always | `application/json` |
| `x-db-token` | remote hosts only | The `DB_QUERY_TOKEN` value |

**Request body**

```json
{
  "connection": {
    "host": "localhost",
    "port": 5432,
    "database": "mydb",
    "user": "postgres",
    "password": "secret",
    "ssl": false
  },
  "sql": "SELECT 1 AS hello;"
}
```

All fields in `connection` are required. `password` may be an empty string. `ssl` is `true` to use TLS.

**Response** `200 OK`

```json
{
  "ok": true,
  "results": [
    {
      "columns": ["hello"],
      "rows": [{ "hello": 1 }],
      "rowCount": 1
    }
  ],
  "durationMs": 12
}
```

The `results` array holds one entry per statement executed after the session prefix (`SET search_path = lab, public;`). A single `SELECT` returns one entry.

**Error responses**

| Status | Condition | Example body |
|---|---|---|
| `400` | Missing fields or empty SQL | `{"ok":false,"error":"Host, database and user are required.","durationMs":0}` |
| `413` | SQL exceeds 100,000 characters | `{"ok":false,"error":"SQL exceeds the maximum size.","durationMs":0}` |
| `403` | Remote host without token | `{"ok":false,"error":"This server requires a database token. Paste the DB_QUERY_TOKEN value into the \"Server token\" field.","durationMs":0}` |
| `403` | Token mismatch | `{"ok":false,"error":"This server requires a database token. Paste the DB_QUERY_TOKEN value into the \"Server token\" field.","durationMs":0}` |
| `200` | SQL error (runtime) | `{"ok":false,"error":"relation \"nonexistent\" does not exist","code":"42P01","detail":"...","hint":"...","durationMs":4}` |

Runtime errors return `ok: false` with a `200` status — the SQL ran, Postgres answered with an error. Status codes `400`, `403`, and `413` indicate a request problem before any database call.

---

## Examples

### curl

```bash
# Local connection (no token)
curl -X POST https://your-deployment.example/api/db/query \
  -H "Content-Type: application/json" \
  -d '{"connection":{"host":"localhost","port":5432,"database":"mydb","user":"postgres","password":""},"sql":"SELECT 1;"}'

# Remote connection (token required)
curl -X POST https://your-deployment.example/api/db/query \
  -H "Content-Type: application/json" \
  -H "x-db-token: your-secret-token" \
  -d '{"connection":{"host":"db.example.com","port":5432,"database":"mydb","user":"postgres","password":"secret"},"sql":"SELECT 1;"}'
```

### Python — FastAPI

```python
import httpx

BASE_URL = "https://your-deployment.example"

def query_db(sql: str, host: str = "localhost", *, port: int = 5432,
             database: str = "mydb", user: str = "postgres",
             password: str = "", ssl: bool = False, token: str | None = None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["x-db-token"] = token

    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        response = client.post(
            "/api/db/query",
            json={
                "connection": {
                    "host": host,
                    "port": port,
                    "database": database,
                    "user": user,
                    "password": password,
                    "ssl": ssl,
                },
                "sql": sql,
            },
            headers=headers,
        )
        response.raise_for_status()
        return response.json()

# Usage
result = query_db("SELECT 1 AS hello;")
if result["ok"]:
    for stmt in result["results"]:
        print(stmt["rows"])
else:
    print(f"Error: {result['error']}")
```

### Node.js — TypeScript

```typescript
const BASE_URL = "https://your-deployment.example";

interface LiveConnection {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
}

interface QueryResult {
  ok: boolean;
  results?: { columns: string[]; rows: Record<string, unknown>[]; rowCount: number | null }[];
  error?: string;
  code?: string;
  detail?: string;
  hint?: string;
  durationMs: number;
}

async function queryDb(
  sql: string,
  connection: LiveConnection,
  token?: string,
): Promise<QueryResult> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["x-db-token"] = token;

  const response = await fetch(`${BASE_URL}/api/db/query`, {
    method: "POST",
    headers,
    body: JSON.stringify({ connection, sql }),
  });

  return response.json() as Promise<QueryResult>;
}

// Usage
const result = await queryDb(
  "SELECT 1 AS hello;",
  { host: "localhost", port: 5432, database: "mydb", user: "postgres", password: "", ssl: false },
);
if (result.ok) {
  for (const stmt of result.results!) {
    console.log(stmt.rows);
  }
} else {
  console.error(`Error: ${result.error}`);
}
```

---

## Connection pooling notes

Each request opens a new `pg` connection, runs the SQL, and closes it. The session starts with:

```sql
SET search_path = lab, public;
```

On completion (success or error), `RESET ROLE` and `RESET ALL` are issued before the connection closes. There is no connection reuse between requests. For high-throughput integrations, consider:

- **Direct connection**: bypass this API and connect to Postgres directly from your application. This API is designed for browser-based playground use.
- **PgBouncer**: place this API behind a PgBouncer pool in `transaction` mode. The connection is closed between requests, which is compatible with transaction-mode pooling.
- **Rate limiting**: add a reverse-proxy rate limit in front of this route. There is no built-in rate limit for SQL execution.
