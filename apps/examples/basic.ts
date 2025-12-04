import { Tomoe } from "tomoe";

const app = new Tomoe();

// Health check
app.get("/health", (c) => {
  return c.text("Server is working...");
});

// Global logger
app.use("*", async (c, next) => {
  console.log(`[${c.req.method}] ${c.req.url}`);
  return next();
});

// Scoped middleware for anime routes
app.use("/anime/*", async (c, next) => {
  console.log("Anime middleware triggered.");
  return next();
});

// Anime list
app.get("/anime", (c) => {
  return c.json({
    titles: [
      "Fullmetal Alchemist: Brotherhood",
      "Attack on Titan",
      "Jujutsu Kaisen",
      "Demon Slayer",
    ],
  });
});

// Anime details
app.get("/anime/:name", (c) => {
  const name = c.param("name");
  return c.json({ title: name });
});

// Color route
app.get("/:color", (c) => {
  const color = c.param("color");
  return c.html(`
    <style>
      body {
        display: flex;
        justify-content: center;
        align-items: center;
      }
      h1 {
        color: ${color};
        font-size: 90px;
        font-family: sans-serif;
      }
    </style>
    <h1>${color}</h1>
  `);
});

// Home
app.get("/", (c) => {
  return c.html("<h1>Welcome to Tomoe</h1>");
});

// JSON response example
app.get("/tomoe", (c) => {
  return c.json({
    message: "Hello from Tomoe",
    status: "OK",
  });
});

const PORT = 3000;

app.compile();

export default {
  port: 3000,
  fetch: (req: Request) => app.fetch(req),
};