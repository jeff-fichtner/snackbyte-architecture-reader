export function check(): void {}
export function keys(): void {}
export function log(): void {}
export function a(): void {}
export function b(): void {}
export function refuse(): void {}

export function risky(): void {
  if (Math.random() > 0.5) throw new Error('risky');
}

export class Holder {
  run(): void {
    a();
  }
}

export function straight(): void {
  check();
  keys();
  log();
}

export function branch(x: boolean): void {
  if (x) {
    check();
    keys();
  } else {
    keys();
  }
}

function inner(x: boolean): void {
  if (x) a();
  else b();
}

export function divided(x: boolean): void {
  inner(x);
  log();
}

export function switching(k: number): void {
  switch (k) {
    case 1:
      a();
      break;
    case 2:
      b();
    // falls through
    default:
      log();
  }
}

export function ternary(x: boolean): void {
  return x ? a() : b();
}

export function logical(x: boolean): void {
  void (x && a());
  void (x || b());
}

export function optional(holder: Holder | undefined): void {
  holder?.run();
}

export function loop(xs: number[]): void {
  for (const x of xs) {
    void x;
    a();
  }
  log();
}

export function guard(x: boolean): void {
  if (!x) throw new Error('no');
  keys();
}

export function caught(): void {
  try {
    risky();
    keys();
  } catch {
    log();
  }
}

export function returns(x: boolean): void {
  if (x) return;
  a();
}

export function recursive(n: number): void {
  if (n > 0) recursive(n - 1);
  a();
}

export function collapse(x: boolean): void {
  if (x) {
    a();
  } else {
    a();
  }
}

export function answered(x: boolean): void {
  if (x) {
    refuse();
  }
  a();
}
