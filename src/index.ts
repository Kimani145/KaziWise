import { buildApp } from './server.js';
import { env } from './config/env.js';

async function start() {
  try {
    const app = await buildApp();
    await app.listen({ port: env.PORT, host: env.HOST });
    console.log(`🚀 KaziWise LMS API server listening at http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    console.error('Failed to start KaziWise LMS API server:', err);
    process.exit(1);
  }
}

start();
