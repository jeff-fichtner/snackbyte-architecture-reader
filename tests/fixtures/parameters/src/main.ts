import { createApp } from './app.js';

export function main(): void {
  const app = createApp({
    resolve: (host) => lookup(host),
    engine,
    mount: { log: (message) => note(message) },
  });
  app('/x');
  twice(() => note('a'));
  twice(() => note('b'));
  keep({ hold: kept });
  destructured({ run: ran });
}

function lookup(host: string): string {
  return host;
}

function engine(tenant: string): string {
  return tenant;
}

function note(message: string): void {
  void message;
}

function kept(): void {}

function ran(): void {}

function twice(fn: () => void): void {
  fn();
}

function keep(deps: { hold: () => void }): () => void {
  return deps.hold;
}

function destructured({ run }: { run: () => void }): void {
  run();
}
