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

import { fireEvent, render, screen } from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import {
  ResourceEntity,
  type UIPermission,
} from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../../../../generated/entity/policies/policy';
import { OBSERVABILITY_ROUTES } from '../../../observability/observability.constants';
import ObservabilityLayout from '../../../observability/ObservabilityLayout/ObservabilityLayout';
import { observabilityModule } from '../../../observability/ObservabilityModule/observability.module';
import { AppModule, Intent } from '../AppModule.types';
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

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({ permissions: mockPermissions }),
}));

// ObservabilityLayout boundaries: the real drawers pull permissions, airflow
// status and the whole test-case form stack, so stub them as open-state probes.
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

let lastPathname = '';
const PathnameProbe = () => {
  lastPathname = useLocation().pathname;

  return null;
};

const permissionsWith = (testSuiteCreate: boolean): UIPermission =>
  ({
    [ResourceEntity.TEST_SUITE]: { [Operation.Create]: testSuiteCreate },
  } as unknown as UIPermission);

const renderShell = () =>
  render(
    <MemoryRouter initialEntries={[DATA_QUALITY_PATH]}>
      <PathnameProbe />
      <ObservabilityLayout>
        <Sidebar />
      </ObservabilityLayout>
    </MemoryRouter>
  );

describe('Sidebar collapsed sub-rail intent CTAs', () => {
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

  it('renders the intent-only CTAs as action buttons and keeps both drawers closed', () => {
    renderShell();
    const testCase = screen.getByTestId('ask-sub-rail-item-add-test-case');
    const bundle = screen.getByTestId('ask-sub-rail-item-add-bundle-suite');

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

  it('opens the test-case drawer when the add-test-case chip is clicked', () => {
    renderShell();

    fireEvent.click(screen.getByTestId('ask-sub-rail-item-add-test-case'));

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

  it('opens the bundle-suite drawer when the add-bundle-suite chip is clicked', () => {
    renderShell();

    fireEvent.click(screen.getByTestId('ask-sub-rail-item-add-bundle-suite'));

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

  it('still renders path-only sub-rail items as anchors with the route href', () => {
    renderShell();
    const dataQuality = screen.getByTestId('ask-sub-rail-item-data-quality');

    // Navigable items keep their href → open-in-new-tab affordances survive.
    expect(dataQuality.tagName).toBe('A');
    expect(dataQuality).toHaveAttribute('href', DATA_QUALITY_PATH);
  });

  it('opens the bundle-suite drawer on a direct emitIntent (listener-wiring control)', () => {
    renderShell();

    act(() => {
      emitIntent(Intent.AddBundleSuite);
    });

    expect(screen.getByTestId('bundle-suite-drawer')).toHaveAttribute(
      'data-open',
      'true'
    );
  });

  it('hides the add-bundle-suite chip when the user lacks TEST_SUITE.Create', () => {
    mockPermissions = permissionsWith(false);
    renderShell();

    expect(
      screen.queryByTestId('ask-sub-rail-item-add-bundle-suite')
    ).toBeNull();
    expect(
      screen.getByTestId('ask-sub-rail-item-add-test-case')
    ).toBeInTheDocument();
  });

  it('still opens the test-case drawer without TEST_SUITE.Create (ungated CTA)', () => {
    mockPermissions = permissionsWith(false);
    renderShell();

    fireEvent.click(screen.getByTestId('ask-sub-rail-item-add-test-case'));

    expect(screen.getByTestId('test-case-drawer')).toHaveAttribute(
      'data-open',
      'true'
    );
  });

  it('hides the add-bundle-suite chip while permissions are still loading', () => {
    mockPermissions = undefined;
    renderShell();

    expect(
      screen.queryByTestId('ask-sub-rail-item-add-bundle-suite')
    ).toBeNull();
    expect(
      screen.getByTestId('ask-sub-rail-item-add-test-case')
    ).toBeInTheDocument();
  });
});
