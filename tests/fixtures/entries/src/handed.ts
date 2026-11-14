import { audit } from './audit.js';

export function inTransaction(work: (tx: string) => void): void {
  work('tx');
}

export function save(): void {
  inTransaction((tx) => {
    audit(tx);
  });
  inTransaction(later);
}

export function retry(): void {
  inTransaction(later);
}

function later(): void {}

export function hooks(): { run(): void } {
  return {
    run() {
      audit('run');
    },
  };
}
