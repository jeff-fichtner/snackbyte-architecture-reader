import { describe, expect, it } from 'vitest';
import { StopError } from '../../src/errors.js';
import { loadPrograms } from '../../src/program.js';
import { loadSettings } from '../../src/settings.js';
import { settingsOf } from '../helpers.js';

describe('program', () => {
  it('stops with the compiler message and its position when the code has errors', () => {
    const settings = loadSettings(settingsOf('compile-error'));
    expect(() => loadPrograms(settings.projects, settings.root)).toThrow(StopError);
    expect(() => loadPrograms(settings.projects, settings.root)).toThrow(
      /src\/broken\.ts:1:14: Type 'string' is not assignable to type 'number'/,
    );
  });

  it('builds one program per project', () => {
    const settings = loadSettings(settingsOf('ids'));
    expect(loadPrograms(settings.projects, settings.root)).toHaveLength(1);
  });
});
