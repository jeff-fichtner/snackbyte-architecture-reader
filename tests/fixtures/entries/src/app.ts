import { router } from 'fake-router';
import { Engine } from 'fake-engine';
import { audit } from './audit.js';

export function createApp(): void {
  const app = router();
  app.get('/health', (_req, res) => {
    res.send('ok');
  });
  app.get('/named', named);
  const engine = new Engine({
    findAccount(id) {
      return audit(id);
    },
    interactions: { url: (id) => `/i/${id}` },
  });
  void engine;
  [1, 2].forEach((n) => audit(String(n)));
  register(stored);
}

function named(): void {}

const table = { stored: () => audit('stored') };

function stored(): void {
  table.stored();
}

function register(fn: () => void): void {
  fn();
}
