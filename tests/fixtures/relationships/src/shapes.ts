export interface Shape {
  area(): number;
}

export class Base {
  describe(): string {
    return 'base';
  }
}

export class Square extends Base implements Shape {
  constructor(private readonly side: number) {
    super();
  }

  area(): number {
    return square(this.side);
  }
}

function square(n: number): number {
  return n * n;
}
