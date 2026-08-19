export interface ActionResult<TData = unknown> {
  success: boolean;
  code: string;
  message: string;

  /**
   * Whether retrying the exact same operation with the same idempotency
   * identity can be considered safe.
   */
  retryable: boolean;

  data?: TData;
}