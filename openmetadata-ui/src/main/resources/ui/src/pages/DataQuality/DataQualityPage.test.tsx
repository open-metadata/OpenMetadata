/*
 *  Copyright 2023 Collate.
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
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getDataQualityPagePath } from '../../utils/RouterUtils';
import DataQualityPage from './DataQualityPage';
import { DataQualityPageTabs } from './DataQualityPage.interface';

const mockUseParam = { tab: DataQualityPageTabs.TABLES } as {
  tab?: DataQualityPageTabs;
};
const mockUseHistory = {
  push: jest.fn(),
};

// mock components
jest.mock('../../components/containers/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});
jest.mock(
  '../../components/DataQuality/TestSuites/TestSuites.component',
  () => {
    return {
      TestSuites: jest
        .fn()
        .mockImplementation(() => <div>TestSuites.component</div>),
    };
  }
);
jest.mock('../../components/DataQuality/TestCases/TestCases.component', () => {
  return {
    TestCases: jest
      .fn()
      .mockImplementation(() => <div>TestCases.component</div>),
  };
});
jest.mock('react-router-dom', () => {
  return {
    useParams: jest.fn().mockImplementation(() => mockUseParam),
    useHistory: jest.fn().mockImplementation(() => mockUseHistory),
  };
});

jest.mock(
  '../../components/DataQuality/SummaryPannel/SummaryPanel.component',
  () => ({ SummaryPanel: jest.fn() })
);

jest.mock('../../components/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest
    .fn()
    .mockImplementation(() => ({ permissions: DEFAULT_ENTITY_PERMISSION })),
}));

jest.mock('../../rest/testAPI', () => ({
  getTestCaseExecutionSummary: jest.fn(),
}));

describe('DataQualityPage', () => {
  it('component should render', async () => {
    render(<DataQualityPage />);

    expect(await screen.findByTestId('page-title')).toBeInTheDocument();
    expect(await screen.findByTestId('page-sub-title')).toBeInTheDocument();
    expect(await screen.findByTestId('tabs')).toBeInTheDocument();
    expect(await screen.findByText('TestSuites.component')).toBeInTheDocument();
  });

  it('should render 3 tabs', async () => {
    render(<DataQualityPage />);

    const tabs = await screen.findAllByRole('tab');

    expect(tabs).toHaveLength(3);
  });

  it('should change the tab, onClick of tab', async () => {
    render(<DataQualityPage />);

    const tabs = await screen.findAllByRole('tab');

    expect(await screen.findByText('TestSuites.component')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(tabs[1]);
    });

    expect(mockUseHistory.push).toHaveBeenCalledWith(
      getDataQualityPagePath(DataQualityPageTabs.TEST_CASES)
    );
  });

  it('should render tables tab by default', async () => {
    mockUseParam.tab = undefined;
    render(<DataQualityPage />);

    expect(await screen.findByText('TestSuites.component')).toBeInTheDocument();
  });

  it('should render testCase tab, if active tab is testCase', async () => {
    mockUseParam.tab = DataQualityPageTabs.TEST_CASES;
    render(<DataQualityPage />);

    expect(await screen.findByText('TestCases.component')).toBeInTheDocument();
  });
});
