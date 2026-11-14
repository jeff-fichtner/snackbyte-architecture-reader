export function g1(): void {}
export function g2(): void {}
export function g3(): void {}
export function g4(): void {}
export function g5(): void {}
export function g6(): void {}
export function g7(): void {}
export function g8(): void {}
export function g9(): void {}

export function endsTwoWays(x: boolean[], y: boolean): void {
  if (x[0]) g1();
  if (x[1]) g2();
  if (x[2]) g3();
  if (x[3]) g4();
  if (x[4]) g5();
  if (x[5]) g6();
  if (x[6]) g7();
  if (x[7]) g8();
  if (x[8]) g9();
  if (y) throw new Error('late');
}
