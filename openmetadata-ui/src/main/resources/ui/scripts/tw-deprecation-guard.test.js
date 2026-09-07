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

/* Focused checks for the antd + less deprecation guard. Run: node scripts/tw-deprecation-guard.test.js */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { parseClause, parseAntdImports } = require('./tw-deprecation-guard');

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

// --- parseClause -------------------------------------------------------

check('named specifiers', () => {
  setEq(parseClause('{ Button, Space }'), ['Button', 'Space']);
});

check('aliased named specifier keeps the imported name, not the local alias', () => {
  setEq(parseClause('{ Tag as AntdTag, Tooltip }'), ['Tag', 'Tooltip']);
});

check('default import', () => {
  setEq(parseClause('Foo'), ['*default*']);
});

check('namespace import', () => {
  setEq(parseClause('* as antd'), ['*namespace*']);
});

check('default + named combo', () => {
  setEq(parseClause('Foo, { Bar, Baz }'), ['*default*', 'Bar', 'Baz']);
});

// --- parseAntdImports ----------------------------------------------------

check('parses a simple named import', () => {
  const map = parseAntdImports(`import { Button, Space } from 'antd';\n`);
  assert.ok(map.has('antd'));
  setEq(map.get('antd').specifiers, ['Button', 'Space']);
});

check('keys subpath modules separately from the bare module', () => {
  const map = parseAntdImports(
    `import { Button } from 'antd';\nimport { ExpandableConfig } from 'antd/lib/table/interface';\n`
  );
  setEq(map.get('antd').specifiers, ['Button']);
  setEq(map.get('antd/lib/table/interface').specifiers, ['ExpandableConfig']);
});

check('reconstructs a multi-line import clause', () => {
  const map = parseAntdImports(`import {\n  Button,\n  Space,\n  Tooltip,\n} from 'antd';\n`);
  setEq(map.get('antd').specifiers, ['Button', 'Space', 'Tooltip']);
});

check('returns an empty map when there is no antd import', () => {
  const map = parseAntdImports(`import { Typography } from '@openmetadata/ui-core-components';\n`);
  assert.strictEqual(map.size, 0);
});

check('maps each specifier to the statement that first imported it', () => {
  const map = parseAntdImports(`import { Button } from 'antd';\nimport { Table } from 'antd';\n`);
  setEq(map.get('antd').specifiers, ['Button', 'Table']);
  assert.strictEqual(map.get('antd').statements.get('Button'), "import { Button } from 'antd'");
  assert.strictEqual(map.get('antd').statements.get('Table'), "import { Table } from 'antd'");
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

check('PASSES when a diff only removes antd specifiers (no new debt)', () => {
  const { dir, git } = makeTmpRepo();
  fs.writeFileSync(
    path.join(dir, 'Foo.tsx'),
    `import { Space, Tooltip, Typography } from 'antd';\n`
  );
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  const baseSha = git('rev-parse', 'HEAD').trim();

  fs.writeFileSync(path.join(dir, 'Foo.tsx'), `import { Space, Tooltip } from 'antd';\n`);
  git('add', '-A');
  git('commit', '-q', '-m', 'remove Typography usage');

  const result = runGuard(dir, [baseSha]);
  assert.strictEqual(result.code, 0, `expected exit 0, got ${result.code}:\n${result.out}`);
});

check('FAILS when a diff adds a genuinely new antd specifier to an existing import', () => {
  const { dir, git } = makeTmpRepo();
  fs.writeFileSync(path.join(dir, 'Foo.tsx'), `import { Typography } from 'antd';\n`);
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  const baseSha = git('rev-parse', 'HEAD').trim();

  fs.writeFileSync(path.join(dir, 'Foo.tsx'), `import { Modal, Typography } from 'antd';\n`);
  git('add', '-A');
  git('commit', '-q', '-m', 'add Modal');

  const result = runGuard(dir, [baseSha]);
  assert.strictEqual(result.code, 1, `expected exit 1, got ${result.code}:\n${result.out}`);
  assert.ok(result.out.includes('Foo.tsx'), `expected the report to name Foo.tsx:\n${result.out}`);
});

check('FAILS when a diff adds a brand new antd import to a file that had none', () => {
  const { dir, git } = makeTmpRepo();
  fs.writeFileSync(path.join(dir, 'Foo.tsx'), `export const x = 1;\n`);
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  const baseSha = git('rev-parse', 'HEAD').trim();

  fs.writeFileSync(path.join(dir, 'Foo.tsx'), `import { Modal } from 'antd';\nexport const x = 1;\n`);
  git('add', '-A');
  git('commit', '-q', '-m', 'add antd import');

  const result = runGuard(dir, [baseSha]);
  assert.strictEqual(result.code, 1, `expected exit 1, got ${result.code}:\n${result.out}`);
});

check('staged mode (--cached) catches new antd debt the same way', () => {
  const { dir, git } = makeTmpRepo();
  fs.writeFileSync(path.join(dir, 'Foo.tsx'), `export const x = 1;\n`);
  git('add', '-A');
  git('commit', '-q', '-m', 'base');

  fs.writeFileSync(path.join(dir, 'Foo.tsx'), `import { Modal } from 'antd';\nexport const x = 1;\n`);
  git('add', '-A');

  const result = runGuard(dir, []);
  assert.strictEqual(result.code, 1, `expected exit 1, got ${result.code}:\n${result.out}`);
});

check('reports the statement that introduced the new specifier, not the last one', () => {
  const { dir, git } = makeTmpRepo();
  fs.writeFileSync(path.join(dir, 'Foo.tsx'), `import { Button } from 'antd';\nimport { Table } from 'antd';\n`);
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  const baseSha = git('rev-parse', 'HEAD').trim();

  fs.writeFileSync(path.join(dir, 'Foo.tsx'), `import { Button, Space } from 'antd';\nimport { Table } from 'antd';\n`);
  git('add', '-A');
  git('commit', '-q', '-m', 'add Space');

  const result = runGuard(dir, [baseSha]);
  assert.strictEqual(result.code, 1, `expected exit 1, got ${result.code}:\n${result.out}`);
  assert.ok(
    result.out.includes("import { Button, Space } from 'antd'"),
    `expected the offending statement in the report:\n${result.out}`
  );
  assert.ok(result.out.includes('new: Space'), `expected the new specifier in the report:\n${result.out}`);
  assert.ok(
    !result.out.includes("import { Table } from 'antd'"),
    `unrelated statement should not be reported:\n${result.out}`
  );
});

check('FAILS loudly instead of passing as a no-op when the merge-base cannot be resolved', () => {
  const { dir, git } = makeTmpRepo();
  fs.writeFileSync(path.join(dir, 'Foo.tsx'), `import { Modal } from 'antd';\n`);
  git('add', '-A');
  git('commit', '-q', '-m', 'base');

  const result = runGuard(dir, ['refs/heads/no-such-base']);
  assert.strictEqual(result.code, 1, `expected exit 1, got ${result.code}:\n${result.out}`);
  assert.ok(
    result.out.includes('Cannot resolve the merge-base'),
    `expected an explicit merge-base failure:\n${result.out}`
  );
});

process.stdout.write(`\n${pass} check(s) passed.\n`);
