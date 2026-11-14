import { describe, expect, it } from 'vitest';
import { reportOf } from '../report-of.js';

const F = 'src/flow.ts#';
const { trips } = reportOf('throws');
const paths = (entry: string) =>
  trips(F + entry).map((steps) => steps.slice(1).map((s) => s.replace(F, '')));

describe('a call the reader cannot follow can throw', () => {
  it('continues into the catch after a call into a built-in or a package', () => {
    expect(paths('builtIn')).toEqual([['a'], ['log']]);
  });

  it('continues into the catch after a call through a parameter it cannot resolve', () => {
    expect(paths('throughParameter')).toEqual([[], ['log']]);
  });

  it('carries the throw out of a codebase function to the catch that holds the call', () => {
    expect(paths('deeper')).toEqual([
      ['parse', 'a'],
      ['parse', 'log'],
    ]);
  });

  it('makes no trip of its own when nothing catches it', () => {
    expect(paths('uncaught')).toEqual([['a', 'b']]);
  });

  it('leaves a catch unwalked when the try makes no call that can throw', () => {
    expect(paths('followedOnly')).toEqual([['a']]);
  });

  it('runs a finally block on the way out, and still makes no trip of its own', () => {
    expect(paths('cleanedUp')).toEqual([['log', 'a']]);
  });
});
