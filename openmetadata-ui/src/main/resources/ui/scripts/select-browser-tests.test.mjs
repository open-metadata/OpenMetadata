/*
 *  Copyright 2026 Collate.
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
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { changedKeys, selectTests } from './select-browser-tests.mjs';

const UI = 'openmetadata-ui/src/main/resources/ui/';
const ROLES = 'src/pages/Roles/Roles.browser.test.tsx';
const TABLE = 'src/pages/Table/Table.browser.test.tsx';
const tests = [ROLES, TABLE];
const map = {
  [ROLES]: ['src/pages/Roles/Roles.tsx', 'src/AppShell.tsx'],
  [TABLE]: ['src/pages/Table/Table.tsx', 'src/AppShell.tsx'],
};
const edge = (path, dynamic = false) => ({ path, dynamic });
const graph = {
  [ROLES]: [edge('src/test/browser/renderApp.tsx')],
  [TABLE]: [
    edge('src/test/browser/renderApp.tsx'),
    edge('src/test/browser/fixtures/table.ts'),
  ],
  'src/test/browser/fixtures/table.ts': [
    edge('src/constants/table.constants.ts'),
  ],
  'src/pages/Table/Table.tsx': [
    edge('src/pages/Table/table.less'),
    edge('src/pages/Lineage/Lineage.tsx', true),
  ],
};
const select = (changed, extra = {}) =>
  selectTests({
    changed: changed.map((f) => UI + f),
    tests,
    map,
    graph,
    ...extra,
  });

it('runs only the tests that executed a changed file', () => {
  assert.deepEqual(select(['src/pages/Roles/Roles.tsx']).tests, [ROLES]);
  assert.deepEqual(select(['src/AppShell.tsx']).tests, tests);
});

it('follows direct imports of executed files and test helpers, not lazy ones', () => {
  assert.deepEqual(select(['src/pages/Table/table.less']).tests, [TABLE]);
  assert.deepEqual(select(['src/constants/table.constants.ts']).tests, [TABLE]);
  assert.deepEqual(select(['src/test/browser/fixtures/table.ts']).tests, [
    TABLE,
  ]);
  const lazy = select(['src/pages/Lineage/Lineage.tsx']);
  assert.equal(lazy.mode, 'none');
  assert.deepEqual(lazy.uncovered, ['src/pages/Lineage/Lineage.tsx']);
});

it('runs a changed test file and any test missing from the map', () => {
  assert.deepEqual(select([ROLES]).tests, [ROLES]);
  const NEW = 'src/pages/New/New.browser.test.tsx';
  assert.deepEqual(
    selectTests({ changed: [], tests: [...tests, NEW], map, graph }).tests,
    [NEW]
  );
});

it('runs everything when it cannot reason about the change', () => {
  assert.equal(
    selectTests({
      changed: ['openmetadata-ui-core-components/src/x.test.tsx'],
      tests,
      map,
      graph,
    }).mode,
    'none'
  );
  assert.equal(select(['src/test/browser/setup.ts']).mode, 'all');
  assert.equal(select(['src/styles/variables.less']).mode, 'all');
  // A stylesheet a component imports, just not one any test reaches.
  const sidebar = select(['src/Sidebar/sidebar.less'], { inCode: () => true });
  assert.deepEqual(
    [sidebar.mode, sidebar.uncovered],
    ['none', ['src/Sidebar/sidebar.less']]
  );
  assert.equal(select([], { map: undefined }).mode, 'all');
  assert.equal(select([], { graph: undefined }).mode, 'all');
  assert.equal(
    selectTests({
      changed: ['openmetadata-ui-core-components/src/x.tsx'],
      tests,
      map,
      graph,
    }).mode,
    'all'
  );
});

it('selects by translation key, and runs everything for keys built at runtime', () => {
  const read = (file) =>
    file === 'src/pages/Roles/Roles.tsx' ? "t('label.role')" : '';
  const locale = ['src/locale/languages/en-us.json'];
  assert.deepEqual(select(locale, { keys: ['label.role'], read }).tests, [
    ROLES,
  ]);
  assert.equal(select(locale, { keys: ['label.dynamic'], read }).mode, 'all');
  // Named literally in code no test executes: nothing to run.
  assert.equal(
    select(locale, { keys: ['label.new'], read, inCode: () => true }).mode,
    'none'
  );
  assert.deepEqual(
    changedKeys(
      { label: { a: 'A', b: 'B' } },
      { label: { a: 'A2', b: 'B', c_one: 'C', c_other: 'Cs' } }
    ),
    ['label.a', 'label.c']
  );
});
