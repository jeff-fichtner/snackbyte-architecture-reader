export function a(): void {}
export function b(): void {}
export function log(): void {}

export function parse(text: string): unknown {
  return JSON.parse(text);
}

export function builtIn(text: string): void {
  try {
    JSON.parse(text);
    a();
  } catch {
    log();
  }
}

export function throughParameter(route: (path: string) => void): void {
  try {
    route('/');
  } catch {
    log();
  }
}

export function deeper(text: string): void {
  try {
    parse(text);
    a();
  } catch {
    log();
  }
}

export function uncaught(text: string): void {
  a();
  JSON.parse(text);
  b();
}

export function followedOnly(): void {
  try {
    a();
  } catch {
    log();
  }
}

export function cleanedUp(text: string): void {
  try {
    JSON.parse(text);
  } finally {
    log();
  }
  a();
}
