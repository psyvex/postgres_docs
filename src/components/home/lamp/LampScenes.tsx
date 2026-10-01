/**
 * The scenes the wall lamps light (see `WallLamp`'s `focus`): three pieces of real Postgres machinery,
 * each a self-contained loop. Pure markup — every movement is a CSS keyframe in `globals.css` under
 * `.lamp-focus`, paused while the lamp is off — so they render on the server and cost nothing until
 * the light finds them. Decorative: the lamp hides them from assistive tech, and each restates only
 * what its section already says in text. Keys, LSNs and timings are illustrative, not measured.
 */

const mono = { fontFamily: 'var(--font-code), ui-monospace, monospace' };

/**
 * A B-tree page split. Key 25 falls into the full leaf [10 20 30]; the leaf overflows, splits into
 * [10 20] and [30], 25 moves up into the root, the new edge draws, and a lookup for 30 walks down it.
 */
export function BTreeSplit() {
  return (
    <svg width="260" height="190" viewBox="0 0 260 190" className="bt overflow-visible" style={mono}>
      {/* edges: root → leaves; the third draws itself after the split */}
      <path d="M138 40 L56 120" className="stroke-line" strokeWidth="2" />
      <path d="M156 40 L216 120" className="stroke-line" strokeWidth="2" />
      <path className="bt-edge stroke-[var(--lamp-c)]" d="M122 40 L132 120" strokeWidth="2" pathLength={1} strokeDasharray="1" />

      {/* root: [40] widens to [25 40] */}
      <rect className="bt-root-a fill-surface stroke-[var(--lamp-c)]" x="128" y="14" width="36" height="26" rx="6" strokeWidth="1.5" />
      <rect className="bt-root-b fill-surface stroke-[var(--lamp-c)]" x="104" y="14" width="60" height="26" rx="6" strokeWidth="1.5" />
      <text x="146" y="32" textAnchor="middle" fontSize="12" className="fill-text">40</text>
      <text className="bt-up fill-[var(--lamp-c)]" x="122" y="32" textAnchor="middle" fontSize="12" fontWeight="700">25</text>

      {/* the full leaf, before the split */}
      <g className="bt-leaf">
        <rect x="6" y="120" width="100" height="26" rx="6" className="fill-surface stroke-line" strokeWidth="1.5" />
        <text x="56" y="138" textAnchor="middle" fontSize="12" className="fill-text">10 20 30</text>
      </g>
      {/* after the split */}
      <g className="bt-left">
        <rect x="6" y="120" width="70" height="26" rx="6" className="fill-surface stroke-line" strokeWidth="1.5" />
        <text x="41" y="138" textAnchor="middle" fontSize="12" className="fill-text">10 20</text>
      </g>
      <g className="bt-right">
        <rect className="bt-hit fill-surface stroke-line" x="106" y="120" width="52" height="26" rx="6" strokeWidth="1.5" />
        <text x="132" y="138" textAnchor="middle" fontSize="12" className="fill-text">30</text>
      </g>
      <g>
        <rect x="180" y="120" width="72" height="26" rx="6" className="fill-surface stroke-line" strokeWidth="1.5" />
        <text x="216" y="138" textAnchor="middle" fontSize="12" className="fill-text">50 60</text>
      </g>

      {/* the falling key */}
      <g className="bt-key">
        <rect x="40" y="-30" width="32" height="22" rx="5" className="fill-[var(--lamp-c)]" />
        <text x="56" y="-15" textAnchor="middle" fontSize="12" fontWeight="700" className="fill-bg">25</text>
      </g>

      {/* the lookup: a probe walks root → new leaf */}
      <circle className="bt-probe fill-[var(--lamp-c)]" cx="134" cy="27" r="5" />

      <text className="bt-cap-a fill-bad" x="56" y="172" textAnchor="middle" fontSize="10">page full · split</text>
      <text className="bt-cap-b fill-muted" x="130" y="172" textAnchor="middle" fontSize="10">WHERE id = 30 → Index Scan</text>
    </svg>
  );
}

/**
 * Row-level security holding: an attacker's SELECT flies at the shielded rows, the policy ripples,
 * the query shatters, the error glitches in, and the rows report nothing leaked.
 */
export function RlsHeist() {
  return (
    <svg width="270" height="190" viewBox="0 0 270 190" className="overflow-visible" style={mono}>
      {/* the rows */}
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} className="rh-row fill-[var(--lamp-c)]" x="182" y={64 + i * 16} width="60" height="10" rx="3" style={{ animationDelay: `${i * 0.08}s` }} />
      ))}
      {/* the policy shield: a rotating dashed dome, and the ripple it throws on impact */}
      <circle className="rh-shield fill-none stroke-[var(--lamp-c)]" cx="212" cy="92" r="52" strokeWidth="2" strokeDasharray="6 7" />
      <circle className="rh-ripple fill-none stroke-[var(--lamp-c)]" cx="212" cy="92" r="52" strokeWidth="3" />
      <text x="212" y="166" textAnchor="middle" fontSize="9" className="fill-muted">USING (org = current_org())</text>

      {/* the attack */}
      <g className="rh-packet">
        <rect x="8" y="80" width="78" height="24" rx="6" className="fill-code-bg stroke-bad" strokeWidth="1.5" />
        <text x="47" y="96" textAnchor="middle" fontSize="10" className="fill-code-text">SELECT *</text>
      </g>
      {/* shards it breaks into */}
      {[
        [-30, -40, -120],
        [-44, 6, 80],
        [-24, 38, -60],
        [-60, -14, 150],
        [-12, -58, 40],
        [-50, 30, -170],
      ].map(([dx, dy, r], i) => (
        <rect
          key={i}
          className="rh-shard fill-bad"
          x="152"
          y="88"
          width={6 + (i % 3) * 3}
          height={4 + (i % 2) * 3}
          style={{ '--dx': `${dx}px`, '--dy': `${dy}px`, '--r': `${r}deg` } as React.CSSProperties}
        />
      ))}
      <text className="rh-err fill-bad" x="8" y="40" fontSize="10.5" fontWeight="700">ERROR: row-level security</text>
      <text className="rh-ok fill-good" x="8" y="140" fontSize="10.5" fontWeight="600">→ 0 rows leaked</text>
    </svg>
  );
}

/**
 * Streaming replication: WAL segments stream from the primary to the replica along the pipe, the
 * replica's disk fills as it replays, and the LSN counts up in hex (an `@counter-style`, no JS).
 */
export function WalStream() {
  const pipe = 'M58 70 C 110 10, 160 130, 212 70';
  return (
    <div className="relative h-[170px] w-[270px]" style={mono}>
      <svg width="270" height="170" viewBox="0 0 270 170" className="absolute inset-0 overflow-visible">
        <path d={pipe} className="fill-none stroke-line" strokeWidth="10" strokeLinecap="round" />
        <path d={pipe} className="ws-flow fill-none stroke-[var(--lamp-c)]" strokeWidth="2" strokeDasharray="4 10" />
        {/* primary and replica: two disks */}
        {[30, 240].map((cx, i) => (
          <g key={cx}>
            <rect x={cx - 26} y="52" width="52" height="64" className="fill-surface stroke-line" strokeWidth="1.5" />
            <ellipse cx={cx} cy="116" rx="26" ry="8" className="fill-surface stroke-line" strokeWidth="1.5" />
            {i === 1 && <rect className="ws-fill fill-[var(--lamp-c)]" x={cx - 25} y="53" width="50" height="62" opacity="0.35" />}
            <ellipse cx={cx} cy="52" rx="26" ry="8" className="fill-surface stroke-line" strokeWidth="1.5" />
            <text x={cx} y="140" textAnchor="middle" fontSize="10" className="fill-muted">{i ? 'replica' : 'primary'}</text>
          </g>
        ))}
        <circle className="ws-beat fill-good" cx="30" cy="38" r="4" />
      </svg>
      {/* WAL segments riding the pipe (offset-path), staggered */}
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="ws-seg absolute left-0 top-0 h-3 w-5 rounded-sm" style={{ offsetPath: `path('${pipe}')`, animationDelay: `${i * -0.5}s` }} />
      ))}
      <div className="absolute inset-x-0 bottom-0 flex justify-between text-[10px] text-muted">
        <span>
          LSN 0/3A<span className="ws-lsn text-text" />
        </span>
        <span>lag 0 ms</span>
      </div>
    </div>
  );
}
