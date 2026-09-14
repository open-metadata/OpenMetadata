/*
 *  Copyright 2022 Collate.
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

import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { Chart, ChartType } from '../../../generated/entity/data/chart';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import ChartDetails from './ChartDetails.component';
import { ChartDetailsProps } from './ChartDetails.interface';

// ChartDetails now fetches its own permissions via useEntityPermissions (Task 8 Batch 9)
// rather than an imperative usePermissionProvider().getEntityPermission(id) call — mock the
// hook directly, mirroring TableDetailsPageV1.test.tsx / MetricDetailsPage.test.tsx's
// setMockPermissions helper. `deleted` is threaded through so the SAME mocked return can
// exercise both the deleted-gated edit flags and the ungated view flags this file destructures
// from the one hook call, exactly as the real hook computes both from a single `deleted` arg.
const mockUseEntityPermissions = jest.fn();

const setMockPermissions = (
  overrides: Partial<OperationPermission> = {},
  {
    isLoading = false,
    error = null as unknown,
    deleted = false,
  }: { isLoading?: boolean; error?: unknown; deleted?: boolean } = {}
) => {
  const permissions = overrides as OperationPermission;
  mockUseEntityPermissions.mockReturnValue({
    permissions,
    isLoading,
    error,
    refresh: jest.fn(),
    ...getDerivedPermissionFlags(permissions, deleted),
  });
};

jest.mock('../../../hooks/useEntityPermissions/useEntityPermissions', () => ({
  useEntityPermissions: (...args: unknown[]) =>
    mockUseEntityPermissions(...args),
}));

const mockChartDetails: Chart = {
  id: 'test-chart-id',
  name: 'test-chart',
  displayName: 'Test Chart',
  fullyQualifiedName: 'test.chart',
  description: 'Test chart description',
  version: 0.1,
  updatedAt: 1234567890,
  updatedBy: 'test-user',
  href: 'http://test.com',
  chartType: ChartType.Line,
  service: {
    id: 'test-service-id',
    type: 'dashboardService',
    name: 'test-service',
    fullyQualifiedName: 'test-service',
    deleted: false,
  },
};

const mockProps: ChartDetailsProps = {
  chartDetails: mockChartDetails,
  updateChartDetailsState: jest.fn(),
  fetchChart: jest.fn(),
  followChartHandler: jest.fn(),
  unFollowChartHandler: jest.fn(),
  versionHandler: jest.fn(),
  onUpdateVote: jest.fn(),
  onChartUpdate: jest.fn(),
  handleToggleDelete: jest.fn(),
};

jest.mock('../../PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('testEntityName'),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    currentUser: {
      id: 'testUser',
    },
  }),
}));

jest.mock('../../../hooks/useCustomPages', () => ({
  useCustomPages: jest.fn().mockReturnValue({
    customizedPage: undefined,
    isLoading: false,
  }),
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({
    fqn: 'test.chart',
    entityFqn: 'test.chart',
  }),
}));

jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn().mockReturnValue({
    tab: 'details',
  }),
}));

jest.mock('../../../utils/FeedUtilsPure', () => ({
  fetchEntityActivityCountInto: jest.fn(),
  fetchEntityTaskCountsInto: jest.fn(),
  getFeedCounts: jest.fn(),
}));

jest.mock(
  '../../DataAssets/DataAssetsHeader/DataAssetsHeader.component',
  () => ({
    DataAssetsHeader: jest.fn().mockReturnValue(<div>DataAssetsHeader</div>),
  })
);

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  GenericProvider: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
}));

jest.mock('../../../hoc/LimitWrapper', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock('../../AppRouter/withActivityFeed', () => ({
  withActivityFeed: jest.fn().mockImplementation((component) => component),
}));

const mockGetChartDetailPageTabs = jest.fn().mockReturnValue([]);
jest.mock('../../../utils/ChartDetailsClassBase', () => ({
  __esModule: true,
  default: {
    getChartDetailPageTabs: (...args: unknown[]) =>
      mockGetChartDetailPageTabs(...args),
  },
}));

jest.mock('../../../utils/CustomizePage/CustomizePageEntityTabUtils', () => ({
  getTabLabelMapFromTabs: jest.fn().mockReturnValue({}),
  getDetailsTabWithNewLabel: jest.fn().mockReturnValue([]),
  checkIfExpandViewSupported: jest.fn().mockReturnValue(false),
}));

describe('ChartDetails component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMockPermissions({ EditAll: true, ViewAll: true });
  });

  it('should render successfully', () => {
    const { container } = render(<ChartDetails {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    expect(container).toBeInTheDocument();
  });

  it('should pass entity name as pageTitle to PageLayoutV1', () => {
    render(<ChartDetails {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    expect(PageLayoutV1).toHaveBeenCalledWith(
      expect.objectContaining({
        pageTitle: 'testEntityName',
      }),
      expect.anything()
    );
  });

  it('should call useEntityPermissions with the CHART resource, entity id, and deleted flag', () => {
    render(<ChartDetails {...mockProps} />, { wrapper: MemoryRouter });

    expect(mockUseEntityPermissions).toHaveBeenCalledWith(
      ResourceEntity.CHART,
      { id: mockChartDetails.id },
      expect.objectContaining({ deleted: false, enabled: true })
    );
  });

  // Regression coverage for the getDerivedPermissionFlags conversion (Task 8 Batch 9): an
  // explicit per-field deny must win over a bare EditAll grant (explicit-deny-wins) — the old
  // raw `EditAll || EditX` OR let EditAll grant unconditionally.
  it('denies lineage edit when EditLineage is explicitly false, even with EditAll true', () => {
    setMockPermissions({ EditAll: true, EditLineage: false, ViewAll: true });

    render(<ChartDetails {...mockProps} />, { wrapper: MemoryRouter });

    expect(mockGetChartDetailPageTabs).toHaveBeenCalledWith(
      expect.objectContaining({ editLineagePermission: false })
    );
  });

  it('denies custom-attribute edit when EditCustomFields is explicitly false, even with EditAll true', () => {
    setMockPermissions({
      EditAll: true,
      EditCustomFields: false,
      ViewAll: true,
    });

    render(<ChartDetails {...mockProps} />, { wrapper: MemoryRouter });

    expect(mockGetChartDetailPageTabs).toHaveBeenCalledWith(
      expect.objectContaining({ editCustomAttributePermission: false })
    );
  });

  it('grants lineage/custom-attribute edit via EditAll when the field-specific keys are absent', () => {
    // Deliberately NOT merged with a full-fixture spread: a fixture defining every Operation
    // key would make getPrioritizedEditPermission's "key present" check see EditLineage/
    // EditCustomFields as explicitly denied rather than truly absent, masking the EditAll
    // fallback this test exists to cover (SchemaTable.test.tsx precedent).
    setMockPermissions({ EditAll: true } as OperationPermission);

    render(<ChartDetails {...mockProps} />, { wrapper: MemoryRouter });

    expect(mockGetChartDetailPageTabs).toHaveBeenCalledWith(
      expect.objectContaining({
        editLineagePermission: true,
        editCustomAttributePermission: true,
      })
    );
  });

  it('gates edit flags on deleted but leaves view flags ungated', () => {
    setMockPermissions({ EditAll: true, ViewAll: true }, { deleted: true });

    render(<ChartDetails {...mockProps} />, { wrapper: MemoryRouter });

    expect(mockGetChartDetailPageTabs).toHaveBeenCalledWith(
      expect.objectContaining({
        editLineagePermission: false,
        editCustomAttributePermission: false,
        viewAllPermission: true,
      })
    );
  });

  it('passes the entity deleted state through to useEntityPermissions', () => {
    render(
      <ChartDetails
        {...mockProps}
        chartDetails={{ ...mockChartDetails, deleted: true }}
      />,
      { wrapper: MemoryRouter }
    );

    expect(mockUseEntityPermissions).toHaveBeenCalledWith(
      ResourceEntity.CHART,
      { id: mockChartDetails.id },
      expect.objectContaining({ deleted: true, enabled: true })
    );
  });
});
