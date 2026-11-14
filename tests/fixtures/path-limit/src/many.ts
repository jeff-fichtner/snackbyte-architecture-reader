export function f1(): void {}
export function f2(): void {}
export function f3(): void {}
export function f4(): void {}
export function f5(): void {}
export function f6(): void {}
export function f7(): void {}
export function f8(): void {}
export function f9(): void {}
export function f10(): void {}
export function f11(): void {}

export function many(x: boolean[]): void {
  if (x[0]) f1();
  if (x[1]) f2();
  if (x[2]) f3();
  if (x[3]) f4();
  if (x[4]) f5();
  if (x[5]) f6();
  if (x[6]) f7();
  if (x[7]) f8();
  if (x[8]) f9();
  if (x[9]) f10();
  if (x[10]) f11();
}
