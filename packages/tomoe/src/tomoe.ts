/**
 * Tomoe - Main application class
 *
 * Tomoe is the full application class. Router is the internal routing primitive.
 * As the API grows, Tomoe will gain higher-level features (graph inspection,
 * plugin system, etc.) while Router stays focused on routing mechanics.
 */

import type { Env } from "./context"
import { Router } from "./router/router"

export class Tomoe<E extends Env = Env> extends Router<E> {
  /**
   * Inspect the full dependency graph of all registered scopes.
   * Useful for testing and auditing route configurations.
   *
   * @example
   * const graph = app.graph()
   * expect(graph.routes).toHaveLength(5)
   *
   * // Coming in next iteration:
   * // graph.inspect('/admin/dashboard')
   * // graph.validate()
   * // graph.dot()  ← Graphviz output
   */
  graph() {
    return {
      routes: this.getRoutes(),
      stats: this.getStats(),
    }
  }
}

export { Router }
export type { Handler, Middleware, HTTPMethod } from "./router/router"