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
import { AppModule, SubNavSection } from '../AppModule.types';
import {
  buildMainNavItems,
  buildSubNavs,
  handleNavItemClick,
  MainNavItem,
  MORE_NAV_KEY,
  MORE_NAV_LABEL_KEY,
  resolveActiveSubNavKey,
  resolveNavHref,
} from './navConfig';

const Icon = () => null;
const ActiveIcon = () => null;

const buildModule = (overrides: Partial<AppModule> = {}): AppModule => ({
  id: 'observability',
  navOrder: 1,
  labelKey: 'label.observability',
  prefix: '/observability',
  defaultPath: '/observability/home',
  routes: [],
  ...overrides,
});

const sections: SubNavSection[] = [
  {
    items: [
      { key: 'overview', labelKey: 'label.overview', path: '/obs' },
      {
        key: 'tests',
        labelKey: 'label.tests',
        path: '/obs/tests',
        activePaths: ['/test-case'],
      },
      { key: 'cta', labelKey: 'label.add', intent: 'add-test-case' },
    ],
  },
];

describe('navConfig', () => {
  it('exposes the synthetic More key and label', () => {
    expect(MORE_NAV_KEY).toBe('more');
    expect(MORE_NAV_LABEL_KEY).toBe('label.more');
  });

  it('resolves the href of a navigate action', () => {
    expect(resolveNavHref({ kind: 'navigate', path: '/x' })).toBe('/x');
  });

  it('builds main nav items only from modules carrying an icon', () => {
    const withSubNav = buildModule({
      icon: Icon,
      activeIcon: ActiveIcon,
      disablePersonaHide: true,
      subNav: { key: 'obs', titleKey: 'label.obs', rootPath: '/o', sections },
    });
    const noIcon = buildModule({ id: 'hidden' });

    const items = buildMainNavItems([withSubNav, noIcon]);

    expect(items).toEqual([
      {
        key: 'observability',
        icon: Icon,
        activeIcon: ActiveIcon,
        labelKey: 'label.observability',
        action: { kind: 'navigate', path: '/observability/home' },
        subNav: 'obs',
        disablePersonaHide: true,
      },
    ]);
  });

  it('builds a sub-nav map keyed by subNav key', () => {
    const subNav = {
      key: 'obs',
      titleKey: 'label.obs',
      rootPath: '/o',
      sections,
    };
    const result = buildSubNavs([
      buildModule({ subNav }),
      buildModule({ id: 'plain' }),
    ]);

    expect(result).toEqual({ obs: subNav });
  });

  it('returns undefined when no sub-nav path matches', () => {
    expect(resolveActiveSubNavKey(sections, '/elsewhere')).toBeUndefined();
  });

  it('matches an exact path and prefers the longest matching path', () => {
    expect(resolveActiveSubNavKey(sections, '/obs')).toBe('overview');
    expect(resolveActiveSubNavKey(sections, '/obs/tests/123')).toBe('tests');
  });

  it('does not treat a sibling path sharing a prefix as a match', () => {
    expect(resolveActiveSubNavKey(sections, '/obsolete')).toBeUndefined();
  });

  it('matches activePaths in addition to path', () => {
    expect(resolveActiveSubNavKey(sections, '/test-case/abc')).toBe('tests');
  });

  it('uses the breadcrumb origin url from location state when present', () => {
    const state = { breadcrumbData: [{ url: '/obs/tests' }] };

    expect(resolveActiveSubNavKey(sections, '/table/fqn', state)).toBe('tests');
  });

  it('falls back to the pathname when breadcrumb url is not a string', () => {
    const state = { breadcrumbData: [{ url: 42 }] };

    expect(resolveActiveSubNavKey(sections, '/obs', state)).toBe('overview');
    expect(resolveActiveSubNavKey(sections, '/obs', null)).toBe('overview');
  });

  it('navigates to the item action path on click', () => {
    const navigate = jest.fn();
    const item: MainNavItem = {
      key: 'k',
      icon: Icon,
      labelKey: 'label.k',
      action: { kind: 'navigate', path: '/k' },
    };

    handleNavItemClick({ item, navigate });

    expect(navigate).toHaveBeenCalledWith('/k');
  });
});
