export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly providerId: string,
    public readonly retryable: boolean = true
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export function isProviderError(error: unknown): error is ProviderError {
  return error instanceof ProviderError;
}
