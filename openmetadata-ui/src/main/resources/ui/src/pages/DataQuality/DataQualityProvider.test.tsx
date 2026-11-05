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

import { act, render, screen, waitFor } from '@testing-library/react';
import {
  fetchEntityCoveredWithDQ,
  fetchTestCaseSummary,
  fetchTotalEntityCount,
} from '../../rest/dataQualityDashboardAPI';
import { DataQualityPageTabs } from './DataQualityPage.interface';
import DataQualityProvider, {
  useDataQualityProvider,
} from './DataQualityProvider';

const mockPermissionsData = {
  permissions: {
    testCase: {
      ViewAll: true,
      ViewBasic: true,
    },
  },
};
const mockUseParam = { tab: DataQualityPageTabs.TEST_CASES } as {
  tab?: DataQualityPageTabs;
};

const mockLocation = {
  search: '',
};
jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => mockPermissionsData,
}));
jest.mock('react-router-dom', () => {
  return {
    // useParams: jest.fn().mockImplementation(() => mockUseParam),
    useNavigate: jest.fn(),
  };
});

jest.mock('../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => mockLocation);
});

jest.mock('../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn().mockImplementation(() => mockUseParam),
}));

jest.mock('../../rest/dataQualityDashboardAPI', () => ({
  fetchTestCaseSummary: jest.fn().mockResolvedValue({
    data: [
      {
        document_count: '4',
        'testCaseResult.testCaseStatus': 'success',
      },
      {
        document_count: '3',
        'testCaseResult.testCaseStatus': 'failed',
      },
      {
        document_count: '1',
        'testCaseResult.testCaseStatus': 'aborted',
      },
    ],
  }),
  fetchEntityCoveredWithDQ: jest.fn().mockResolvedValue({
    data: [{ originEntityFQN: '1' }],
  }),
  fetchTotalEntityCount: jest.fn().mockResolvedValue({
    data: [{ fullyQualifiedName: '29' }],
  }),
}));
jest.mock('../../utils/DataQuality/DataQualityUtils', () => ({
  transformToTestCaseStatusObject: jest.fn().mockImplementation((data) => data),
}));

const MockComponent = () => {
  const { activeTab, isTestCaseSummaryLoading } = useDataQualityProvider();

  return isTestCaseSummaryLoading ? (
    <div>Loader.component</div>
  ) : (
    <div>{activeTab} component</div>
  );
};

const SummaryComponent = () => {
  const { testCaseSummary } = useDataQualityProvider();

  return <div data-testid="healthy-count">{testCaseSummary.healthy}</div>;
};

describe('DataQualityProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseParam.tab = DataQualityPageTabs.TEST_CASES;
    mockLocation.search = '';
  });

  it('renders children without crashing', async () => {
    render(
      <DataQualityProvider>
        <MockComponent />
      </DataQualityProvider>
    );

    expect(await screen.findByText('Loader.component')).toBeInTheDocument();
    expect(await screen.findByText('test-cases component')).toBeInTheDocument();
  });

  it('isTestCaseSummaryLoading condition should work', async () => {
    render(
      <DataQualityProvider>
        <MockComponent />
      </DataQualityProvider>
    );

    // Initially, the loader should be displayed
    expect(screen.getByText('Loader.component')).toBeInTheDocument();

    // After the delay, the loader should be replaced by the component
    expect(await screen.findByText('test-cases component')).toBeInTheDocument();
  });

  it('should call fetchTestCaseSummary, fetchEntityCoveredWithDQ & fetchTotalEntityCount', async () => {
    render(
      <DataQualityProvider>
        <MockComponent />
      </DataQualityProvider>
    );

    expect(await screen.findByText('test-cases component')).toBeInTheDocument();
    expect(fetchTestCaseSummary).toHaveBeenCalledTimes(1);
    expect(fetchEntityCoveredWithDQ).toHaveBeenCalledTimes(2);
    expect(fetchTotalEntityCount).toHaveBeenCalledTimes(1);
  });

  it('should pass every supported test-case filter to the summary requests', async () => {
    mockLocation.search =
      '?testCaseType=column&testCaseStatus=Success&tier=Tier.Tier1' +
      '&tags%5B%5D=PII.Sensitive&testPlatforms%5B%5D=Dbt' +
      '&serviceName=sample_service&dataQualityDimension=Accuracy' +
      '&dataProductFqn=Marketing&tableFqn=sample_service.db.schema.table' +
      '&lastRunRange%5BstartTs%5D=100&lastRunRange%5BendTs%5D=200';

    render(
      <DataQualityProvider>
        <MockComponent />
      </DataQualityProvider>
    );

    expect(await screen.findByText('test-cases component')).toBeInTheDocument();
    expect(fetchTestCaseSummary).toHaveBeenCalledWith({
      dataProductFqns: ['Marketing'],
      dataQualityDimension: 'Accuracy',
      endTs: '200',
      entityFQN: 'sample_service.db.schema.table',
      ownerFqn: undefined,
      serviceName: 'sample_service',
      startTs: '100',
      tags: ['PII.Sensitive'],
      testCaseStatus: 'Success',
      testCaseType: 'column',
      testPlatforms: ['Dbt'],
      tier: ['Tier.Tier1'],
    });
    expect(fetchEntityCoveredWithDQ).toHaveBeenCalledWith(
      {
        dataProductFqns: ['Marketing'],
        dataQualityDimension: 'Accuracy',
        endTs: '200',
        entityFQN: 'sample_service.db.schema.table',
        ownerFqn: undefined,
        serviceName: 'sample_service',
        startTs: '100',
        tags: ['PII.Sensitive'],
        testCaseStatus: 'Success',
        testCaseType: 'column',
        testPlatforms: ['Dbt'],
        tier: ['Tier.Tier1'],
      },
      true
    );
    expect(fetchTotalEntityCount).toHaveBeenCalledWith({
      dataProductFqns: ['Marketing'],
      dataQualityDimension: 'Accuracy',
      endTs: '200',
      entityFQN: 'sample_service.db.schema.table',
      ownerFqn: undefined,
      serviceName: 'sample_service',
      startTs: '100',
      tags: ['PII.Sensitive'],
      testCaseStatus: 'Success',
      testCaseType: 'column',
      testPlatforms: ['Dbt'],
      tier: ['Tier.Tier1'],
    });
  });

  it('should not reload the summary when only the table search changes', async () => {
    mockLocation.search = '?testCaseStatus=Failed';
    const provider = (
      <DataQualityProvider>
        <MockComponent />
      </DataQualityProvider>
    );
    const { rerender } = render(provider);

    expect(await screen.findByText('test-cases component')).toBeInTheDocument();
    expect(fetchTestCaseSummary).toHaveBeenCalledTimes(1);

    mockLocation.search = '?testCaseStatus=Failed&searchValue=orders';
    rerender(
      <DataQualityProvider>
        <MockComponent />
      </DataQualityProvider>
    );

    await waitFor(() => expect(fetchTestCaseSummary).toHaveBeenCalledTimes(1));

    expect(fetchEntityCoveredWithDQ).toHaveBeenCalledTimes(2);
    expect(fetchTotalEntityCount).toHaveBeenCalledTimes(1);
  });

  it('ignores an older summary response after filters change', async () => {
    const deferred = <T,>() => {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((promiseResolve) => {
        resolve = promiseResolve;
      });

      return { promise, resolve };
    };
    const oldSummary = deferred<{ data: [] }>();
    const newSummary = deferred<{ data: [] }>();
    const oldUnhealthy = deferred<{
      data: Array<{ originEntityFQN: string }>;
    }>();
    const oldCoverage = deferred<{
      data: Array<{ originEntityFQN: string }>;
    }>();
    const newUnhealthy = deferred<{
      data: Array<{ originEntityFQN: string }>;
    }>();
    const newCoverage = deferred<{
      data: Array<{ originEntityFQN: string }>;
    }>();
    const oldEntityCount = deferred<{
      data: Array<{ fullyQualifiedName: string }>;
    }>();
    const newEntityCount = deferred<{
      data: Array<{ fullyQualifiedName: string }>;
    }>();

    (fetchTestCaseSummary as jest.Mock)
      .mockReturnValueOnce(oldSummary.promise)
      .mockReturnValueOnce(newSummary.promise);
    (fetchEntityCoveredWithDQ as jest.Mock)
      .mockReturnValueOnce(oldUnhealthy.promise)
      .mockReturnValueOnce(oldCoverage.promise)
      .mockReturnValueOnce(newUnhealthy.promise)
      .mockReturnValueOnce(newCoverage.promise);
    (fetchTotalEntityCount as jest.Mock)
      .mockReturnValueOnce(oldEntityCount.promise)
      .mockReturnValueOnce(newEntityCount.promise);

    mockLocation.search = '?testCaseStatus=Failed';
    const { rerender } = render(
      <DataQualityProvider>
        <SummaryComponent />
      </DataQualityProvider>
    );

    mockLocation.search = '?testCaseStatus=Success';
    rerender(
      <DataQualityProvider>
        <SummaryComponent />
      </DataQualityProvider>
    );

    await act(async () => {
      newSummary.resolve({ data: [] });
      newUnhealthy.resolve({ data: [{ originEntityFQN: '3' }] });
      newCoverage.resolve({ data: [{ originEntityFQN: '20' }] });
      newEntityCount.resolve({ data: [{ fullyQualifiedName: '25' }] });
    });

    await waitFor(() =>
      expect(screen.getByTestId('healthy-count')).toHaveTextContent('17')
    );

    await act(async () => {
      oldSummary.resolve({ data: [] });
      oldUnhealthy.resolve({ data: [{ originEntityFQN: '8' }] });
      oldCoverage.resolve({ data: [{ originEntityFQN: '10' }] });
      oldEntityCount.resolve({ data: [{ fullyQualifiedName: '12' }] });
    });

    await waitFor(() =>
      expect(screen.getByTestId('healthy-count')).toHaveTextContent('17')
    );
  });

  it('should handle different tab values correctly', async () => {
    mockUseParam.tab = DataQualityPageTabs.TEST_SUITES;

    const MockTabComponent = () => {
      const { activeTab } = useDataQualityProvider();

      return <div>{activeTab} tab component</div>;
    };

    render(
      <DataQualityProvider>
        <MockTabComponent />
      </DataQualityProvider>
    );

    expect(
      await screen.findByText('test-suites tab component')
    ).toBeInTheDocument();
  });

  it('should handle dashboard tab correctly', async () => {
    mockUseParam.tab = DataQualityPageTabs.DASHBOARD;

    // eslint-disable-next-line sonarjs/no-identical-functions -- test harness component
    const MockTabComponent = () => {
      const { activeTab } = useDataQualityProvider();

      return <div>{activeTab} tab component</div>;
    };

    render(
      <DataQualityProvider>
        <MockTabComponent />
      </DataQualityProvider>
    );

    expect(
      await screen.findByText('dashboard tab component')
    ).toBeInTheDocument();
    expect(fetchTestCaseSummary).not.toHaveBeenCalled();
    expect(fetchEntityCoveredWithDQ).not.toHaveBeenCalled();
    expect(fetchTotalEntityCount).not.toHaveBeenCalled();
  });
});
