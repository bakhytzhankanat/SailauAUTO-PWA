/**
 * Vercel entry: single Express app handles all requests (including OPTIONS).
 * Local dev uses src/index.js which calls app.listen().
 */
export { default } from './src/app.js';
