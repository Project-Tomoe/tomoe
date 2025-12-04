import { Context, type Env } from "../context";
import type { ParamsObject } from "../types/inference";
import { RadixTree } from "./radix";

export type Handler<
  E extends Env = Env,
  P extends Record<string, string> = Record<string, never>,
> = (c: Context<E, P>) => Response | Promise<Response>;

export type Middleware<E extends Env = any> = (
  c: Context<E>,
  next: () => Promise<Response>,
) => Promise<Response>;

export type HTTPMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

type AnyMiddleware = Middleware<any>;

const mwIdMap = new WeakMap<AnyMiddleware, string>();
let mwCounter = 0;

const getMwId = (fn: Middleware): string => {
  let id = mwIdMap.get(fn);

  if (!id) {
    id = `mw_${mwCounter++}`;
    mwIdMap.set(fn, id);
  }

  return id;
};

export class Router<E extends Env = Env> {
  /**
   * The Engine: Your RadixTree
   * It now holds the FINAL optimized functions, not raw handlers.
   */
  #tree: RadixTree;

  /**
   * Staging Area: Raw Middlewares
   * We store them here until compile time.
   */
  #middlewares: Array<{ path: string; handler: Middleware }>;

  /**
   * Staging Area: Raw Routes
   * We store them here until compile time.
   */
  #routes: Array<{ method: HTTPMethod; path: string; handler: Handler }>;

  /**
   * The Cache: Shared Chains
   * Key: "mw_1|mw_5" (Unique ID String)
   * Value: The optimized Runner function
   */
  #chainCache: Map<string, (c: Context, final: Handler) => any>;

  /**
   * Compilation State Flag
   */
  #isCompiled = false;

  #env: E;

  constructor(env: E = {} as E) {
    this.#tree = new RadixTree();
    this.#middlewares = [];
    this.#routes = [];
    this.#chainCache = new Map();
    this.#env = env;

    ["GET", "POST", "PUT", "DELETE", "PATCH"].forEach((m) => {
      const method = m as HTTPMethod;
      // @ts-ignore
      (this as any)[method.toLowerCase()] = <Path extends string>(
        path: Path,
        handler: Handler<E, ParamsObject<Path>>,
      ) => {
        this.#routes.push({ method, path, handler: handler as any });
        return this;
      };
    });
  }

  declare get: <Path extends string>(
    path: Path,
    handler: Handler<E, ParamsObject<Path>>,
  ) => this;
  declare post: <Path extends string>(
    path: Path,
    handler: Handler<E, ParamsObject<Path>>,
  ) => this;
  declare put: <Path extends string>(
    path: Path,
    handler: Handler<E, ParamsObject<Path>>,
  ) => this;
  declare delete: <Path extends string>(
    path: Path,
    handler: Handler<E, ParamsObject<Path>>,
  ) => this;
  declare patch: <Path extends string>(
    path: string,
    handler: Handler<E, ParamsObject<Path>>,
  ) => this;

  use(handler: Middleware<E>): this;
  use(path: string, handler: Middleware<E>): this;
  use(arg1: string | Middleware<E>, arg2?: Middleware<E>): Router<E> {
    let path = "*";
    let handler: Middleware<E>;

    if (typeof arg1 === "string") {
      path = arg1;

      if (!arg2) {
        throw new Error("Middleware must provided when a path is specified. ");
      }

      handler = arg2;
    } else {
      handler = arg1;
    }

    this.#middlewares.push({ path, handler });
    return this;
  }

  /**
   * Compiles the Staging Arrays into the RadixTree.
   * This runs ONCE at startup.
   */
  compile() {
    if (this.#isCompiled) return;

    console.log(`🌸 Tomoe: Compiling ${this.#routes.length} routes...`);

    for (const route of this.#routes) {
      const stack = this.#findStack(route.path);

      if (stack.length === 0) {
        this.#tree.insert(route.method, route.path, route.handler as any);
        continue;
      }

      const signature = stack.map(getMwId).join("|");

      let runner = this.#chainCache.get(signature);

      if (!runner) {
        runner = this.#createRunner(stack);
        this.#chainCache.set(signature, runner);
      }

      const optimizedHandler = (c: Context) => {
        return runner(c, route.handler);
      };

      this.#tree.insert(route.method, route.path, optimizedHandler);
    }

    this.#isCompiled = true;
  }

  /**
   * The Entry Point.
   * Accessing 'app.fetch' automatically triggers compilation.
   */
  get fetch() {
    if (!this.#isCompiled) {
      this.compile();
    }
    return this.#dispatch.bind(this);
  }

  /**
   * The actual runtime dispatcher.
   */
  async #dispatch(request: Request, env?: any, ctx?: any): Promise<Response> {
    const url = new URL(request.url);

    // 1. Radix Tree Lookup (Fast)
    const match = this.#tree.match(request.method, url.pathname);

    if (!match) {
      return new Response("Not Found", { status: 404 });
    }

    const context = new Context(request, match.params, env || this.#env);

    try {
      return match.handler(context);
    } catch (err) {
      console.error(err);
      return new Response(
        JSON.stringify({
          error: "Internal Server Error",
          message: err instanceof Error ? err.message : String(err),
        }),
        {
          status: 500,
        },
      );
    }
  }

  /**
   * Helper: Filters middleware array for a given path
   */
  #findStack(routePath: string): Middleware[] {
    return this.#middlewares
      .filter((m) => {
        if (m.path === "*" || m.path === "/*") return true;
        const prefix = m.path.replace(/\*$/, "");
        return (
          routePath === prefix ||
          routePath.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`)
        );
      })
      .map((m) => m.handler);
  }

  /**
   * Helper: Factory that creates the "Shared Chain" runner
   */
  #createRunner(stack: Middleware[]) {
    return (ctx: Context, finalHandler: Handler) => {
      let index = -1;

      const dispatch = (i: number): any => {
        if (i <= index) throw new Error("next() called multiple times");
        index = i;

        // End of stack? Run the user's route handler
        if (i === stack.length) {
          return finalHandler(ctx);
        }

        const mw = stack[i];
        if (!mw) {
          throw new Error(`Middleware at index ${i} is undefined`);
        }
        return mw(ctx, () => dispatch(i + 1));
      };

      return dispatch(0);
    };
  }

  // Debugging tools
  getRoutes() {
    return this.#tree.getRoutes();
  }
  getStats() {
    return this.#tree.getStats();
  }
}
