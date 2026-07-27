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
import { PageHierarchy, PageType } from '../interface/knowledge-center.interface';
import { updateTreeData } from './KnowledgePagePureUtils';

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
    const existing = [
      buildPage('parent', { childrenCount: 1 }),
    ];
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
