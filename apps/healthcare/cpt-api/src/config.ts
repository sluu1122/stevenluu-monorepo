export const config = {
  port:           Number(process.env['PORT'] ?? 3002),
  allowedOrigins: ['http://localhost:4200', 'http://localhost:4300'],
} as const;
