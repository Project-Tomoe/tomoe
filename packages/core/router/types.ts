export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD'  | 'ALL';
export type RoutePriority = 'static' | 'param' | 'wildcard' | 'regex';

export type RouteMeta = {
  path: string;
  paramNames: string[];
  priority: RoutePriority;
  isRegexFallback?: boolean;
  originalPattern?: string;
}

export type RouteRecord<HandlerId = number> = {
  id: HandlerId;
  method: HttpMethod;
  meta: RouteMeta;
  schemaRef?: unknown;
}

export type HandlerFnId = number;

export type RouteMatch<Params extends Record<string, string> = Record<string, string>> = {
  record: RouteRecord;
  params: Params;
  consumed: number;
}

export type TokenType = 'static' | 'param' | 'wildcard' | 'regex';

export type SegmentToken =
| { type: 'static'; value: string }
| { type: 'param'; name: string; constraint?: string | null }
| { type: 'wildcard'; name?: string }
| { type: 'regex'; raw: string };


export type RouterOptions = {
  caseSensitive?: boolean;
  strictTrailingSlash?: boolean;
  decodeParams?: boolean;
  warnRegexCountThreshold?: number;
}

export type RadixNode = {
  prefix: string;
  children: Map<string, RadixNode>;
  paramChild?: { name: string; constraint?: string | null; node: RadixNode };
  wildcardChild?: { name?: string; node: RadixNode };
  handlerMap: Map<HttpMethod, RouteRecord>;
}

export interface Router {
  registerRoute(method: HttpMethod, path: string, record: RouteRecord): void;
  removeRoute?(method: HttpMethod, path: string): boolean;
  findRoute?(method: HttpMethod, path: string): RouteMatch | null;
  snapshot?(): { nodes: number; regexFallbackCount: number };
  options?: RouterOptions;
}

// export function tokenizePath(path: string, opts?: { allowRegex?: boolean }): SegmentToken[];
