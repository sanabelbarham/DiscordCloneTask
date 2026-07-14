import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/** Every Convex function that touches a protected resource starts with this
 * (Security Basics): resolve the caller's user id or reject outright. */
export async function requireUserId(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError({ code: "UNAUTHENTICATED", message: "Sign in required" });
  }
  return userId;
}

export function forbidden(message: string): never {
  throw new ConvexError({ code: "FORBIDDEN", message });
}

export function notFound(message: string): never {
  throw new ConvexError({ code: "NOT_FOUND", message });
}
