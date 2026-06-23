/**
 * Minimal JSON-Schema -> Zod converter.
 *
 * Tools are declared as plain JSON Schema in tools.ts (easy to read, test, and
 * advertise). The MCP SDK's `server.tool()` requires a Zod raw shape, so we
 * convert at registration time. Encoding constraints (enum / min / max /
 * minItems / maxItems) here means the SDK validates tool inputs for free before
 * a handler ever runs — no hand-rolled guards needed.
 *
 * Only the subset of JSON Schema used by Wildberries tools is supported
 * (string / number / integer / boolean / array / nested object).
 */
import { z, type ZodTypeAny } from "zod";

type JsonProp = Record<string, unknown>;

export function jsonPropToZod(prop: JsonProp): ZodTypeAny {
  const type = prop["type"] as string | undefined;
  const description = prop["description"] as string | undefined;
  let zodType: ZodTypeAny;

  switch (type) {
    case "string": {
      const enumVals = prop["enum"] as string[] | undefined;
      zodType =
        enumVals && enumVals.length > 0
          ? z.enum(enumVals as [string, ...string[]])
          : z.string();
      break;
    }
    case "number":
    case "integer": {
      let n = type === "integer" ? z.number().int() : z.number();
      if (typeof prop["minimum"] === "number") n = n.min(prop["minimum"] as number);
      if (typeof prop["maximum"] === "number") n = n.max(prop["maximum"] as number);
      zodType = n;
      break;
    }
    case "boolean":
      zodType = z.boolean();
      break;
    case "array": {
      const items = prop["items"] as JsonProp | undefined;
      let arr = z.array(items ? jsonPropToZod(items) : z.unknown());
      if (typeof prop["minItems"] === "number") arr = arr.min(prop["minItems"] as number);
      if (typeof prop["maxItems"] === "number") arr = arr.max(prop["maxItems"] as number);
      zodType = arr;
      break;
    }
    case "object": {
      const props = prop["properties"] as Record<string, JsonProp> | undefined;
      const required = (prop["required"] as string[] | undefined) ?? [];
      const shape: Record<string, ZodTypeAny> = {};
      if (props) {
        for (const [k, v] of Object.entries(props)) {
          const zt = jsonPropToZod(v);
          shape[k] = required.includes(k) ? zt : zt.optional();
        }
      }
      zodType = z.object(shape);
      break;
    }
    default:
      zodType = z.unknown();
  }

  return description ? zodType.describe(description) : zodType;
}

export interface JsonObjectSchema {
  readonly properties?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly required?: readonly string[];
}

/** Convert a tool's top-level object inputSchema to a Zod raw shape. */
export function toolSchemaToZodShape(inputSchema: JsonObjectSchema): Record<string, ZodTypeAny> {
  const shape: Record<string, ZodTypeAny> = {};
  const required = inputSchema.required ?? [];
  if (!inputSchema.properties) return shape;
  for (const [name, propDef] of Object.entries(inputSchema.properties)) {
    const zt = jsonPropToZod(propDef);
    shape[name] = required.includes(name) ? zt : zt.optional();
  }
  return shape;
}
