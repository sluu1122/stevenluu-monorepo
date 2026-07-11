import { createServer } from './server.js';
import { config } from './config.js';

const app = createServer();

app.listen(config.port, () => {
  console.log(`[cpt-api] Server running at http://localhost:${config.port}`);
});
