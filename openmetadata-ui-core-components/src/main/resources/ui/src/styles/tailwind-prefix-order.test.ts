import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// With `prefix(tw)`, Tailwind v4 only generates a class when the prefix comes
// first (`tw:hover:bg-x`). The variant-first form (`hover:tw:bg-x`) compiles
// to nothing, so the hover/dark/focus style is silently lost.
const VARIANT_BEFORE_PREFIX =
  /(?<=^|[\s'"`])[a-z][\w-]*(?:\/[\w-]+)?:tw:[\w[\]/.-]+/g;

const SRC_DIR = join(__dirname, '..');

const listSourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return listSourceFiles(path);
    }

    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [path]
      : [];
  });

describe('Tailwind prefix order', () => {
  it('puts the tw: prefix before every variant', () => {
    const offenders = listSourceFiles(SRC_DIR).flatMap((file) =>
      (readFileSync(file, 'utf8').match(VARIANT_BEFORE_PREFIX) ?? []).map(
        (className) => `${relative(SRC_DIR, file)}: ${className}`
      )
    );

    expect(offenders).toEqual([]);
  });
});
