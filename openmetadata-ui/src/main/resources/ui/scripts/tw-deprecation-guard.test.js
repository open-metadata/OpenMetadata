/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

/* Focused checks for the less + raw-SVG deprecation guard. Run: node scripts/tw-deprecation-guard.test.js */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { parseSvgImports, svgKey } = require('./tw-deprecation-guard');

const SVG_PATH = 'openmetadata-ui/src/main/resources/ui/src/assets/svg';

let pass = 0;
function check(name, fn) {
  try {
    fn();
    pass++;
  } catch (e) {
    process.stderr.write(`\nFAIL: ${name}\n  ${e.message}\n`);
    process.exitCode = 1;
  }
}

function setEq(actual, expected) {
  assert.deepStrictEqual([...actual].sort(), [...expected].sort());
}

// --- parseSvgImports / svgKey -------------------------------------------

check('parseSvgImports extracts raw assets/svg specifiers', () => {
  const paths = parseSvgImports(
    `import A from '../assets/svg/alert.svg';\nimport B from '../../assets/svg/common/file.svg';\n`
  );
  setEq(paths, ['../assets/svg/alert.svg', '../../assets/svg/common/file.svg']);
});

check('parseSvgImports ignores non-svg and non-assets imports', () => {
  const paths = parseSvgImports(
    `import { Icon } from '@openmetadata/ui-core-components/icons';\nimport x from './thing.ts';\n`
  );
  assert.strictEqual(paths.size, 0);
});

check('svgKey normalizes different relative depths to the same key', () => {
  assert.strictEqual(svgKey('../assets/svg/alert.svg'), svgKey('../../assets/svg/alert.svg'));
  assert.strictEqual(svgKey('../assets/svg/alert.svg'), 'assets/svg/alert.svg');
});

// --- end-to-end CLI behaviour, against a throwaway git repo -------------

function makeTmpRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-guard-test-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  git('init', '-q');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  return { dir, git };
}

function runGuard(dir, args) {
  const guardPath = path.join(__dirname, 'tw-deprecation-guard.js');
  try {
    const out = execFileSync('node', [guardPath, ...args], { cwd: dir, encoding: 'utf8' });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}

check('FAILS when a diff adds a new import from assets/svg', () => {
  const { dir, git } = makeTmpRepo();
  fs.writeFileSync(path.join(dir, 'Foo.tsx'), `export const x = 1;\n`);
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  const baseSha = git('rev-parse', 'HEAD').trim();

  fs.writeFileSync(path.join(dir, 'Foo.tsx'), `import icon from '../assets/svg/alert.svg';\nexport const x = icon;\n`);
  git('add', '-A');
  git('commit', '-q', '-m', 'add svg import');

  const result = runGuard(dir, [baseSha]);
  assert.strictEqual(result.code, 1, `expected exit 1, got ${result.code}:\n${result.out}`);
  assert.ok(result.out.includes('Foo.tsx'), `expected the report to name Foo.tsx:\n${result.out}`);
});

check('PASSES when a file is moved to a different depth (svg specifier depth rewritten)', () => {
  const { dir, git } = makeTmpRepo();
  fs.mkdirSync(path.join(dir, 'a'), { recursive: true });
  // Keep enough unchanged content for Git to recognize a rename rather than a delete/add.
  const body = `export const x = icon;\nexport const label = 'asset';\nexport const size = 24;\n`;
  fs.writeFileSync(path.join(dir, 'a/Foo.tsx'), `import icon from '../assets/svg/alert.svg';\n${body}`);
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  const baseSha = git('rev-parse', 'HEAD').trim();

  fs.mkdirSync(path.join(dir, 'a/b'), { recursive: true });
  fs.rmSync(path.join(dir, 'a/Foo.tsx'));
  fs.writeFileSync(path.join(dir, 'a/b/Foo.tsx'), `import icon from '../../assets/svg/alert.svg';\n${body}`);
  git('add', '-A');
  git('commit', '-q', '-m', 'move Foo deeper');

  const result = runGuard(dir, [baseSha]);
  assert.strictEqual(result.code, 0, `expected exit 0, got ${result.code}:\n${result.out}`);
});

check('FAILS when a new .svg file is added under assets/svg', () => {
  const { dir, git } = makeTmpRepo();
  fs.writeFileSync(path.join(dir, 'App.tsx'), `export const App = () => null;\n`);
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  const baseSha = git('rev-parse', 'HEAD').trim();

  fs.mkdirSync(path.join(dir, SVG_PATH), { recursive: true });
  fs.writeFileSync(path.join(dir, `${SVG_PATH}/new-icon.svg`), `<svg/>\n`);
  git('add', '-A');
  git('commit', '-q', '-m', 'add raw svg');

  const result = runGuard(dir, [baseSha]);
  assert.strictEqual(result.code, 1, `expected exit 1, got ${result.code}:\n${result.out}`);
  assert.ok(result.out.includes('new-icon.svg'), `expected the report to name new-icon.svg:\n${result.out}`);
});

for (const staged of [true, false]) {
  check(
    `blocks new --om-* style references and declarations (${
      staged ? 'staged' : 'branch'
    })`,
    () => {
      const { dir, git } = makeTmpRepo();
      try {
        const file = path.join(dir, 'surface.css');
        fs.writeFileSync(file, '.surface { padding: var(--om-space-4); }\n');
        git('add', '-A');
        git('commit', '-q', '-m', 'base');
        const baseSha = git('rev-parse', 'HEAD').trim();
        fs.appendFileSync(
          file,
          ':root { --om-new: red; } .extra { padding: var(--om-space-4); }\n'
        );
        git('add', '-A');
        if (!staged) git('commit', '-q', '-m', 'add legacy token usage');
        const result = runGuard(dir, staged ? [] : [baseSha]);
        assert.strictEqual(result.code, 1);
        assert.ok(result.out.includes('--om-new'));
        assert.ok(result.out.includes('--om-space-4'));
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  );
}

check('allows migrating existing style references and ignores comments', () => {
  const { dir, git } = makeTmpRepo();
  try {
    const file = path.join(dir, 'surface.less');
    fs.writeFileSync(file, '.surface { padding: var(--om-space-4); }\n');
    git('add', '-A');
    git('commit', '-q', '-m', 'base');
    fs.writeFileSync(
      file,
      '// var(--om-example)\n/* --om-example: red; */\n.surface { padding: calc(var(--tw-spacing) * 4); }\n'
    );
    git('add', '-A');
    assert.strictEqual(runGuard(dir, []).code, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

process.stdout.write(`\n${pass} check(s) passed.\n`);
