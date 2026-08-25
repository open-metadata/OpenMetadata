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
  IconComponent,
  MainNavItem,
  MORE_NAV_KEY,
} from '../../components/platform/ai-shell/Sidebar/navConfig';
import { NavigationItem } from '../../generated/system/ui/uiCustomization';
import {
  getSidebarHiddenKeys,
  getSidebarNavigationItems,
  getSidebarTreeData,
  isValidSidebarTree,
  moveSidebarNode,
  moveSidebarNodeToRoot,
  SidebarTreeNode,
} from './CustomizeAppModeSidebarPage.utils';

jest.mock('../../utils/i18next/LocalUtil', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));

const Icon = (() => null) as unknown as IconComponent;

const makeItems = (keys: string[]): MainNavItem[] =>
  keys.map((key) => ({
    key,
    icon: Icon,
    labelKey: `label.${key}`,
    action: { kind: 'navigate', path: `/${key}` },
  }));

const KEYS = ['a', 'b', 'c'];
const items = makeItems(KEYS);
const VISIBLE = 2;

describe('getSidebarTreeData', () => {
  it('builds the default tree (visible items + a More node) with no customization', () => {
    const tree = getSidebarTreeData(items, null, VISIBLE);

    expect(tree.map((n) => n.key)).toEqual(['a', 'b', MORE_NAV_KEY]);

    const more = tree.find((n) => n.key === MORE_NAV_KEY);

    expect(more?.children?.map((c) => c.key)).toEqual(['c']);
    // More is never a leaf, so items can always be dropped back into it.
    expect(more?.isLeaf).toBe(false);
  });

  it('reflects stored order + the More group, and appends newly-added items', () => {
    const customization: NavigationItem[] = [
      { id: 'b', pageId: 'b', title: 'label.b', isHidden: false },
      {
        id: MORE_NAV_KEY,
        pageId: MORE_NAV_KEY,
        title: 'label.more',
        isHidden: false,
        children: [{ id: 'a', pageId: 'a', title: 'label.a', isHidden: false }],
      },
    ];

    const tree = getSidebarTreeData(items, customization, VISIBLE);

    expect(tree.map((n) => n.key)).toEqual(['b', MORE_NAV_KEY, 'c']);

    const more = tree.find((n) => n.key === MORE_NAV_KEY);

    expect(more?.children?.map((c) => c.key)).toEqual(['a']);
  });

  it('always guarantees a More node even when the stored list omits it', () => {
    const customization: NavigationItem[] = [
      { id: 'a', pageId: 'a', title: 'label.a', isHidden: false },
    ];

    const tree = getSidebarTreeData(items, customization, VISIBLE);

    expect(tree.some((n) => n.key === MORE_NAV_KEY)).toBe(true);
  });
});

describe('getSidebarHiddenKeys', () => {
  it('is empty when there is no customization', () => {
    expect(getSidebarHiddenKeys(items, null)).toEqual([]);
  });

  it('collects explicitly-hidden stored ids plus items missing from a non-empty list', () => {
    const customization: NavigationItem[] = [
      { id: 'a', pageId: 'a', title: 'label.a', isHidden: true },
      // 'b' and 'c' are missing entirely → treated as hidden
    ];

    expect(getSidebarHiddenKeys(items, customization).sort()).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});

describe('getSidebarNavigationItems', () => {
  it('serializes the tree back to NavigationItem[], keeping the i18n key as title', () => {
    const tree: SidebarTreeNode[] = [
      { key: 'a', title: 'A' },
      {
        key: MORE_NAV_KEY,
        title: 'More',
        isLeaf: false,
        children: [{ key: 'b', title: 'B' }],
      },
    ];

    const nav = getSidebarNavigationItems(items, tree, ['b']);

    expect(nav).toEqual([
      { id: 'a', pageId: 'a', title: 'label.a', isHidden: false },
      {
        id: MORE_NAV_KEY,
        pageId: MORE_NAV_KEY,
        title: 'label.more',
        isHidden: false,
        children: [{ id: 'b', pageId: 'b', title: 'label.b', isHidden: true }],
      },
    ]);
  });
});

const leaf = (key: string): SidebarTreeNode => ({ key, title: key });

const more = (children: SidebarTreeNode[]): SidebarTreeNode => ({
  key: MORE_NAV_KEY,
  title: 'More',
  isLeaf: false,
  children,
});

describe('isValidSidebarTree', () => {
  it('accepts top-level leaves and a More node holding leaf children', () => {
    expect(
      isValidSidebarTree([
        leaf('a'),
        { key: MORE_NAV_KEY, title: 'More', children: [leaf('b')] },
      ])
    ).toBe(true);
  });

  it('rejects a non-More node with children', () => {
    expect(
      isValidSidebarTree([{ key: 'a', title: 'A', children: [leaf('b')] }])
    ).toBe(false);
  });

  it('rejects a More node nested inside More', () => {
    expect(
      isValidSidebarTree([
        {
          key: MORE_NAV_KEY,
          title: 'More',
          children: [{ key: MORE_NAV_KEY, title: 'More' }],
        },
      ])
    ).toBe(false);
  });
});

describe('moveSidebarNode', () => {
  it('reorders two top-level items', () => {
    const tree = [leaf('a'), leaf('b'), more([])];
    const next = moveSidebarNode(tree, 'a', 'b', 'after');

    expect(next.map((n) => n.key)).toEqual(['b', 'a', MORE_NAV_KEY]);
  });

  it('nests a top-level item into the More node on an "on" drop', () => {
    const tree = [leaf('a'), leaf('b'), more([])];
    const next = moveSidebarNode(tree, 'a', MORE_NAV_KEY, 'on');

    expect(next.map((n) => n.key)).toEqual(['b', MORE_NAV_KEY]);
    expect(
      next.find((n) => n.key === MORE_NAV_KEY)?.children?.map((c) => c.key)
    ).toEqual(['a']);
  });

  it('moves an item out of More back to the top level', () => {
    const tree = [leaf('a'), more([leaf('b')])];
    const next = moveSidebarNode(tree, 'b', 'a', 'before');

    expect(next.map((n) => n.key)).toEqual(['b', 'a', MORE_NAV_KEY]);
    expect(next.find((n) => n.key === MORE_NAV_KEY)?.children).toEqual([]);
  });

  it('reverts a drop that would nest under a non-More node', () => {
    const tree = [leaf('a'), leaf('b'), more([])];

    expect(moveSidebarNode(tree, 'a', 'b', 'on')).toBe(tree);
  });

  it('is a no-op when source and target are the same', () => {
    const tree = [leaf('a'), more([])];

    expect(moveSidebarNode(tree, 'a', 'a', 'before')).toBe(tree);
  });

  it('returns the original tree for an unknown source key', () => {
    const tree = [leaf('a'), more([])];

    expect(moveSidebarNode(tree, 'missing', 'a', 'before')).toBe(tree);
  });
});

describe('moveSidebarNodeToRoot', () => {
  it('appends a More child to the end of the top level', () => {
    const tree = [leaf('a'), more([leaf('b')])];
    const next = moveSidebarNodeToRoot(tree, 'b');

    expect(next.map((n) => n.key)).toEqual(['a', MORE_NAV_KEY, 'b']);
    expect(next.find((n) => n.key === MORE_NAV_KEY)?.children).toEqual([]);
  });

  it('returns the original tree for an unknown source key', () => {
    const tree = [leaf('a'), more([])];

    expect(moveSidebarNodeToRoot(tree, 'missing')).toBe(tree);
  });
});
