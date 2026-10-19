import app from './app.js';
import { assertJwtSecretConfigured } from './middleware/auth.js';

assertJwtSecretConfigured();

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
