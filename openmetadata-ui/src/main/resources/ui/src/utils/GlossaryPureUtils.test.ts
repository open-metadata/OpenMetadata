/*
 *  Copyright 2024 Collate.
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
import {
  findTreeNode,
  injectMissingInitialOptions,
  TreeNodeLike,
} from './GlossaryPureUtils';

jest.mock('./Fqn', () => ({
  __esModule: true,
  default: {
    split: jest.fn().mockImplementation((fqn) => fqn.split('.')),
    build: jest.fn().mockImplementation((...parts) => parts.join('.')),
  },
}));

jest.mock('./EntityNameUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation((entity) => entity?.displayName || entity?.name || ''),
}));

const MOCK_TREE: TreeNodeLike[] = [
  {
    id: 'glossary-1',
    value: 'Glossary',
    name: 'Glossary',
    title: 'Glossary',
    checkable: false,
    isLeaf: false,
    selectable: false,
    children: [
      {
        id: 'term-1',
        value: 'Glossary.existingTerm',
        name: 'existingTerm',
        title: 'existingTerm',
        checkable: true,
        isLeaf: true,
        selectable: true,
      },
    ],
  },
  {
    id: 'glossary-2',
    value: 'AnotherGlossary',
    name: 'AnotherGlossary',
    title: 'AnotherGlossary',
    checkable: false,
    isLeaf: false,
    selectable: false,
  },
];

describe('findTreeNode', () => {
  it('should find a root-level node by value', () => {
    const result = findTreeNode(MOCK_TREE, 'Glossary');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('glossary-1');
  });

  it('should find a nested child node by value', () => {
    const result = findTreeNode(MOCK_TREE, 'Glossary.existingTerm');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('term-1');
  });

  it('should return null when node is not found', () => {
    const result = findTreeNode(MOCK_TREE, 'NonExistent.term');

    expect(result).toBeNull();
  });

  it('should return null for empty tree', () => {
    const result = findTreeNode([], 'Glossary');

    expect(result).toBeNull();
  });
});

describe('injectMissingInitialOptions', () => {
  let tree: TreeNodeLike[];

  beforeEach(() => {
    tree = JSON.parse(JSON.stringify(MOCK_TREE));
  });

  it('should inject a term under its parent glossary when missing from the tree', () => {
    injectMissingInitialOptions(tree, [
      {
        value: 'Glossary.newTerm',
        label: 'Glossary.newTerm',
        data: { name: 'newTerm', displayName: 'New Term' },
      },
    ]);

    const glossary = tree[0];

    expect(glossary.children).toHaveLength(2);

    const injected = glossary.children?.find(
      (c) => c.value === 'Glossary.newTerm'
    );

    expect(injected).toBeDefined();
    expect(injected?.title).toBe('New Term');
    expect(injected?.isLeaf).toBe(true);
  });

  it('should not duplicate when term already exists in the tree', () => {
    injectMissingInitialOptions(tree, [
      {
        value: 'Glossary.existingTerm',
        label: 'Glossary.existingTerm',
        data: { name: 'existingTerm' },
      },
    ]);

    expect(tree[0].children).toHaveLength(1);
  });

  it('should skip when parent glossary is not in the tree', () => {
    injectMissingInitialOptions(tree, [
      {
        value: 'Unknown.term',
        label: 'Unknown.term',
        data: { name: 'term' },
      },
    ]);

    expect(tree[0].children).toHaveLength(1);
    expect(tree[1].children).toBeUndefined();
  });

  it('should skip single-segment FQN values', () => {
    injectMissingInitialOptions(tree, [
      { value: 'SingleSegment', label: 'SingleSegment' },
    ]);

    expect(tree[0].children).toHaveLength(1);
  });

  it('should use leaf name as fallback when data is absent', () => {
    injectMissingInitialOptions(tree, [
      {
        value: 'AnotherGlossary.fallbackTerm',
        label: 'AnotherGlossary.fallbackTerm',
      },
    ]);

    const injected = tree[1].children?.[0];

    expect(injected?.title).toBe('fallbackTerm');
    expect(injected?.name).toBe('fallbackTerm');
  });

  it('should create children array on parent when it has none', () => {
    expect(tree[1].children).toBeUndefined();

    injectMissingInitialOptions(tree, [
      {
        value: 'AnotherGlossary.newTerm',
        label: 'AnotherGlossary.newTerm',
        data: { name: 'newTerm' },
      },
    ]);

    expect(tree[1].children).toHaveLength(1);
  });

  it('should handle multiple options at once', () => {
    injectMissingInitialOptions(tree, [
      {
        value: 'Glossary.term2',
        label: 'Glossary.term2',
        data: { name: 'term2' },
      },
      {
        value: 'AnotherGlossary.term3',
        label: 'AnotherGlossary.term3',
        data: { name: 'term3' },
      },
    ]);

    expect(tree[0].children).toHaveLength(2);
    expect(tree[1].children).toHaveLength(1);
  });
});
