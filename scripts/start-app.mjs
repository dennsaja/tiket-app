import { access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import loadRuntimeEnvironment from './load-runtime-env.cjs';

// Launch the single packaged server, with its own public assets and API routes.
const checkout = process.cwd();
const server = path.join(checkout, '.next', 'standalone', 'server.js');
await access(server).catch(() => { throw new Error('Jalankan npm run build sebelum npm start.'); });
loadRuntimeEnvironment(path.dirname(server));
process.env.HOSTNAME ||= '127.0.0.1';
process.env.PORT ||= '3000';
await import(pathToFileURL(server).href);
