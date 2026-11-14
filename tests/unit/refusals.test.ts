import { describe, expect, it } from 'vitest';
import { StopError } from '../../src/errors.js';
import { reportOf } from '../report-of.js';

describe('refusals and checkpoints', () => {
  const { part } = reportOf('refusals');
  const H = 'src/handlers.ts';
  const whats = (id: string) => (part(id).refuses ?? []).map((r) => r.what);

  it('takes a literal message, or a const declared as one', () => {
    expect(whats(`${H}#requireSession`)).toEqual(['not signed in']);
    expect(whats(`${H}#lookup`)[1]).toBe('not allowed');
  });

  describe('a message written with values filled in when the code runs', () => {
    const M = 'src/messages.ts';

    it('reads a template literal with each substitution as one placeholder', () => {
      expect(whats(`${M}#configured`)).toEqual([
        'Missing required configuration: …',
        '… … is not https',
        '… is unknown',
      ]);
    });

    it('writes a substitution that is a const string as its text', () => {
      expect(whats(`${M}#secret`)).toEqual(['SIGNING_KEY cannot be read']);
    });

    it('reads a const holding a template the same way', () => {
      expect(whats(`${M}#held`)).toEqual(['no such …']);
    });

    it('reads a concatenation with + the same way', () => {
      expect(whats(`${M}#joined`)).toEqual(['unknown mode …', 'over the limit of … requests']);
    });

    it('reads a thrown template and a template given to an error answer the same way', () => {
      expect(whats(`${M}#thrownText`)).toEqual(['refused …']);
      expect(whats(`${M}#answered`)).toEqual(['gone: …']);
    });

    it('takes the class when the written text has no letter or digit', () => {
      expect(whats(`${M}#onlyValues`)).toEqual(['Error']);
    });
  });

  it('takes the class name when the message is a variable, even one the compiler has narrowed', () => {
    expect(whats(`${H}#lookup`)[0]).toBe('NotFound');
  });

  it("takes the compiler's type of a rethrown caught value", () => {
    expect(whats(`${H}#rethrow`)).toEqual(['unknown']);
  });

  it('reports error answers by the type of their status, in source order with the rest', () => {
    expect(whats(`${H}#answers`)).toEqual(['error status', 'error status', 'gone', 'failure page']);
  });

  it('takes the words of an error answer from its argument when that is a literal', () => {
    expect(whats(`${H}#answers`)[2]).toBe('gone');
    expect(whats(`${H}#answers`)[3]).toBe('failure page');
  });

  it('reads @checkpoint with its words, whitespace collapsed; empty and misplaced tags as written', () => {
    expect(part(`${H}#requireSession`).checkpoint).toEqual({
      what: 'the session cookie is signed and current',
    });
    expect(part(`${H}#emptyTag`).checkpoint).toEqual({ what: '' });
    expect(part(`${H}#Tagged`).checkpoint).toEqual({ what: 'misplaced on a class' });
  });

  it('gives a function with no refusal and no tag neither field', () => {
    expect(part(`${H}#plain`).refuses).toBeUndefined();
    expect(part(`${H}#plain`).checkpoint).toBeUndefined();
  });

  it('stops when an error-answer rule matches no call', () => {
    expect(() => reportOf('refusals', 'unmatched.json')).toThrow(StopError);
    expect(() => reportOf('refusals', 'unmatched.json')).toThrow(/"redirect" matches no call/);
  });
});
