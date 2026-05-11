export type ErrorDetails = Record<string, unknown> | string[] | unknown;

export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: ErrorDetails,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorBody(code: string, message: string, details?: ErrorDetails) {
  return {
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  };
}
