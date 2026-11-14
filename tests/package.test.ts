import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  files: string[];
};

// npm ships these whatever `files` says.
const ALWAYS_SHIPPED = ['package.json', 'README.md'];

function shipped(path: string): boolean {
  if (ALWAYS_SHIPPED.includes(path)) {
    return true;
  }
  return manifest.files.some((entry) => path === entry || path.startsWith(`${entry}/`));
}

function relativeLinks(file: string): string[] {
  const text = readFileSync(join(root, file), 'utf8');
  const links = [...text.matchAll(/\]\(([^)\s]+)\)/g)].map((match) => match[1] ?? '');
  return links
    .filter((link) => !/^[a-z][a-z0-9+.-]*:/i.test(link) && !link.startsWith('#'))
    .map((link) => link.split('#')[0] ?? '')
    .map((link) => relative(root, normalize(join(root, dirname(file), link))));
}

describe('the published package', () => {
  it('ships the report and settings formats', () => {
    expect(shipped('docs/report.md')).toBe(true);
    expect(shipped('docs/settings.md')).toBe(true);
  });

  it('ships every file a shipped document links to', () => {
    const documents = ['README.md', 'docs/report.md', 'docs/settings.md'];
    for (const document of documents) {
      for (const target of relativeLinks(document)) {
        expect(existsSync(join(root, target)), `${document} links ${target}`).toBe(true);
        expect(shipped(target), `${document} links ${target}, which is not shipped`).toBe(true);
      }
    }
  });

  it('names its own version in the README install line', () => {
    const version = (
      JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
        version: string;
      }
    ).version;
    const readme = readFileSync(join(root, 'README.md'), 'utf8');
    expect(readme).toContain(
      `/releases/download/v${version}/snackbyte-architecture-reader-${version}.tgz`,
    );
  });
});
