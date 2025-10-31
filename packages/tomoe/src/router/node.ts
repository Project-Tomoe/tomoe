/**
 * RadixNode - Node in the Radix Tree
 *
 * Each represents a path segment and can have:
 *  - Static children (exact string matches)
 *  - One param child (:hero pattern)
 *  - One wildcard child (* pattern)
 *  - Handlers for different HTTP Methods (e.g. GET, POST, PUT, DELETE)
 */

export type InternalHandler<E = any, P = any> = (
  c: any,
) => Response | Promise<Response>;

// RadixNode class
export class RadixNode {
  /**
   * Path segement this node represents.
   *
   * e.g. "anime", ":heroName", "*"
   */
  segment: string;

  /**
   * HTTP method handlers at this node
   * Key: 'GET' | 'POST' | 'PUT' | 'DELETE', etc
   * Value: Handler function
   *
   * Null if this is intermediate node (not a route endpoint)
   */
  handlers: Map<string, InternalHandler> | null;

  /**
   * Static children (exact matches)
   * Key: segment string ("isekai", "heroes")
   * value: child node (RadixNode)
   */
  children: Map<string, RadixNode>;

  /**
   * Paramter child (matches any segment and captures value)
   * e.g. :heroName, :anime
   *
   * Only one param child allowed per node (precedence rule)
   */

  paramChild: RadixNode | null;

  /**
   * Wildcard child (matches remaining path)
   *
   * e.g. * in anime/*
   *
   * Only one wildcard child allowed per node (precedence rule)
   */

  wildcardChild: RadixNode | null;

  /**
   * Parameter name (if this node is paran node)
   * e.g. "heroName" for ":heroName"
   *
   * Null if this is not a param node
   */
  paramName: string | null;

  /**
   * Cache: Number of static children
   *
   * Optimization: avoids calling map.size checks in hot path
   */
  #childrenCount: number;

  constructor(segment = "") {
    this.segment = segment;
    this.handlers = null;
    this.children = new Map();
    this.paramChild = null;
    this.wildcardChild = null;
    this.paramName = null;
    this.#childrenCount = 0;
  }

  /**
   * Add static child node
   *
   * @param segement - Path segment ("anime")
   * @param, node - ChildNode
   */

  addChild(segement: string, node: RadixNode) {
    this.children.set(segement, node);
    this.#childrenCount++;
  }

  /**
   * Get static child by segment
   *
   * @param segement - Path segment to find
   * @returns child node (Radix Node) or undefined
   */

  getChild(segment: string): RadixNode | undefined {
    return this.children.get(segment);
  }

  /**
   * Check if node has static children
   */
  hasChildren(): boolean {
    return this.#childrenCount > 0;
  }

  /**
   * Add handler for HTTP Methdo
   *
   * @param method - HTTP Method (GET, PUT, POST, etc)
   * @param handler - InternalHandler Function
   *
   * Creates handlers Map lazily  (only when first handler is added)
   */

  addHandler(method: string, handler: InternalHandler) {
    if (!this.handlers) {
      this.handlers = new Map();
    }
    this.handlers.set(method, handler);
  }

  /**
   * Get handler for HTTP Method
   *
   * @param method - HTTP Method (GET, PUT, POST, etc)
   * @returns InternalHandler Function or undefined
   */

  getHandler(method: string): InternalHandler | undefined {
    return this.handlers?.get(method);
  }

  /**
   * Check if node has handler for method
   *
   * @param method - HTTP Method
   */

  hasHandler(method: string): boolean {
    return this.handlers?.has(method) ?? false;
  }
}
