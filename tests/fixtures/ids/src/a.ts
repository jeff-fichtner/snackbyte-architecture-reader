export function top(): number {
  function inner(): number {
    return 1;
  }
  const local = () => inner();
  const notAPart = 3;
  [1, 2].map((n) => n + notAPart);
  [3].forEach(function (n) {
    return n;
  });
  return local();
}

export const run = () => top();

export class Store {
  count = 0;
  handler = () => this.count;
  constructor(readonly name: string) {}
  open(): void {}
  get size(): number {
    return this.count;
  }
}

export interface Shape {
  area(): number;
}

export type Id = string;

export enum Color {
  Red,
}

export namespace Tools {
  export function hammer(): void {}
}

export function over(a: string): string;
export function over(a: number): number;
export function over(a: string | number): string | number {
  return a;
}

export const config = {
  start() {},
  nested: {
    stop: () => {},
  },
};

export default function () {
  return 0;
}

setTimeout(() => {}, 0);
const [first, second] = [1, 2];
export { first, second };
