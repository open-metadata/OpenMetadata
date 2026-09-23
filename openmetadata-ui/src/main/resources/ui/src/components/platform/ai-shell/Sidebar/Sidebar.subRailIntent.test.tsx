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

import { fireEvent, render, screen, within } from '@testing-library/react';
import { act, SVGProps } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import {
  ResourceEntity,
  type UIPermission,
} from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../../../../generated/entity/policies/policy';
import { OBSERVABILITY_ROUTES } from '../../../observability/observability.constants';
import ObservabilityLayout from '../../../observability/ObservabilityLayout/ObservabilityLayout';
import { observabilityModule } from '../../../observability/ObservabilityModule/observability.module';
import { AppModule, Intent, SubNavItem } from '../AppModule.types';
import { useActiveModuleStore } from '../state/useActiveModule';
import { emitIntent } from '../useIntent';
import Sidebar from './Sidebar';

// Module-scoped values read by the hoisted jest.mock factories at call time
// (i.e. during render), so per-test reassignment takes effect.
let mockModules: AppModule[] = [];
let mockPermissions: UIPermission | undefined;

jest.mock('../sharedAppModules', () => ({
  useAllAppModules: () => mockModules,
}));

jest.mock('./useCustomizedMainNav', () => ({
  useCustomizedMainNav: () => ({ nodes: [] }),
}));

jest.mock('./useContextCenterBadges', () => ({
  useContextCenterBadges: () => undefined,
}));

jest.mock('./MainPanel', () => ({
  __esModule: true,
  default: () => <div data-testid="ask-main-panel" />,
}));

// The main nav is railed inside a sub-context; stub the Rail so this focused
// test doesn't pull in the app-mode extension registry it depends on.
jest.mock('./Rail', () => ({
  __esModule: true,
  default: () => <div data-testid="ask-rail" />,
}));

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({ permissions: mockPermissions }),
}));

// ObservabilityLayout boundaries: the real drawers pull permissions, airflow
// status and the whole test-case form stack, so stub them as open-state probes.
// Only the expanded-panel suite mounts the layout; inert for the collapsed one.
jest.mock('../../../DataQuality/BundleSuiteForm/BundleSuiteFormDrawer', () => ({
  __esModule: true,
  default: ({ open }: { open?: boolean }) => (
    <div data-open={String(open)} data-testid="bundle-suite-drawer" />
  ),
}));

jest.mock(
  '../../../DataQuality/AddDataQualityTest/components/TestCaseFormDrawer',
  () => ({
    __esModule: true,
    default: ({ open }: { open?: boolean }) => (
      <div data-open={String(open)} data-testid="test-case-drawer" />
    ),
  })
);

// The layout re-claims its intent listeners on route reactivation; not driven
// here, so stub the hook to a no-op.
jest.mock('../context/useRouteActivation', () => ({
  useRouteActivation: () => {},
}));

const DATA_QUALITY_PATH = OBSERVABILITY_ROUTES.OBSERVABILITY_DATA_QUALITY_BASE;

const permissionsWith = (testSuiteCreate: boolean): UIPermission =>
  ({
    [ResourceEntity.TEST_SUITE]: { [Operation.Create]: testSuiteCreate },
  } as unknown as UIPermission);

// A pathless item that brings its own rail glyph — the supported
// "action-only rail item" contract SubRail renders as a <button>. The two
// distinct stubs let the test prove railIcon wins over icon in the rail.
const PanelOnlyIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg data-testid="panel-only-icon" {...props} />
);
const RailOnlyIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg data-testid="rail-only-icon" {...props} />
);

const RAIL_ICON_ITEM: SubNavItem = {
  key: 'rail-icon-action',
  icon: PanelOnlyIcon,
  railIcon: RailOnlyIcon,
  labelKey: 'label.add-test-case',
  intent: Intent.UploadFile,
};

// Clone the module with RAIL_ICON_ITEM appended to its Quick Actions section.
const moduleWithRailIconItem = (): AppModule => {
  const { subNav } = observabilityModule;
  if (!subNav) {
    throw new Error('observabilityModule is expected to define subNav');
  }

  const sections = subNav.sections.map((section, index) =>
    index === subNav.sections.length - 1
      ? { ...section, items: [...section.items, RAIL_ICON_ITEM] }
      : section
  );

  return { ...observabilityModule, subNav: { ...subNav, sections } };
};

let lastPathname = '';
const PathnameProbe = () => {
  lastPathname = useLocation().pathname;

  return null;
};

// Collapsed sub-rail: the Sidebar alone is enough, so skip the layout.
const renderSidebar = () => {
  const result = render(
    <MemoryRouter initialEntries={[DATA_QUALITY_PATH]}>
      <Sidebar />
    </MemoryRouter>
  );

  // The submenu now opens expanded on entering a sub-context; collapse it to
  // the sub-rail, which is what these tests exercise.
  fireEvent.click(screen.getByTestId('ask-sub-panel-collapse-btn'));

  return result;
};

// Expanded sub-panel: the Quick Action CTAs are only wired end-to-end through
// ObservabilityLayout, which owns the intent listeners and the drawers the
// assertions read, so this suite mounts the real layout.
const renderExpandedSidebar = () =>
  render(
    <MemoryRouter initialEntries={[DATA_QUALITY_PATH]}>
      <PathnameProbe />
      <ObservabilityLayout>
        <Sidebar />
      </ObservabilityLayout>
    </MemoryRouter>
  );

beforeEach(() => {
  mockModules = [observabilityModule];
  mockPermissions = permissionsWith(true);
  useActiveModuleStore.setState({ activeModule: 'observability' });
  localStorage.clear();
  lastPathname = '';
});

afterEach(() => {
  act(() => {
    useActiveModuleStore.setState({ activeModule: null });
  });
});

describe('Sidebar collapsed sub-rail', () => {
  it('renders the sub-rail rather than the sub-panel', () => {
    renderSidebar();

    expect(screen.getByTestId('ask-sub-rail')).toBeInTheDocument();
    expect(screen.queryByTestId('ask-sub-panel')).toBeNull();
  });

  it('omits the intent-only Quick Action CTAs — the rail is navigation-only', () => {
    renderSidebar();

    // An unlabeled "+" in a 65px icon strip can't convey what it creates, and
    // two of them are indistinguishable. Create actions live in the expanded
    // SubPanel's Quick Actions instead (see the expanded suite below).
    expect(screen.queryByTestId('ask-sub-rail-item-add-test-case')).toBeNull();
    expect(
      screen.queryByTestId('ask-sub-rail-item-add-bundle-suite')
    ).toBeNull();
  });

  it('keeps a pathless item that defines its own railIcon, as a button', () => {
    // Regression guard for the narrowed `!item.path && !item.railIcon` skip:
    // a broad `!item.path` skip would silently drop this supported case.
    mockModules = [moduleWithRailIconItem()];
    renderSidebar();

    const action = screen.getByTestId('ask-sub-rail-item-rail-icon-action');

    // No `path` → renders as the action button branch, not an anchor.
    expect(action.tagName).toBe('BUTTON');
    expect(action).not.toHaveAttribute('href');
    // and it renders the rail-specific glyph, not the `icon` fallback.
    expect(within(action).getByTestId('rail-only-icon')).toBeInTheDocument();
    expect(within(action).queryByTestId('panel-only-icon')).toBeNull();
  });

  it('still renders every path-based sub-nav item as an anchor with its href', () => {
    renderSidebar();

    // Regression guard for the `!item.path` skip: navigable items must be
    // untouched by it.
    const dataQuality = screen.getByTestId('ask-sub-rail-item-data-quality');

    expect(dataQuality.tagName).toBe('A');
    expect(dataQuality).toHaveAttribute('href', DATA_QUALITY_PATH);

    ['incidents', 'alerts', 'pipeline', 'test-library'].forEach((key) => {
      expect(screen.getByTestId(`ask-sub-rail-item-${key}`).tagName).toBe('A');
    });
  });

  it('keeps the nav items when the user lacks TEST_SUITE.Create', () => {
    mockPermissions = permissionsWith(false);
    renderSidebar();

    expect(
      screen.getByTestId('ask-sub-rail-item-data-quality')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('ask-sub-rail-item-add-bundle-suite')
    ).toBeNull();
  });
});

describe('Sidebar expanded sub-panel intent CTAs', () => {
  it('renders the intent-only CTAs as action buttons and keeps both drawers closed', () => {
    renderExpandedSidebar();
    const testCase = screen.getByTestId('ask-sub-panel-item-add-test-case');
    const bundle = screen.getByTestId('ask-sub-panel-item-add-bundle-suite');

    // intent-only items have no `path` → render as <button>, not an anchor.
    expect(testCase.tagName).toBe('BUTTON');
    expect(bundle.tagName).toBe('BUTTON');
    expect(screen.getByTestId('test-case-drawer')).toHaveAttribute(
      'data-open',
      'false'
    );
    expect(screen.getByTestId('bundle-suite-drawer')).toHaveAttribute(
      'data-open',
      'false'
    );
  });

  it('opens the test-case drawer when the add-test-case CTA is clicked', () => {
    renderExpandedSidebar();

    fireEvent.click(screen.getByTestId('ask-sub-panel-item-add-test-case'));

    expect(screen.getByTestId('test-case-drawer')).toHaveAttribute(
      'data-open',
      'true'
    );
    expect(screen.getByTestId('bundle-suite-drawer')).toHaveAttribute(
      'data-open',
      'false'
    );
    // intent-only CTA must not navigate.
    expect(lastPathname).toBe(DATA_QUALITY_PATH);
  });

  it('opens the bundle-suite drawer when the add-bundle-suite CTA is clicked', () => {
    renderExpandedSidebar();

    fireEvent.click(screen.getByTestId('ask-sub-panel-item-add-bundle-suite'));

    expect(screen.getByTestId('bundle-suite-drawer')).toHaveAttribute(
      'data-open',
      'true'
    );
    expect(screen.getByTestId('test-case-drawer')).toHaveAttribute(
      'data-open',
      'false'
    );
    expect(lastPathname).toBe(DATA_QUALITY_PATH);
  });

  it('still renders path-only sub-nav items as anchors with the route href', () => {
    renderExpandedSidebar();
    const dataQuality = screen.getByTestId('ask-sub-panel-item-data-quality');

    // Navigable items keep their href → open-in-new-tab affordances survive.
    expect(dataQuality.tagName).toBe('A');
    expect(dataQuality).toHaveAttribute('href', DATA_QUALITY_PATH);
  });

  it('opens the bundle-suite drawer on a direct emitIntent (listener-wiring control)', () => {
    renderExpandedSidebar();

    act(() => {
      emitIntent(Intent.AddBundleSuite);
    });

    expect(screen.getByTestId('bundle-suite-drawer')).toHaveAttribute(
      'data-open',
      'true'
    );
  });

  it('hides the add-bundle-suite CTA when the user lacks TEST_SUITE.Create', () => {
    mockPermissions = permissionsWith(false);
    renderExpandedSidebar();

    expect(
      screen.queryByTestId('ask-sub-panel-item-add-bundle-suite')
    ).toBeNull();
    expect(
      screen.getByTestId('ask-sub-panel-item-add-test-case')
    ).toBeInTheDocument();
  });

  it('still opens the test-case drawer without TEST_SUITE.Create (ungated CTA)', () => {
    mockPermissions = permissionsWith(false);
    renderExpandedSidebar();

    fireEvent.click(screen.getByTestId('ask-sub-panel-item-add-test-case'));

    expect(screen.getByTestId('test-case-drawer')).toHaveAttribute(
      'data-open',
      'true'
    );
  });

  it('hides the add-bundle-suite CTA while permissions are still loading', () => {
    mockPermissions = undefined;
    renderExpandedSidebar();

    expect(
      screen.queryByTestId('ask-sub-panel-item-add-bundle-suite')
    ).toBeNull();
    expect(
      screen.getByTestId('ask-sub-panel-item-add-test-case')
    ).toBeInTheDocument();
  });
});
