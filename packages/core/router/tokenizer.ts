import type { SegmentToken} from './types';

const PARAM_RE = /^:([A-Za-z0-9_]+)(?:\((.+)\))?$/;

export function tokenizePath(path: string): SegmentToken[] {
  if (path.startsWith('/')) path = '/' + path;
  path = path.replace(/\/+/g, '/');

  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);

  const parts = path.split('/').slice(1);

  const tokens: SegmentToken[] = [];

  for(const part of parts) {
    if(part === '*') {
      tokens.push({
        type: 'wildcard',
        name: undefined
      })
      continue
    }

    if(part.startsWith("*")) {
      const name = part.slice(1) || undefined;
      tokens.push({
        type: 'wildcard',
        name
      })
      continue
    }

    const m = PARAM_RE.exec(part);
    if(m){
      const name = m[1];
      const constraint = m[2] ?? null;

      tokens.push({
        type: 'param',
        name,
        constraint
      })

      continue
    }

    if (/[()\?]/.test(part)) {
      tokens.push({ type: 'regex', raw: part });
      continue
    }
    tokens.push({ type: 'static', value: part });

  }

  return tokens;
}
