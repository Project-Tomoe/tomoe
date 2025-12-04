/**
 * Tomoe - Main class
 */

import type { Env } from "./context";
import { Router } from "./router/router";

export class Tomoe<E extends Env = Env> extends Router<E> {}

export { Router };

export type { Handler, Middleware, HTTPMethod } from "./router/router";
