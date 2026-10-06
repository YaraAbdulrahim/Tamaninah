export type CompleteOptions = {
  temperature?: number;
  maxTokens?: number;
  /**
   * Absolute epoch-ms deadline shared by every attempt of one request stage
   * (model fallbacks, effort-drop retries, JSON repair). The provider never
   * starts or continues a call past it and throws a `timeout` error instead.
   */
  deadline?: number;
};

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ProviderMode = "live" | "mock";

export type AIProvider = {
  name: ProviderMode;
  complete(messages: ChatMessage[], options?: CompleteOptions): Promise<string>;
};

/** Thrown when the shared deadline leaves no room for (another) model call. */
export class DeadlineExceededError extends Error {
  constructor(message = "timeout: analyze deadline exceeded") {
    super(message);
    this.name = "TimeoutError";
  }
}

/** Non-retryable or exhausted upstream failure. `status` is the last HTTP status seen (0 = network). */
export class UpstreamError extends Error {
  readonly status: number;
  constructor(status: number, message = `upstream:${status || "network"}`) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
  }
}

export function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error instanceof DeadlineExceededError ||
    error.name === "TimeoutError" ||
    error.name === "AbortError" ||
    /timeout/i.test(error.message)
  );
}
