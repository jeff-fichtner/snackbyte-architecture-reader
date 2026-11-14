export function edges(): void {
  withSpread({ ...extra, go: g1 });
  written({ go: g2 });
  new Box().take({ go: g3 });
  withDefault();
  outward({ go: g4 });
}

const extra = { n: 1 };

function withSpread(d: { go(): void }): void {
  d.go();
}

function written(d: { go(): void }): void {
  d.go = noop;
  d.go();
}

class Box {
  take(d: { go(): void }): void {
    d.go();
  }
}

function withDefault(go: () => void = g5): void {
  go();
}

function outward(d: { go(): void }): void {
  setTimeout(d.go, 0);
}

function noop(): void {}
function g1(): void {}
function g2(): void {}
function g3(): void {}
function g4(): void {}
function g5(): void {}
