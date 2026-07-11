export const config = {
  port:           Number(process.env['PORT'] ?? 3003),
  allowedOrigins: ['http://localhost:4200', 'http://localhost:4300'],
} as const;
