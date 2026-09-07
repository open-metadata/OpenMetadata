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
import { NavigationItem } from '../../../../generated/system/ui/uiCustomization';
import { IconComponent, MainNavItem, MORE_NAV_KEY } from './navConfig';
import {
  applySidebarCustomization,
  getDefaultSidebarNavigation,
  MainNavNode,
} from './sidebarCustomization';

const Icon = (() => null) as unknown as IconComponent;

const makeItems = (keys: string[]): MainNavItem[] =>
  keys.map((key) => ({
    key,
    icon: Icon,
    labelKey: `label.${key}`,
    action: { kind: 'navigate', path: `/${key}` },
  }));

const KEYS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];
const items = makeItems(KEYS);
const VISIBLE = 10;

const itemKeys = (nodes: MainNavNode[]): string[] =>
  nodes.flatMap((node) => (node.type === 'item' ? [node.item.key] : ['more']));

const moreChildren = (nodes: MainNavNode[]): string[] => {
  const more = nodes.find((n) => n.type === 'more');

  return more && more.type === 'more' ? more.children.map((c) => c.key) : [];
};

describe('getDefaultSidebarNavigation', () => {
  it('puts the first `visibleCount` items at top level and the rest under More', () => {
    const nav = getDefaultSidebarNavigation(items, VISIBLE);

    // 10 top-level items + a More node
    expect(nav).toHaveLength(VISIBLE + 1);
    expect(nav[VISIBLE].id).toBe(MORE_NAV_KEY);
    expect(nav[VISIBLE].children?.map((c) => c.id)).toEqual(['k', 'l']);
    expect(nav.every((n) => n.isHidden === false)).toBe(true);
  });
});

describe('applySidebarCustomization', () => {
  it('returns the default split when customization is empty/absent', () => {
    const nodes = applySidebarCustomization(items, null, VISIBLE);

    expect(itemKeys(nodes)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      'g',
      'h',
      'i',
      'j',
      'more',
    ]);
    expect(moreChildren(nodes)).toEqual(['k', 'l']);
  });

  it('applies stored order, visibility and the More split', () => {
    const customization: NavigationItem[] = [
      { id: 'c', pageId: 'c', title: 'label.c', isHidden: false },
      { id: 'a', pageId: 'a', title: 'label.a', isHidden: true },
      {
        id: MORE_NAV_KEY,
        pageId: MORE_NAV_KEY,
        title: 'label.more',
        isHidden: false,
        children: [
          { id: 'b', pageId: 'b', title: 'label.b', isHidden: false },
          { id: 'd', pageId: 'd', title: 'label.d', isHidden: true },
        ],
      },
    ];

    const nodes = applySidebarCustomization(items, customization, VISIBLE);

    // 'a' is hidden (dropped); 'c' visible; More holds only the visible child 'b'
    // ('d' hidden → dropped). Remaining items not in the stored list are
    // appended at the top level in their original order.
    expect(itemKeys(nodes).slice(0, 2)).toEqual(['c', 'more']);
    expect(moreChildren(nodes)).toEqual(['b']);
  });

  it('drops stored ids that no longer exist and appends newly-added items', () => {
    const customization: NavigationItem[] = [
      { id: 'gone', pageId: 'gone', title: 'x', isHidden: false },
      { id: 'a', pageId: 'a', title: 'label.a', isHidden: false },
    ];

    const nodes = applySidebarCustomization(items, customization, VISIBLE);

    // 'gone' is not a real item → dropped. 'a' kept. Every other real item is
    // appended so nothing silently disappears.
    const keys = itemKeys(nodes).filter((k) => k !== 'more');

    expect(keys).toContain('a');
    expect(keys).not.toContain('gone');
    expect(keys).toEqual(expect.arrayContaining(KEYS));
  });

  it('drops the whole overflow group when the More node is hidden', () => {
    const customization: NavigationItem[] = [
      { id: 'a', pageId: 'a', title: 'label.a', isHidden: false },
      {
        id: MORE_NAV_KEY,
        pageId: MORE_NAV_KEY,
        title: 'label.more',
        isHidden: true,
        children: [{ id: 'b', pageId: 'b', title: 'label.b', isHidden: false }],
      },
    ];

    const nodes = applySidebarCustomization(items, customization, VISIBLE);

    expect(nodes.some((n) => n.type === 'more')).toBe(false);
  });
});
