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

import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { Metric, MetricType } from '../../../generated/entity/data/metric';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import MetricDetails from './MetricDetails';
import { MetricDetailsProps } from './MetricDetails.interface';

const mockMetricDetails: Metric = {
  id: 'test-metric-id',
  name: 'test-metric',
  displayName: 'Test Metric',
  fullyQualifiedName: 'test.metric',
  description: 'Test metric description',
  version: 0.1,
  updatedAt: 1234567890,
  updatedBy: 'test-user',
  href: 'http://test.com',
  metricType: MetricType.Percentage,
};

const mockProps: MetricDetailsProps = {
  metricDetails: mockMetricDetails,
  metricPermissions: DEFAULT_ENTITY_PERMISSION,
  fetchMetricDetails: jest.fn(),
  onFollowMetric: jest.fn(),
  onMetricUpdate: jest.fn(),
  onToggleDelete: jest.fn(),
  onUnFollowMetric: jest.fn(),
  onUpdateMetricDetails: jest.fn(),
  onVersionChange: jest.fn(),
  onUpdateVote: jest.fn(),
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
    fqn: 'test.metric',
    entityFqn: 'test.metric',
  }),
}));

jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn().mockReturnValue({
    tab: 'overview',
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

const mockGetMetricDetailPageTabs = jest.fn().mockReturnValue([]);
jest.mock('../../../utils/MetricEntityUtils/MetricDetailsClassBase', () => ({
  __esModule: true,
  default: {
    getMetricDetailPageTabs: (...args: unknown[]) =>
      mockGetMetricDetailPageTabs(...args),
  },
}));

jest.mock('../../../utils/CustomizePage/CustomizePageEntityTabUtils', () => ({
  getTabLabelMapFromTabs: jest.fn().mockReturnValue({}),
  getDetailsTabWithNewLabel: jest.fn().mockReturnValue([]),
  checkIfExpandViewSupported: jest.fn().mockReturnValue(false),
}));

describe('MetricDetails component', () => {
  it('should render successfully', () => {
    const { container } = render(<MetricDetails {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    expect(container).toBeInTheDocument();
  });

  it('should pass entity name as pageTitle to PageLayoutV1', () => {
    render(<MetricDetails {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    expect(PageLayoutV1).toHaveBeenCalledWith(
      expect.objectContaining({
        pageTitle: 'testEntityName',
      }),
      expect.anything()
    );
  });

  // Regression coverage for the getDerivedPermissionFlags conversion (Task 8 Batch 9): an
  // explicit per-field deny must win over a bare EditAll grant (explicit-deny-wins) — the old
  // raw/prioritized expressions here already used getPrioritizedEditPermission for these two
  // fields, so this also guards against a future collapse-refactor accidentally reintroducing
  // a bare `EditAll ||` OR.
  it('denies custom-attribute and lineage edit when explicitly denied, even with EditAll true', () => {
    render(
      <MetricDetails
        {...mockProps}
        metricPermissions={
          {
            EditAll: true,
            EditCustomFields: false,
            EditLineage: false,
            ViewAll: true,
          } as OperationPermission
        }
      />,
      { wrapper: MemoryRouter }
    );

    expect(mockGetMetricDetailPageTabs).toHaveBeenCalledWith(
      expect.objectContaining({
        editCustomAttributePermission: false,
        editLineagePermission: false,
      })
    );
  });

  it('grants custom-attribute and lineage edit via EditAll when the field-specific keys are absent', () => {
    render(
      <MetricDetails
        {...mockProps}
        metricPermissions={{ EditAll: true } as OperationPermission}
      />,
      { wrapper: MemoryRouter }
    );

    expect(mockGetMetricDetailPageTabs).toHaveBeenCalledWith(
      expect.objectContaining({
        editCustomAttributePermission: true,
        editLineagePermission: true,
      })
    );
  });

  it('gates edit flags on deleted but leaves view flags ungated', () => {
    render(
      <MetricDetails
        {...mockProps}
        metricDetails={{ ...mockMetricDetails, deleted: true }}
        metricPermissions={
          { EditAll: true, ViewAll: true } as OperationPermission
        }
      />,
      { wrapper: MemoryRouter }
    );

    expect(mockGetMetricDetailPageTabs).toHaveBeenCalledWith(
      expect.objectContaining({
        editCustomAttributePermission: false,
        editLineagePermission: false,
        viewAllPermission: true,
      })
    );
  });
});
