import { createApp } from './app.js';

const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
// Intentionally local-only. Do not bind 0.0.0.0 until proper auth and deployment hardening exist.
createApp().listen(port, '127.0.0.1', () => {
  console.log(`CodeSentinel local dashboard: http://127.0.0.1:${port}`);
  console.log('This local prototype must not be exposed as a public scanning service.');
});
