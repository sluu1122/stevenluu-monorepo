export const config = {
  port:           Number(process.env['PORT'] ?? 3002),
  allowedOrigins: (process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:4200,http://localhost:4300').split(','),
} as const;
