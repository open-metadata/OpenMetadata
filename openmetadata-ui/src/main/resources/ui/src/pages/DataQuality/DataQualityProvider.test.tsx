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
/* eslint-disable i18next/no-literal-string */
import { act, render, screen } from '@testing-library/react';
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
const mockUseParam = { tab: DataQualityPageTabs.TABLES } as {
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

describe('DataQualityProvider', () => {
  beforeEach(() => {
    render(
      <DataQualityProvider>
        <MockComponent />
      </DataQualityProvider>
    );
  });

  it('renders children without crashing', async () => {
    expect(await screen.findByText('Loader.component')).toBeInTheDocument();
    expect(await screen.findByText('tables component')).toBeInTheDocument();
  });

  it('isTestCaseSummaryLoading condition should work', async () => {
    // Initially, the loader should be displayed
    expect(screen.getByText('Loader.component')).toBeInTheDocument();

    // Advance timers to simulate the API call delay
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // After the delay, the loader should be replaced by the component
    expect(await screen.findByText('tables component')).toBeInTheDocument();
  });

  it('should call fetchTestCaseSummary, fetchEntityCoveredWithDQ & fetchTotalEntityCount', async () => {
    expect(await screen.findByText('tables component')).toBeInTheDocument();
    expect(fetchTestCaseSummary).toHaveBeenCalledTimes(1);
    expect(fetchEntityCoveredWithDQ).toHaveBeenCalledTimes(2);
    expect(fetchTotalEntityCount).toHaveBeenCalledTimes(1);
  });

  it('should call fetchTestCaseSummary, fetchEntityCoveredWithDQ & fetchTotalEntityCount based on prams change', async () => {
    mockLocation.search =
      '?testCaseType=table&testCaseStatus=Success&tier=Tier.Tier1';

    expect(await screen.findByText('tables component')).toBeInTheDocument();
    expect(fetchTestCaseSummary).toHaveBeenCalledWith({
      entityFQN: undefined,
      ownerFqn: undefined,
      testCaseStatus: 'Success',
      testCaseType: 'table',
      tier: ['Tier.Tier1'],
    });
    expect(fetchEntityCoveredWithDQ).toHaveBeenCalledWith(
      {
        entityFQN: undefined,
        ownerFqn: undefined,
        testCaseStatus: 'Success',
        testCaseType: 'table',
        tier: ['Tier.Tier1'],
      },
      true
    );
    expect(fetchTotalEntityCount).toHaveBeenCalledWith({
      entityFQN: undefined,
      ownerFqn: undefined,
      testCaseStatus: 'Success',
      testCaseType: 'table',
      tier: ['Tier.Tier1'],
    });
  });
});
