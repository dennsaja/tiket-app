import { access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Launch the single packaged server, with its own public assets and API routes.
const checkout = process.cwd();
const server = path.join(checkout, '.next', 'standalone', 'server.js');
await access(server).catch(() => { throw new Error('Jalankan npm run build sebelum npm start.'); });
if (!process.env.APP_ROOT && existsSync(path.join(checkout, '.git'))) process.env.APP_ROOT = checkout;
process.env.HOSTNAME ||= '127.0.0.1';
process.env.PORT ||= '3000';
process.env.APP_SERVICE = 'monolith';
process.env.SPLIT_DEPLOY_ENABLED = 'false';
await import(pathToFileURL(server).href);
