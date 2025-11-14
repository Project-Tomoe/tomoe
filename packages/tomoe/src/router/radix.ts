/**
 *
 * Radix Tree Router
 *
 * Implements optimized Radix tree for HTTP route matching
 *
 * Features:
 *  - O(k) lookup where k = segment count
 *  - Static route fast path: O(1) hash map
 *  - Dynamic parameter extraction (:heroName)
 *  - Wildcard support (*)
 *  - Priority: Static > Dynamic > Wildcard
 */

import { RadixNode, type InternalHandler } from "./node";

/**
 * Match result from Radix tree lookup
 */

type MatchResult = {
  handler: InternalHandler;
  params: Record<string, string>;
};

/**
 * RadixTree class
 *
 * Core router implemetation using Radix Tree
 */

export class RadixTree {
  /**
   * Root node of the tree
   * Empty segment, acts as entrypoint (segment = "")
   */

  #root: RadixNode;

  /**
   * Static route cache (for faster lookups O(1))
   *
   * Key: `Method:Path` e.g. `GET:/anime`
   * Value: InternalHandler function
   *
   * note: only stores routes with no dynamic segments
   */

  #staticRoutes: Map<string, InternalHandler>;

  constructor() {
    this.#root = new RadixNode();
    this.#staticRoutes = new Map();
  } /**
   * Split path into segements
   * e.g. "/iskekai/moonlit-fanatasy" -> ["isekai", "moonlit-fantasy"]
   *
   * @param path - route path
   * @returns array of segments
   */
  #splitPath(path: string): string[] {
    return path.split("/").filter((segment) => segment !== "");
  }

  /**
   * Insert route into tree
   *
   * @param method - HTTP Method (GET, POST, PUT, etc)
   * @param path - Route Path ("/heroes")
   * @param handler - InternalHandler Function
   */
  insert(method: string, path: string, handler: InternalHandler) {
    //TODO: decode param (for Unicode URL)
    const segments = this.#splitPath(path);
    const methodAsUpper = method.toUpperCase();

    const isStatic = !path.includes(":") && !path.includes("*");

    if (isStatic) {
      const key = `${methodAsUpper}:${path}`;
      this.#staticRoutes.set(key, handler);
    }

    let node = this.#root;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      if (segment?.startsWith(":")) {
        const paramName = segment.slice(1);

        if (!node.paramChild) {
          node.paramChild = new RadixNode(segment);
          node.paramChild.paramName = paramName;
        } else if (node.paramChild.paramName !== paramName) {
          console.warn(
            `Parameter name conflict at ${path}: ` +
              `existing "${node.paramChild.paramName}", new ${paramName} Using existing`,
          );
        }

        node = node.paramChild;
      } else if (segment?.startsWith("*")) {
        if (!node.wildcardChild) {
          node.wildcardChild = new RadixNode(segment);
        }

        node = node.wildcardChild;
      } else {
        let child = node.getChild(segment as string);

        if (!child) {
          child = new RadixNode(segment);
          node.addChild(segment as string, child);
        }

        node = child;
      }
    }

    if (node.hasHandler(methodAsUpper)) {
      console.warn(`Route already registered ${method} ${path}. Overwriting.`);
    }

    node.addHandler(methodAsUpper, handler);
  }

  /**
   * Find matching route for Request
   *
   * @param method - HTTP Methods (GET, POST, PUT, etc)
   * @param path - Request Path ("/anime")
   * @returns Match result or null
   */
  match(method: string, path: string): MatchResult | null {
    const methodAsUpper = method.toUpperCase();
    const staticKey = `${methodAsUpper}:${path}`;
    const staticHandler = this.#staticRoutes.get(staticKey);

    if (staticHandler) {
      return {
        handler: staticHandler,
        params: {},
      };
    }

    const segments = this.#splitPath(path);
    const params: Record<string, string> = {};

    let node = this.#root;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const remainingSegments = segments.length - i;

      if (node.hasChildren()) {
        const child = node.getChild(segment as string);

        if (child) {
          node = child;
          continue;
        }
      }

      if (node.paramChild && remainingSegments === 1) {
        const paramName = node.paramChild.paramName;
        if (paramName) {
          params[paramName] = segment as string;
          node = node.paramChild;
          continue;
        }
      }

      if (node.wildcardChild) {
        const remainingPath = segments.slice(i).join("/");
        params["*"] = remainingPath;

        node = node.wildcardChild;
        break;
      }

      if (node.paramChild) {
        const paramName = node.paramChild.paramName;
        if (paramName) {
          params[paramName] = segment as string;
          node = node.paramChild;
          continue;
        }
      }

      return null;
    }

    const handler = node.getHandler(methodAsUpper);

    if (!handler) {
      return null;
    }

    return { handler, params };
  }

  /**
   * Get all registered routes (for debugging)
   *
   * @returns Array of routes info
   */

  getRoutes(): Array<{ method: string; path: string }> {
    const routes: Array<{ method: string; path: string }> = [];
    const traverse = (node: RadixNode, pathParts: string[]) => {
      const path = `/${pathParts.join("/")}`;

      if (node.handlers) {
        for (const method of node.handlers.keys()) {
          routes.push({ method, path: path || "/" });
        }
      }

      for (const [segment, child] of node.children) {
        traverse(child, [...pathParts, segment]);
      }

      if (node.paramChild) {
        traverse(node.paramChild, [...pathParts, node.paramChild.segment]);
      }

      if (node.wildcardChild) {
        traverse(node.wildcardChild, [...pathParts, "*"]);
      }
    };

    traverse(this.#root, []);
    return routes;
  }

  /**
   * Get tree statistics (for profiling)
   */

  getStats(): {
    nodeCount: number;
    staticRouteCount: number;
    maxDepth: number;
  } {
    let nodeCount = 0;
    let maxDepth = 0;

    const traverse = (node: RadixNode, depth: number) => {
      nodeCount++;
      maxDepth = Math.max(depth, maxDepth);

      for (const child of node.children.values()) {
        traverse(child, depth + 1);
      }

      if (node.paramChild) traverse(node.paramChild, depth + 1);
      if (node.wildcardChild) traverse(node.wildcardChild, depth + 1);
    };

    traverse(this.#root, 0);

    return {
      nodeCount,
      staticRouteCount: this.#staticRoutes.size,
      maxDepth,
    };
  }
}
