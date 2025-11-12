/**
 *
 * Radix Tree Comprehensive Test Suite
 *
 * Test covers:
 *  - Basic Insertion and Matching
 *  - Static Routes
 *  - Dynamic Parameters (":anime")
 *  - Wildcards ("*")
 *  - Priority (static > param > wildcard)
 *  - Edge cases (conflicting params, trailing slashes, etc)
 *  - Performance
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { RadixTree } from "../../../src/router/radix";
import type { InternalHandler } from "../../../src/router/node";

describe("RadixTree", () => {
  let tree: RadixTree;

  // Mock handlers for testing purposes.
  const h1: InternalHandler = () => new Response("h1");
  const h2: InternalHandler = () => new Response("h2");
  const h3: InternalHandler = () => new Response("h3");
  const h4: InternalHandler = () => new Response("h4");

  beforeEach(() => {
    tree = new RadixTree();
  });

  /** Basic Insertion */
  describe("Insertion", () => {
    it("should insert root route '/'", () => {
      tree.insert("GET", "/", h1);

      const match = tree.match("GET", "/");

      expect(match).not.toBeNull();
      expect(match?.handler).toBe(h1);
      expect(match?.params).toStrictEqual({});
    });

    it("should insert single segment route '/heroes'", () => {
      tree.insert("GET", "/heroes", h1);
      const match = tree.match("GET", "/heroes");

      expect(match).not.toBeNull();
      expect(match?.handler).toBe(h1);
      expect(match?.params).toStrictEqual({});
    });

    it("should insert multi segment route '/anime/moonlit-fantasy'", () => {
      tree.insert("GET", "/anime/moonlit-fantasy", h1);
      const match = tree.match("GET", "/anime/moonlit-fantasy");

      expect(match).not.toBeNull();
      expect(match?.handler).toBe(h1);
      expect(match?.params).toStrictEqual({});
    });

    it("should insert multiple routes with shared prefix", () => {
      tree.insert("GET", "/anime/death-note", h1);
      tree.insert("GET", "/anime/one-piece", h2);
      tree.insert("GET", "/anime/naruto", h3);

      expect(tree.match("GET", "/anime/death-note")?.handler).toBe(h1);
      expect(tree.match("GET", "/anime/one-piece")?.handler).toBe(h2);
      expect(tree.match("GET", "/anime/naruto")?.handler).toBe(h3);
    });

    it("should insert routes with different methods on same path", () => {
      tree.insert("GET", "/anime", h1);
      tree.insert("PUT", "/anime", h2);
      tree.insert("POST", "/anime", h3);
      tree.insert("DELETE", "/anime", h4);

      expect(tree.match("GET", "/anime")?.handler).toBe(h1);
      expect(tree.match("PUT", "/anime")?.handler).toBe(h2);
      expect(tree.match("POST", "/anime")?.handler).toBe(h3);
      expect(tree.match("DELETE", "/anime")?.handler).toBe(h4);
    });

    it("should warn overwriting existing route", () => {
      const conSpy = vi.spyOn(console, "warn").mockImplementation();
      tree.insert("GET", "/anime", h1);
      tree.insert("GET", "/anime", h2);

      expect(conSpy).toHaveBeenCalledWith(
        expect.stringContaining("Route already registered"),
      );

      expect(tree.match("GET", "/anime")?.handler).toBe(h2);

      conSpy.mockRestore();
    });
  });

  /** Static Routes */
  describe("Static Routes", () => {
    it("should match static route with trailing slashes", () => {
      tree.insert("GET", "/anime", h1);

      expect(tree.match("GET", "/anime")).not.toBeNull();
      expect(tree.match("GET", "/anime")?.handler).toBe(h1);
      expect(tree.match("GET", "/anime/")).not.toBeNull();
      expect(tree.match("GET", "/anime/")?.handler).toBe(h1);
    });

    it("should match static route with multiple segments", () => {
      tree.insert("GET", "/api/v1/anime", h1);
      const match = tree.match("GET", "/api/v1/anime");

      expect(match?.handler).toBe(h1);
    });

    it("should not match partial path", () => {
      tree.insert("GET", "/api/v1/anime", h1);

      expect(tree.match("GET", "/api/v1/anime")).not.toBeNull();
      expect(tree.match("GET", "/api/v1")).toBeNull();
      expect(tree.match("GET", "/api/v1/anime/naruto")).toBeNull();
    });

    it("should handle empty path", () => {
      tree.insert("GET", "/anime", h1);

      expect(tree.match("GET", "/anime")).not.toBeNull();
      expect(tree.match("GET", "")).toBeNull();
    });

    it("should cache static routes for O(1) lookup", () => {
      tree.insert("GET", "/anime", h1);
      tree.insert("GET", "/manga", h2);

      const stats = tree.getStats();

      expect(stats.staticRouteCount).toBe(2);
    });
  });

  describe("Route with Params (Dynamic Parameters", () => {
    it("should match route with single parameter", () => {
      tree.insert("GET", "/anime/:name", h1);
      const match = tree.match("GET", "/anime/ReLife");

      expect(match).not.toBeNull();
      expect(match?.handler).toBe(h1);
      expect(match?.params).toStrictEqual({ name: "ReLife" });
    });

    it("should match route with multiple parameters", () => {
      tree.insert("GET", "/anime/:name/character/:characterName", h1);
      const match = tree.match("GET", "/anime/death-note/character/kira");

      expect(match).not.toBeNull();
      expect(match?.handler).toBe(h1);
      expect(match?.params).toStrictEqual({
        name: "death-note",
        characterName: "kira",
      });
    });

    it("should extract parameter with special characters except '*' ", () => {
      tree.insert("GET", "/anime/:download", h1);
      const match = tree.match("GET", "/anime/bleach_ep1.mp4");

      expect(match).not.toBeNull();
      expect(match?.handler).toBe(h1);
      expect(match?.params).toStrictEqual({ download: "bleach_ep1.mp4" });
    });

    it("should extract paramter with numbers", () => {
      tree.insert("GET", "/users/:id", h1);
      const match = tree.match("GET", "/users/10");

      expect(match).not.toBeNull();
      expect(match?.handler).toBe(h1);
    });

    it("should should not match if position has no value", () => {
      tree.insert("GET", "/anime/:name/characters", h1);

      expect(tree.match("GET", "/anime//characters")).toBeNull();
      expect(tree.match("GET", "/anime/characters")).toBeNull();
    });

    it("should handle adjacent parameters", () => {
      tree.insert("GET", "/:anime/:character", h1);

      const match = tree.match("GET", "/moonlit-fantasy/tomoe");

      expect(match).not.toBeNull();
      expect(match?.handler).toBe(h1);
      expect(match?.params).toStrictEqual({
        anime: "moonlit-fantasy",
        character: "tomoe",
      });
    });

    it("should extract paramter at start", () => {
      tree.insert("GET", "/:anime", h1);
      const match = tree.match("GET", "/KaijuNo.8");

      expect(match).not.toBeNull();
      expect(match?.handler).toBe(h1);
      expect(match?.params).toStrictEqual({ anime: "KaijuNo.8" });
    });

    it("should handle parameter at end", () => {
      tree.insert("GET", "/bleach/:characterName", h1);

      const match = tree.match("GET", "/bleach/Rukia_Kuchiki");

      expect(match).not.toBeNull();
      expect(match?.handler).toBe(h1);
      expect(match?.params).toStrictEqual({ characterName: "Rukia_Kuchiki" });
    });

    it("should warn for conflicting parameter names", () => {
      const conSpy = vi.spyOn(console, "warn").mockImplementation();

      tree.insert("GET", "/:character", h1);
      tree.insert("GET", "/:characterName", h2);

      expect(conSpy).toHaveBeenCalledWith(
        expect.stringContaining("Parameter name conflict"),
      );

      conSpy.mockRestore();
    });
  });

  describe("Wildcards", () => {
    it("should match wildcard route", () => {
      tree.insert("GET", "/static/*", h1);

      const match = tree.match("GET", "/static/naruto.png");
      expect(match).not.toBeNull();
      expect(match?.handler).toBe(h1);
      expect(match?.params).toStrictEqual({ "*": "naruto.png" });
    });

    it("should match wildcard at root", () => {
      tree.insert("GET", "/*", h1);

      const match = tree.match("GET", "/i-am-weeb");
      expect(match).not.toBeNull();
      expect(match?.handler).toBe(h1);
      expect(match?.params).toStrictEqual({ "*": "i-am-weeb" });
    });
  });

  /**
   * PRIORITY TEST ( Static > Param > Wildcard)
   */
  describe("Priority", () => {
    it("should prioritize static over param", () => {
      tree.insert("GET", "/anime", h1);
      tree.insert("GET", "/:hero", h2);

      expect(tree.match("GET", "/anime")?.handler).toBe(h1);
      expect(tree.match("GET", "/lelouch")?.handler).toBe(h2);
    });

    it("it should prioritize static over wildcard", () => {
      tree.insert("GET", "/anime", h1);
      tree.insert("GET", "/*", h2);

      expect(tree.match("GET", "/anime")?.handler).toBe(h1);
      expect(tree.match("GET", "/i-am-weeb")?.handler).toBe(h2);
    });

    it("should prioritize param over wildcard", () => {
      tree.insert("GET", "/anime/:name", h1);
      tree.insert("GET", "/anime/*", h2);

      expect(tree.match("GET", "/anime/naruto")?.handler).toBe(h1);
      expect(tree.match("GET", "/anime/i/weeb")?.handler).toBe(h2);
    });
  });

  /**
   * EDGE CASES
   */
  describe("Edge Cases", () => {
    it("should handle trailing slash normalization", () => {
      tree.insert("GET", "/anime", h1);

      expect(tree.match("GET", "/anime")?.handler).toBe(h1);
      expect(tree.match("GET", "/anime/")?.handler).toBe(h1);
    });

    it("should handle leading slash normalization", () => {
      tree.insert("GET", "/users", h1);

      expect(tree.match("GET", "/users")).not.toBeNull();
      // Note: match() expects path WITH leading slash
    });

    it("should handle multiple consecutive slashes", () => {
      tree.insert("GET", "/users", h1);

      // Multiple slashes filtered to single segments
      expect(tree.match("GET", "//users")).not.toBeNull();
      expect(tree.match("GET", "/users//")).not.toBeNull();
    });

    it("should handle very long paths", () => {
      const longPath = "/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v/w/x/y/z";
      tree.insert("GET", longPath, h1);

      const match = tree.match("GET", longPath);
      expect(match).not.toBeNull();
    });

    it("should handle unicode in paths", () => {
      tree.insert("GET", "/users/:name", h1);

      const match = tree.match("GET", "/users/测试");
      expect(match?.params).toEqual({ name: "测试" });
    });

    it("should handle special URL characters", () => {
      tree.insert("GET", "/search/:query", h1);

      const match = tree.match("GET", "/search/hello%20world");
      expect(match?.params).toEqual({ query: "hello%20world" });
    });

    it("should return null for unmatched method", () => {
      tree.insert("GET", "/users", h1);

      expect(tree.match("POST", "/users")).toBeNull();
      expect(tree.match("PUT", "/users")).toBeNull();
      expect(tree.match("DELETE", "/users")).toBeNull();
    });

    it("should return null for non-existent path", () => {
      tree.insert("GET", "/users", h1);

      expect(tree.match("GET", "/posts")).toBeNull();
      expect(tree.match("GET", "/")).toBeNull();
      expect(tree.match("GET", "/users/123")).toBeNull();
    });

    it("should handle empty path string", () => {
      expect(tree.match("GET", "")).toBeNull();
    });

    it("should handle case-sensitive paths", () => {
      tree.insert("GET", "/Users", h1);

      expect(tree.match("GET", "/Users")).not.toBeNull();
      expect(tree.match("GET", "/users")).toBeNull(); // Different case
    });

    it("should handle case-insensitive methods", () => {
      tree.insert("get", "/users", h1); // Lowercase

      expect(tree.match("GET", "/users")).not.toBeNull();
      expect(tree.match("get", "/users")).not.toBeNull();
    });
  });

  describe("Utility Methods", () => {
    it("should return all registered routes", () => {
      tree.insert("GET", "/", h1);
      tree.insert("GET", "/anime", h2);
      tree.insert("POST", "/anime", h3);
      tree.insert("GET", "/anime/:id", h4);

      const routes = tree.getRoutes();

      expect(routes).toHaveLength(4);
      expect(routes).toEqual(
        expect.arrayContaining([
          { method: "GET", path: "/" },
          { method: "GET", path: "/anime" },
          { method: "POST", path: "/anime" },
          { method: "GET", path: "/anime/:id" },
        ]),
      );
    });

    it("should return tree statistics", () => {
      tree.insert("GET", "/anime", h1);
      tree.insert("GET", "/anime/:id", h2);
      tree.insert("GET", "/heroes", h3);
      tree.insert("POST", "/heroes", h4);

      const stats = tree.getStats();

      expect(stats.nodeCount).toBeGreaterThan(0);
      expect(stats.staticRouteCount).toBe(3);
      expect(stats.maxDepth).toBeGreaterThan(0);
    });

    it("should calculate max depth correctly", () => {
      tree.insert("GET", "/a/b/c/d/e", h1);

      const stats = tree.getStats();
      expect(stats.maxDepth).toBe(5);
    });
  });

  /**
   * Performance Test
   */
  describe("Performance", () => {
    it("should handle 100 routes efficiently", () => {
      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        tree.insert("GET", `/route${i}/:id`, h1);
      }

      const insertTime = performance.now() - start;
      expect(insertTime).toBeLessThan(50); // < 50ms for 100 routes
    });

    it("should match static routes quickly", () => {
      tree.insert("GET", "/users", h1);
      tree.insert("GET", "/posts", h2);
      tree.insert("GET", "/comments", h3);

      const iterations = 10000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        tree.match("GET", "/users");
      }

      const elapsed = performance.now() - start;
      const avgTime = (elapsed / iterations) * 1000; // Convert to µs

      // Static routes should be <1µs (O(1) lookup)
      expect(avgTime).toBeLessThan(1); // <1µs per lookup
    });

    it("should match dynamic routes quickly", () => {
      tree.insert("GET", "/users/:id/posts/:postId", h1);

      const iterations = 10000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        tree.match("GET", "/users/123/posts/456");
      }

      const elapsed = performance.now() - start;
      const avgTime = (elapsed / iterations) * 1000; // Convert to µs

      // Dynamic routes should be <5µs (O(k) where k=segments)
      expect(avgTime).toBeLessThan(5); // <5µs per lookup
    });

    it("should scale with number of routes", () => {
      // Insert 1000 routes
      for (let i = 0; i < 1000; i++) {
        tree.insert("GET", `/route${i}/:id`, h1);
      }

      // Lookup should still be fast (independent of route count)
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        tree.match("GET", "/route500/123");
      }

      const elapsed = performance.now() - start;
      const avgTime = (elapsed / 1000) * 1000; // µs per lookup

      // Should still be <10µs even with 1000 routes
      expect(avgTime).toBeLessThan(10);
    });

    it("should use minimal memory", () => {
      const initialStats = tree.getStats();

      // Insert 100 routes
      for (let i = 0; i < 100; i++) {
        tree.insert("GET", `/api/v1/resource${i}/:id`, h1);
      }

      const finalStats = tree.getStats();

      // Rough estimate: ~80 bytes per node
      const nodesCreated = finalStats.nodeCount - initialStats.nodeCount;
      const estimatedMemory = nodesCreated * 80; // bytes

      // Should be < 50KB for 100 routes
      expect(estimatedMemory).toBeLessThan(50 * 1024);
    });
  });
});
