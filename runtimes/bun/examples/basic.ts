/**
 * Basic Bun server example
 */

import { Tomoe } from "tomoe";
import { serve } from "../src";

const app = new Tomoe();

app.get("/tomoe", (c) => {
  return c.html("<h1>Hello, Tomoe!</h1>");
});

app.get("/heroes/:name", (c) => {
  return c.html(`<h1> Your Fav Hero: ${c.param("name")}`);
});

const server = serve(app, {
  port: 5000,
  development: true,
});

process.on("SIGINT", () => {
  console.log("shutting down...");
  server.stop();
  process.exit(0);
});
