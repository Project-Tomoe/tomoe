<p align="center">
  <img src="https://i.postimg.cc/SR7yvcj9/226421950.png" width="180" alt="Tomoe Logo"/>
</p>

<h1 align="center">Tomoe</h1>
<p align="center"><strong>The art of perfect balance</strong></p>

---

Tomoe is a lightweight backend framework built on **Web Standard APIs**, designed to bring clarity and performance together through a clean and predictable architecture.

- 🌿 Minimal and expressive  
- ⚡ High performance by design  and Type-Safe
- 🧩 Middleware-oriented  
- 🌐 Built on Web Standards — currently compatible with **Bun**, with more runtimes planned  

Tomoe focuses on delivering a smooth development experience while keeping the internals efficient and optimized.

---

## 📦 Installation (Bun)

```bash
bun init project-name
bun add tomoejs
```

```typescript
import { Tomoe } from "tomoejs";

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


// This created optimized runner for different routes and add it to radix tree. (Here happens the magic of optimization)

// Note: If you don't run app.compile(), it will auto compile once after receiving first request.
app.compile();


// This runs tomoe app on port 3000
export default app;
```

## Different Port
```typescript 
//if you want to run on different port
export default {
  port: 4000,
  fetch: (req: Request) => app.fetch(req),
};
```

## Routing

```typescript

app.get("/anime", handler);
app.post("/anime", handler);
app.get("/anime/:name", handler);
```

## Middleware 
```typescript 
app.use("*", logger);        // 1. Global middleware
app.use("/anime/*", layerA); // 2. Matches /anime and everything inside it
app.use("/anime", layerB);   // 3. Runs only for the exact /anime path
```