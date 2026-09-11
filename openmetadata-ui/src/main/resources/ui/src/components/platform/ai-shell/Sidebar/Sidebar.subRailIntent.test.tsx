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

import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  ResourceEntity,
  type UIPermission,
} from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../../../../generated/entity/policies/policy';
import { OBSERVABILITY_ROUTES } from '../../../observability/observability.constants';
import { observabilityModule } from '../../../observability/ObservabilityModule/observability.module';
import { AppModule } from '../AppModule.types';
import { useActiveModuleStore } from '../state/useActiveModule';
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

const DATA_QUALITY_PATH = OBSERVABILITY_ROUTES.OBSERVABILITY_DATA_QUALITY_BASE;

const permissionsWith = (testSuiteCreate: boolean): UIPermission =>
  ({
    [ResourceEntity.TEST_SUITE]: { [Operation.Create]: testSuiteCreate },
  } as unknown as UIPermission);

const renderSidebar = () =>
  render(
    <MemoryRouter initialEntries={[DATA_QUALITY_PATH]}>
      <Sidebar />
    </MemoryRouter>
  );

describe('Sidebar collapsed sub-rail', () => {
  beforeEach(() => {
    mockModules = [observabilityModule];
    mockPermissions = permissionsWith(true);
    useActiveModuleStore.setState({ activeModule: 'observability' });
    // The sub-panel defaults to collapsed, so the sub-rail is what renders.
    localStorage.clear();
  });

  afterEach(() => {
    act(() => {
      useActiveModuleStore.setState({ activeModule: null });
    });
  });

  it('renders the sub-rail rather than the sub-panel', () => {
    renderSidebar();

    expect(screen.getByTestId('ask-sub-rail')).toBeInTheDocument();
    expect(screen.queryByTestId('ask-sub-panel')).toBeNull();
  });

  it('omits the intent-only Quick Action CTAs — the rail is navigation-only', () => {
    renderSidebar();

    // An unlabeled "+" in a 65px icon strip can't convey what it creates, and
    // two of them are indistinguishable. Create actions live in the expanded
    // SubPanel's Quick Actions instead (see SubPanel.intent.test.tsx).
    expect(screen.queryByTestId('ask-sub-rail-item-add-test-case')).toBeNull();
    expect(
      screen.queryByTestId('ask-sub-rail-item-add-bundle-suite')
    ).toBeNull();
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
