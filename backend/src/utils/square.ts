export interface SquareErrorDetail {
  detail?: string;
  code?: string;
}

/**
 * Square SDK throws errors shaped as { errors: [{ detail, code }, ...] }
 * rather than standard Error instances. Returns the first error detail/code
 * if the caught value matches that shape, or null for any other error type.
 */
export function extractSquareError(error: unknown): SquareErrorDetail | null {
  const squareError = error as { errors?: Array<SquareErrorDetail> };
  if (squareError.errors && squareError.errors.length > 0) {
    return squareError.errors[0];
  }
  return null;
}
