import { describe, expect, it } from 'vitest';
import { reportOf } from '../report-of.js';

const F = 'src/flow.ts#';
const { trips } = reportOf('branches');
const paths = (entry: string) =>
  trips(F + entry).map((steps) => steps.slice(1).map((s) => s.replace(F, '')));

describe('paths', () => {
  it('gives straight-line code one trip, in the order reached', () => {
    expect(paths('straight')).toEqual([['check', 'keys', 'log']]);
  });

  it('makes each way through a branch its own trip, so a path that skips the check shows', () => {
    expect(paths('branch')).toEqual([['check', 'keys'], ['keys']]);
  });

  it("divides the caller's paths at a branch inside a called function", () => {
    expect(paths('divided')).toEqual([
      ['inner', 'a', 'log'],
      ['inner', 'b', 'log'],
    ]);
  });

  it('follows switch cases, falling through where there is no break', () => {
    expect(paths('switching')).toEqual([['a'], ['b', 'log'], ['log']]);
  });

  it('divides at ?: and at && and ||', () => {
    expect(paths('ternary')).toEqual([['a'], ['b']]);
    expect(paths('logical')).toEqual([[], ['a'], ['a', 'b'], ['b']]);
  });

  it('divides at an optional call', () => {
    expect(paths('optional')).toEqual([[], ['Holder.run', 'a']]);
  });

  it('walks a loop body taken once and not taken', () => {
    expect(paths('loop')).toEqual([['a', 'log'], ['log']]);
  });

  it('ends a path at an uncaught throw', () => {
    expect(paths('guard')).toEqual([[], ['keys']]);
  });

  it('continues into the catch when walked code catches the throw', () => {
    expect(paths('caught')).toEqual([
      ['risky', 'keys'],
      ['risky', 'log'],
    ]);
  });

  it('ends a path at return', () => {
    expect(paths('returns')).toEqual([[], ['a']]);
  });

  it('does not walk a part already on the path again, so recursion ends', () => {
    expect(paths('recursive')).toEqual([['a']]);
  });

  it('collapses paths that reach the same parts in the same order', () => {
    expect(paths('collapse')).toEqual([['a']]);
  });

  it('ends a path at an error answer', () => {
    expect(paths('answered')).toEqual([['a'], ['refuse']]);
  });

  it('stops naming the entry once it passes the path limit', () => {
    expect(() => reportOf('path-limit')).toThrow(
      /src\/many\.ts#many has more than 1000 paths; raise pathLimit/,
    );
  });

  it('allows more paths when the settings raise the limit', () => {
    const { trips: raised } = reportOf('path-limit', 'raised.json');
    expect(raised('src/many.ts#many')).toHaveLength(2048);
  });
});

describe('the path limit', () => {
  it('counts distinct step lists, so the same steps ending two ways count once', () => {
    const { trips: ends } = reportOf('path-limit', 'ends.json');
    expect(ends('src/ends.ts#endsTwoWays')).toHaveLength(512);
  });
});
