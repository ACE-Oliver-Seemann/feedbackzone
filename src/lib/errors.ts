import { NextResponse, type NextRequest } from "next/server";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly details?: Record<string, string>,
  ) {
    super(code);
  }
}

export const unauthorized = () => new HttpError(401, "unauthorized");
export const forbidden = () => new HttpError(403, "forbidden");
export const notFound = () => new HttpError(404, "not_found");
export const conflict = (code: string) => new HttpError(409, code);
export const validationError = (fields: Record<string, string>) =>
  new HttpError(400, "validation_error", fields);

type Handler<C> = (request: NextRequest, context: C) => Promise<Response>;

/**
 * Wraps a route handler: maps HttpError to a JSON response and hides
 * everything else behind a 500.
 *
 * NFR-01: the log line contains only method, path and error class. Never the
 * request body and never the error message (Prisma validation errors echo
 * the data they were called with).
 */
export function route<C>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof HttpError) {
        return NextResponse.json(
          { error: error.code, ...(error.details ? { fields: error.details } : {}) },
          { status: error.status },
        );
      }
      const name = error instanceof Error ? error.constructor.name : "UnknownError";
      console.error(`[api] ${request.method} ${request.nextUrl.pathname} failed: ${name}`);
      return NextResponse.json({ error: "internal_error" }, { status: 500 });
    }
  };
}

/** Parses a JSON object body; anything else is a 400. The body is never logged. */
export async function readJsonObject(request: NextRequest): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "invalid_json");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(400, "invalid_json");
  }
  return body as Record<string, unknown>;
}
