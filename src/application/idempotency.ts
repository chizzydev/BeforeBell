import { createHash } from "node:crypto";

export function buildStableOperationId(
  namespace: string,
  idempotencyKey: string,
): string {
  const normalizedNamespace =
    namespace.trim();

  const normalizedKey =
    idempotencyKey.trim();

  if (!normalizedNamespace) {
    throw new Error(
      "Idempotency namespace must not be empty.",
    );
  }

  if (!normalizedKey) {
    throw new Error(
      "Idempotency key must not be empty.",
    );
  }

  const digest = createHash("sha256")
    .update(
      `${normalizedNamespace}\0${normalizedKey}`,
    )
    .digest("hex")
    .slice(0, 24);

  return `${normalizedNamespace}-${digest}`;
}