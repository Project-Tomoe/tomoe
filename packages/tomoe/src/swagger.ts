import type { Router } from "./router/router";

/**
 * Convert Zod schema AST to JSON Schema.
 */
function zodToJsonSchema(schema: any, visited: Set<any>): any {
  if (!schema || typeof schema !== "object") return {};

  const def = schema._def;
  if (!def) return {};

  const typeName = def.typeName;

  switch (typeName) {
    case "ZodString":
      return { type: "string" };
    case "ZodNumber":
      return { type: "number" };
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodDate":
      return { type: "string", format: "date-time" };
    case "ZodNull":
      return { type: "null" };
    case "ZodEnum":
      return { type: "string", enum: def.values };
    case "ZodOptional":
      return schemaToJsonSchema(def.innerType, visited);
    case "ZodNullable":
      return { ...schemaToJsonSchema(def.innerType, visited), nullable: true };
    case "ZodArray":
      return {
        type: "array",
        items: schemaToJsonSchema(def.type, visited),
      };
    case "ZodObject": {
      const properties: any = {};
      const required: string[] = [];
      const shape = def.shape();

      for (const [key, value] of Object.entries(shape)) {
        properties[key] = schemaToJsonSchema(value, visited);
        
        let isOptional = false;
        let current = value as any;
        while (current && current._def) {
          if (current._def.typeName === "ZodOptional") {
            isOptional = true;
            break;
          }
          current = current._def.innerType;
        }
        if (!isOptional) {
          required.push(key);
        }
      }

      const res: any = { type: "object", properties };
      if (required.length > 0) {
        res.required = required;
      }
      return res;
    }
    case "ZodUnion":
      return {
        anyOf: def.options.map((opt: any) => schemaToJsonSchema(opt, visited)),
      };
    case "ZodEffects":
      return schemaToJsonSchema(def.schema, visited);
    case "ZodLazy":
      try {
        return schemaToJsonSchema(def.getter(), visited);
      } catch {
        return { type: "object" };
      }
    default:
      if (def.innerType) {
        return schemaToJsonSchema(def.innerType, visited);
      }
      return { type: "string" };
  }
}

/**
 * Convert Valibot schema structure to JSON Schema.
 */
function valibotToJsonSchema(schema: any, visited: Set<any>): any {
  if (!schema || typeof schema !== "object") return {};
  
  const type = schema.type;
  switch (type) {
    case "string":
      return { type: "string" };
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "null":
      return { type: "null" };
    case "array":
      return {
        type: "array",
        items: schemaToJsonSchema(schema.item || schema.wrapped, visited),
      };
    case "object": {
      const properties: any = {};
      const required: string[] = [];
      const entries = schema.entries || {};
      for (const [key, val] of Object.entries(entries)) {
        properties[key] = schemaToJsonSchema(val, visited);
        
        let isOptional = false;
        let current = val as any;
        while (current && current.type) {
          if (current.type === "optional" || current.type === "nullish") {
            isOptional = true;
            break;
          }
          current = current.wrapped;
        }
        if (!isOptional) {
          required.push(key);
        }
      }
      const res: any = { type: "object", properties };
      if (required.length > 0) {
        res.required = required;
      }
      return res;
    }
    case "optional":
    case "nullable":
    case "nullish":
      return schemaToJsonSchema(schema.wrapped, visited);
    default:
      if (schema.wrapped) {
        return schemaToJsonSchema(schema.wrapped, visited);
      }
      return { type: "string" };
  }
}

/**
 * Convert any validator schema (TypeBox, Zod, Valibot) to JSON Schema.
 */
export function schemaToJsonSchema(schema: any, visited: Set<any> = new Set()): any {
  if (!schema || typeof schema !== "object") return {};

  if (visited.has(schema)) {
    return { type: "object", description: "Circular reference" };
  }
  visited.add(schema);

  try {
    // 1. TypeBox (already formatted JSON schema)
    if (
      "type" in schema ||
      "properties" in schema ||
      Symbol.for("TypeBox.Kind") in schema
    ) {
      return JSON.parse(JSON.stringify(schema));
    }

    // 2. Zod
    if (schema._def && typeof schema._def === "object" && typeof schema._def.typeName === "string") {
      return zodToJsonSchema(schema, visited);
    }

    // 3. Valibot
    if (schema.type && (schema.entries || schema.wrapped)) {
      return valibotToJsonSchema(schema, visited);
    }

    // Fallback
    return { type: "object" };
  } finally {
    visited.delete(schema);
  }
}

export interface SwaggerOptions {
  path?: string;
  specPath?: string;
  title?: string;
  version?: string;
  description?: string;
}

/**
 * Generate standard OpenAPI 3.0.0 documentation from Tomoe router metadata.
 */
export function generateOpenApiDoc(routes: any[], options: SwaggerOptions = {}): any {
  const docsPath = options.path || "/docs";
  const specPath = options.specPath || "/swagger.json";

  const doc = {
    openapi: "3.0.0",
    info: {
      title: options.title || "Tomoe API Docs",
      version: options.version || "1.0.0",
      description: options.description || "Auto-generated OpenAPI Documentation for TomoeJS",
    },
    paths: {} as any,
  };

  for (const route of routes) {
    // Skip documenting Swagger endpoints
    if (route.path === docsPath || route.path === specPath) {
      continue;
    }

    const openApiPath = route.path
      .replace(/:([a-zA-Z0-9_]+)/g, "{$1}")
      .replace(/\*/g, "{wildcard}");

    if (!doc.paths[openApiPath]) {
      doc.paths[openApiPath] = {};
    }

    const methodLower = route.method.toLowerCase();
    const relics = route.relics || [];
    const bodyRelic = relics.find((r: any) => r._kind === "providing" && r.name === "body");
    const queryRelic = relics.find((r: any) => r._kind === "providing" && r.name === "query");
    const paramsRelic = relics.find((r: any) => r._kind === "providing" && r.name === "params");
    const headersRelic = relics.find((r: any) => r._kind === "providing" && r.name === "headers");

    const operation: any = {
      summary: route.options?.summary || `${route.method} ${route.path}`,
      description: route.options?.description,
      tags: route.options?.tags,
      deprecated: route.options?.deprecated,
      parameters: [] as any[],
      responses: {
        "200": {
          description: "Successful response",
        },
        "400": {
          description: "Validation Failed / Bad Request",
        },
        "500": {
          description: "Internal Server Error",
        },
      },
    };

    if (bodyRelic && bodyRelic.schema) {
      operation.requestBody = {
        required: true,
        content: {
          "application/json": {
            schema: schemaToJsonSchema(bodyRelic.schema),
          },
        },
      };
    }

    if (queryRelic && queryRelic.schema) {
      const qSchema = schemaToJsonSchema(queryRelic.schema);
      if (qSchema.properties) {
        for (const [name, prop] of Object.entries(qSchema.properties)) {
          const isRequired = qSchema.required?.includes(name) || false;
          operation.parameters.push({
            name,
            in: "query",
            required: isRequired,
            schema: prop,
          });
        }
      }
    }

    if (paramsRelic && paramsRelic.schema) {
      const pSchema = schemaToJsonSchema(paramsRelic.schema);
      if (pSchema.properties) {
        for (const [name, prop] of Object.entries(pSchema.properties)) {
          operation.parameters.push({
            name,
            in: "path",
            required: true,
            schema: prop,
          });
        }
      }
    } else {
      const matches = route.path.match(/:([a-zA-Z0-9_]+)/g);
      if (matches) {
        for (const match of matches) {
          const name = match.slice(1);
          if (!operation.parameters.some((p: any) => p.name === name && p.in === "path")) {
            operation.parameters.push({
              name,
              in: "path",
              required: true,
              schema: { type: "string" },
            });
          }
        }
      }
      if (route.path.includes("*")) {
        operation.parameters.push({
          name: "wildcard",
          in: "path",
          required: true,
          schema: { type: "string" },
        });
      }
    }

    if (headersRelic && headersRelic.schema) {
      const hSchema = schemaToJsonSchema(headersRelic.schema);
      if (hSchema.properties) {
        for (const [name, prop] of Object.entries(hSchema.properties)) {
          const isRequired = hSchema.required?.includes(name) || false;
          operation.parameters.push({
            name,
            in: "header",
            required: isRequired,
            schema: prop,
          });
        }
      }
    }

    doc.paths[openApiPath][methodLower] = operation;
  }

  return doc;
}

/**
 * Registers Swagger UI and OpenAPI documentation endpoints on the Tomoe application.
 */
export function swagger(app: Router<any, any>, options: SwaggerOptions = {}) {
  const docsPath = options.path || "/docs";
  const specPath = options.specPath || "/swagger.json";

  app.get(specPath as any, (ctx) => {
    // Generate doc on request to ensure it captures all registered routes
    const routes = app._routes;
    const doc = generateOpenApiDoc(routes, options);
    return ctx.json(doc);
  });

  app.get(docsPath as any, (ctx) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${options.title || "Tomoe API Docs"}</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui.css" crossorigin="anonymous" />
  <style>
    html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin:0; background: #fafafa; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-bundle.js" crossorigin="anonymous"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '${specPath}',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>`;
    return ctx.html(html);
  });
}
