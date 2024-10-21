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
import React from 'react';
import { getTestCaseExecutionSummary } from '../../rest/testAPI';
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
jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => mockPermissionsData,
}));
jest.mock('react-router-dom', () => {
  return {
    useParams: jest.fn().mockImplementation(() => mockUseParam),
  };
});
jest.mock('../../rest/testAPI', () => ({
  getTestCaseExecutionSummary: jest.fn().mockImplementation(() => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ data: [] });
      }, 2000); // Simulate a delay
    });
  }),
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

  it('should call getTestCaseExecutionSummary', async () => {
    expect(getTestCaseExecutionSummary).toHaveBeenCalledTimes(1);
  });
});
