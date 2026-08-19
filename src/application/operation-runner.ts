import type {
  ActionResult,
} from "@/application/action-result";

export type OperationRetryPolicy =
  | "safe_same_identity"
  | "do_not_retry";

export interface RunApplicationOperationInput<
  TData,
> {
  operationName: string;

  retryPolicy: OperationRetryPolicy;

  execute: () => Promise<
    ActionResult<TData>
  >;
}

/**
 * Converts unexpected implementation/infrastructure exceptions into the
 * same structured action-result contract used by BeforeBell.
 *
 * "safe_same_identity" means retrying is permitted only when the caller
 * preserves the exact logical operation identity and idempotency IDs.
 */
export async function runApplicationOperation<
  TData,
>({
  operationName,
  retryPolicy,
  execute,
}: RunApplicationOperationInput<TData>): Promise<
  ActionResult<TData>
> {
  try {
    return await execute();
  } catch {
    if (
      retryPolicy ===
      "safe_same_identity"
    ) {
      return {
        success: false,
        code:
          "unexpected_failure_retryable",
        message: `${operationName} failed unexpectedly. Retrying with the same operation identity is safe.`,
        retryable: true,
      };
    }

    return {
      success: false,
      code:
        "unexpected_failure_requires_review",
      message: `${operationName} failed unexpectedly. Automatic retry is not permitted.`,
      retryable: false,
    };
  }
}