import { describe, expect, it } from "vitest";

import {
  runApplicationOperation,
} from "@/application/operation-runner";

describe("runApplicationOperation", () => {
  it("returns a successful action result unchanged", async () => {
    const result =
      await runApplicationOperation({
        operationName:
          "test_operation",
        retryPolicy:
          "safe_same_identity",
        execute: async () => ({
          success: true,
          code: "completed",
          message: "Completed.",
          retryable: false,
          data: {
            value: 42,
          },
        }),
      });

    expect(result).toEqual({
      success: true,
      code: "completed",
      message: "Completed.",
      retryable: false,
      data: {
        value: 42,
      },
    });
  });

  it("marks an unexpected failure retryable when the same identity is safe", async () => {
    const result =
      await runApplicationOperation({
        operationName:
          "create_coverage_offer",
        retryPolicy:
          "safe_same_identity",
        execute: async () => {
          throw new Error(
            "Synthetic infrastructure failure",
          );
        },
      });

    expect(result.success).toBe(
      false,
    );

    expect(result.code).toBe(
      "unexpected_failure_retryable",
    );

    expect(result.retryable).toBe(
      true,
    );
  });

  it("stops automatic retry for operations that are not known-safe", async () => {
    const result =
      await runApplicationOperation({
        operationName:
          "unknown_external_effect",
        retryPolicy:
          "do_not_retry",
        execute: async () => {
          throw new Error(
            "Synthetic provider uncertainty",
          );
        },
      });

    expect(result.success).toBe(
      false,
    );

    expect(result.code).toBe(
      "unexpected_failure_requires_review",
    );

    expect(result.retryable).toBe(
      false,
    );
  });
});