export class AppError extends Error {
  constructor(public readonly statusCode: number, message: string, public readonly code: string) { super(message); }
}
export const badRequest = (message = 'Invalid request') => new AppError(400, message, 'BAD_REQUEST');
export const unauthorized = () => new AppError(401, 'Authentication required', 'UNAUTHORIZED');
export const forbidden = () => new AppError(403, 'Insufficient permissions', 'FORBIDDEN');
export const notFound = () => new AppError(404, 'Resource not found', 'NOT_FOUND');
