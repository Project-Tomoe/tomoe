/**
 * Bun adapter test
 */

import type { Server } from "bun";
import { describe, it, expect, afterEach } from "bun:test";
import { serve, stop } from "../src";
import { Tomoe } from "tomoe";

describe("Serve", () => {
  let server: Server<undefined> | null = null;

  afterEach(() => {
    if (server) {
      stop(server);
    }
  });

  it("should start server and handle request", async () => {
    const app = new Tomoe();
    app.get("/tomoe", (c) => c.text("Hello, Tomoe!"));

    server = serve(app, { port: 6000 });

    await Bun.sleep(100);

    const response = await fetch("http://localhost:6000/tomoe");
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toBe("Hello, Tomoe!");
  });

  it("should handle JSON responses", async () => {
    const app = new Tomoe();
    app.get("/json", (c) => c.json({ message: "Code Geass" }));

    server = serve(app, { port: 3002 });
    await Bun.sleep(100);

    const response = await fetch("http://localhost:3002/json");
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.message).toBe("Code Geass");
  });

  it("should handle route parameters", async () => {
    const app = new Tomoe();
    app.get("/anime/:name", (c) => c.json({ id: c.param("name") }));

    server = serve(app, { port: 3003 });
    await Bun.sleep(100);

    const response = await fetch("http://localhost:3003/anime/MyHeroAcademia");
    const json = await response.json();

    expect(json.id).toBe("MyHeroAcademia");
  });

  it("should handle POST with body", async () => {
    const app = new Tomoe();
    app.post("/resonate", async (c) => {
      const body = await c.req.json();
      return c.json({ echo: body });
    });

    server = serve(app, { port: 3004 });
    await Bun.sleep(100);

    const response = await fetch("http://localhost:3004/resonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "I am Weeb!" }),
    });

    const json = await response.json();
    expect(json.echo.message).toBe("I am Weeb!");
  });
});
