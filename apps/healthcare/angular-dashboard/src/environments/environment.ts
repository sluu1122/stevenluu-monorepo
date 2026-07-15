// Local-dev fallback values; in a container these are overlaid at bootstrap
// from assets/config.json — see src/app/runtime-config.ts.
export const environment = {
  cptApiUrl:      'http://localhost:3002',
  icdApiUrl:      'http://localhost:3003',
  aiApiUrl:       'http://localhost:3001',
  patientsApiUrl: 'http://localhost:3004',
  portfolioUrl:   'http://localhost:3000',
};
