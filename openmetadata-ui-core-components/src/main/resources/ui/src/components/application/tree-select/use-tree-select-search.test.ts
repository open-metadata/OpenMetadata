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
import { describe, expect, it } from 'vitest';
import type { TreeSelectNode } from './tree-select.types';
import { getVisibleNodeIds } from './use-tree-select-search';

const tree: TreeSelectNode[] = [
  {
    id: 'finance',
    label: 'Finance',
    children: [
      {
        id: 'accounting',
        label: 'Accounting',
        children: [{ id: 'payroll', label: 'Payroll' }],
      },
    ],
  },
  { id: 'legal', label: 'Legal' },
];

describe('getVisibleNodeIds', () => {
  it('keeps the subtree of a matching node', () => {
    expect(getVisibleNodeIds(tree, 'fin')).toEqual(
      new Set(['finance', 'accounting', 'payroll'])
    );
  });

  it('keeps the ancestors of a matching descendant', () => {
    expect(getVisibleNodeIds(tree, 'payroll')).toEqual(
      new Set(['finance', 'accounting', 'payroll'])
    );
  });

  it('returns null without a search term', () => {
    expect(getVisibleNodeIds(tree, '')).toBeNull();
  });
});
