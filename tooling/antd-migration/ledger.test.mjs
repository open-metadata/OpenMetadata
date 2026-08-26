import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countAntSelectors, parseAntdImports } from './ledger.mjs';

test('parses named imports', () => {
  const src = `import { Button, Divider as Sep } from 'antd';`;
  assert.deepEqual(parseAntdImports(src), ['Button', 'Divider']);
});

test('counts named specifiers in a combined default+named import', () => {
  const src = `import Button, { Divider } from 'antd';`;
  assert.deepEqual(parseAntdImports(src), ['Divider']);
});

test('parses type-only and multiline imports', () => {
  const src = `import type { TabsProps } from 'antd';\nimport {\n  Col,\n  Row,\n} from 'antd';`;
  assert.deepEqual(parseAntdImports(src), ['TabsProps', 'Col', 'Row']);
});

test('counts subpath imports under the path head', () => {
  const src = `import Table from 'antd/lib/table';`;
  assert.deepEqual(parseAntdImports(src), ['antd/lib/table']);
});

test('ignores non-antd imports', () => {
  assert.deepEqual(parseAntdImports(`import { X } from 'antdesign-x';`), []);
});

test('counts .ant- selector occurrences', () => {
  const less = `.ant-btn { color: red; }\n.ant-btn:hover {}\n.ant-select-dropdown {}`;
  assert.equal(countAntSelectors(less), 3);
});
