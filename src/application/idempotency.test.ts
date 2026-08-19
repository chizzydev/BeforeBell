import { describe, expect, it } from "vitest";

import {
  buildStableOperationId,
} from "@/application/idempotency";

describe("buildStableOperationId", () => {
  it("returns the same ID for the same logical operation", () => {
    const first =
      buildStableOperationId(
        "offer",
        "absence.created:case-1:candidate-1:P1,P2",
      );

    const second =
      buildStableOperationId(
        "offer",
        "absence.created:case-1:candidate-1:P1,P2",
      );

    expect(first).toBe(second);
  });

  it("separates IDs by namespace", () => {
    const key =
      "absence.created:case-1";

    expect(
      buildStableOperationId(
        "offer",
        key,
      ),
    ).not.toBe(
      buildStableOperationId(
        "activity",
        key,
      ),
    );
  });

  it("rejects an empty idempotency key", () => {
    expect(() =>
      buildStableOperationId(
        "offer",
        "   ",
      ),
    ).toThrow(
      "Idempotency key must not be empty.",
    );
  });
});