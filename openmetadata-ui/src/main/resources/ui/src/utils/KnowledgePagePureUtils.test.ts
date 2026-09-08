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
import {
  PageHierarchy,
  PageType,
} from '../interface/knowledge-center.interface';
import {
  getUpdatePageHierarchy,
  remapSubtreeFqn,
  updateTreeData,
} from './KnowledgePagePureUtils';

const buildPage = (
  fullyQualifiedName: string,
  overrides: Partial<PageHierarchy> = {}
): PageHierarchy => ({
  id: fullyQualifiedName,
  name: fullyQualifiedName,
  fullyQualifiedName,
  pageType: PageType.ARTICLE,
  childrenCount: 0,
  ...overrides,
});

describe('updateTreeData', () => {
  it('appends new children under the matching parent', () => {
    const existing = [buildPage('parent', { childrenCount: 1 })];
    const newChildren = [buildPage('parent.child')];

    const result = updateTreeData(existing, newChildren, 'parent');

    expect(result[0].children).toEqual(newChildren);
  });

  it('does not mutate duplicate children when the same parent is updated twice with overlapping results', () => {
    const existing = [buildPage('parent', { childrenCount: 1 })];
    const child = buildPage('parent.child');

    const afterFirstFetch = updateTreeData(existing, [child], 'parent');
    const afterSecondFetch = updateTreeData(afterFirstFetch, [child], 'parent');

    expect(afterSecondFetch[0].children).toHaveLength(1);
    expect(afterSecondFetch[0].children).toEqual([child]);
  });

  it('merges non-overlapping children from a second fetch without dropping the first batch', () => {
    const existing = [buildPage('parent', { childrenCount: 2 })];
    const firstChild = buildPage('parent.child1');
    const secondChild = buildPage('parent.child2');

    const afterFirstFetch = updateTreeData(existing, [firstChild], 'parent');
    const afterSecondFetch = updateTreeData(
      afterFirstFetch,
      [secondChild],
      'parent'
    );

    expect(afterSecondFetch[0].children).toHaveLength(2);
    expect(afterSecondFetch[0].children).toEqual([firstChild, secondChild]);
  });

  it('pushes to the root when no parentKey is provided', () => {
    const existing = [buildPage('root1')];
    const newPages = [buildPage('root2')];

    const result = updateTreeData(existing, newPages);

    expect(result).toHaveLength(2);
  });
});

describe('getUpdatePageHierarchy', () => {
  it('preserves an already-loaded grandchild subtree when a shallow refresh of the parent does not include it', () => {
    // A -> C -> D, where C's subtree was already loaded locally.
    const grandchild = buildPage('A.C.D', { childrenCount: 0 });
    const nodeC = buildPage('A.C', {
      childrenCount: 1,
      children: [grandchild],
    });
    const existing = [buildPage('A', { childrenCount: 1, children: [nodeC] })];

    // A one-level-deep refresh of A's children (e.g. after an unrelated
    // sibling move) returns C without its nested children.
    const shallowRefreshedC = buildPage('A.C', { childrenCount: 1 });

    const result = getUpdatePageHierarchy(
      existing,
      { ...buildPage('A'), children: [shallowRefreshedC] },
      true
    );

    expect(result[0].children).toHaveLength(1);
    expect(result[0].children?.[0].children).toEqual([grandchild]);
  });

  it('drops a child that the authoritative fresh fetch no longer reports, instead of leaving a stale duplicate', () => {
    // A used to have children [B, C]; B was moved out from under A, so a
    // fresh fetch of A's children now only reports C.
    const nodeB = buildPage('A.B');
    const nodeC = buildPage('A.C');
    const existing = [
      buildPage('A', { childrenCount: 2, children: [nodeB, nodeC] }),
    ];

    const result = getUpdatePageHierarchy(
      existing,
      { ...buildPage('A'), children: [nodeC] },
      true
    );

    expect(result[0].children).toEqual([nodeC]);
  });

  it('replaces a child with its fresh version when the fresh fetch does include updated children', () => {
    const existingChild = buildPage('A.C.D');
    const nodeC = buildPage('A.C', {
      childrenCount: 1,
      children: [existingChild],
    });
    const existing = [buildPage('A', { childrenCount: 1, children: [nodeC] })];

    const refreshedChild = buildPage('A.C.D', { displayName: 'Renamed' });
    const refreshedC = buildPage('A.C', {
      childrenCount: 1,
      children: [refreshedChild],
    });

    const result = getUpdatePageHierarchy(
      existing,
      { ...buildPage('A'), children: [refreshedC] },
      true
    );

    expect(result[0].children?.[0].children).toEqual([refreshedChild]);
  });
});

describe('remapSubtreeFqn', () => {
  it('rewrites the fullyQualifiedName prefix at every depth of the subtree', () => {
    const grandchild = buildPage('oldParent.source.child.grandchild');
    const child = buildPage('oldParent.source.child', {
      childrenCount: 1,
      children: [grandchild],
    });

    const result = remapSubtreeFqn(
      [child],
      'oldParent.source',
      'newParent.source'
    );

    expect(result[0].fullyQualifiedName).toBe('newParent.source.child');
    expect(result[0].children?.[0].fullyQualifiedName).toBe(
      'newParent.source.child.grandchild'
    );
  });

  it('leaves nodes without children untouched beyond the FQN rewrite', () => {
    const leaf = buildPage('oldParent.source.leaf');

    const result = remapSubtreeFqn([leaf], 'oldParent.source', 'newParent');

    expect(result[0].fullyQualifiedName).toBe('newParent.leaf');
    expect(result[0].children).toBeUndefined();
  });
});
