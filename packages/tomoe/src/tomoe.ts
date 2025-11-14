/**
 * Tomoe - Main class
 */

import { Router } from "./router/router";

export class Tomoe<E extends Record<string, any> = {}> extends Router<E> {
  constructor(env?: E) {
    super(env);
  }
}

export { Router };

export type { Handler, Middleware, HTTPMethod } from "./router/router";
