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

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ProfilerDashboardType } from '../../enums/table.enum';
import { MOCK_TABLE } from '../../mocks/TableData.mock';
import ProfilerDashboard from './ProfilerDashboard';
import {
  ProfilerDashboardProps,
  ProfilerDashboardTab,
} from './profilerDashboard.interface';

const profilerDashboardProps: ProfilerDashboardProps = {
  onTableChange: jest.fn(),
  table: MOCK_TABLE,
  testCases: [],
  profilerData: [],
  fetchProfilerData: jest.fn(),
  fetchTestCases: jest.fn(),
  onTestCaseUpdate: jest.fn(),
};

let mockParam: {
  entityTypeFQN: string;
  dashboardType: ProfilerDashboardType;
  tab?: ProfilerDashboardTab;
} = {
  entityTypeFQN: 'sample_data.ecommerce_db.shopify.dim_address.address_id',
  dashboardType: ProfilerDashboardType.COLUMN,
  tab: ProfilerDashboardTab.PROFILER,
};

const mockHistory = {
  push: jest.fn(),
};

jest.mock('react-router-dom', () => {
  return {
    useParams: jest.fn().mockImplementation(() => mockParam),
    useHistory: jest.fn().mockImplementation(() => mockHistory),
  };
});

jest.mock('../containers/PageLayout', () => {
  return jest
    .fn()
    .mockImplementation(({ children }) => (
      <div data-testid="page-layout-v1">{children}</div>
    ));
});

jest.mock('../common/entityPageInfo/EntityPageInfo', () => {
  return jest
    .fn()
    .mockImplementation(() => <div>EntityPageInfo component</div>);
});

jest.mock('./component/ProfilerTab', () => {
  return jest.fn().mockImplementation(() => <div>ProfilerTab component</div>);
});

jest.mock('./component/DataQualityTab', () => {
  return jest
    .fn()
    .mockImplementation(() => <div>DataQualityTab component</div>);
});

jest.mock('components/PermissionProvider/PermissionProvider', () => {
  return {
    usePermissionProvider: jest.fn().mockImplementation(() => ({
      getEntityPermission: jest.fn().mockImplementation(() => ({
        ViewAll: true,
        ViewBasic: true,
        ViewDataProfile: true,
        ViewTests: true,
        EditAll: true,
        EditTests: true,
      })),
    })),
  };
});

describe('Test ProfilerDashboardPage component', () => {
  beforeEach(() => cleanup());

  it('ProfilerDashboardPage component should render properly for profiler tab', async () => {
    await act(async () => {
      render(<ProfilerDashboard {...profilerDashboardProps} />, {
        wrapper: MemoryRouter,
      });
    });
    const pageContainer = await screen.findByTestId('page-layout-v1');
    const profilerSwitch = await screen.findByTestId('profiler-switch');
    const EntityPageInfo = await screen.findByText('EntityPageInfo component');
    const ProfilerTab = await screen.findByText('ProfilerTab component');
    const selectedTimeFrame = await screen.findByText('Last 3 days');
    const DataQualityTab = screen.queryByText('DataQualityTab component');

    expect(pageContainer).toBeInTheDocument();
    expect(profilerSwitch).toBeInTheDocument();
    expect(EntityPageInfo).toBeInTheDocument();
    expect(ProfilerTab).toBeInTheDocument();
    expect(selectedTimeFrame).toBeInTheDocument();
    expect(DataQualityTab).not.toBeInTheDocument();
  });

  it('ProfilerDashboardPage component should render properly for data quality tab', async () => {
    mockParam = {
      ...mockParam,
      tab: ProfilerDashboardTab.DATA_QUALITY,
    };
    await act(async () => {
      render(<ProfilerDashboard {...profilerDashboardProps} />, {
        wrapper: MemoryRouter,
      });
    });
    const pageContainer = await screen.findByTestId('page-layout-v1');
    const profilerSwitch = await screen.findByTestId('profiler-switch');
    const EntityPageInfo = await screen.findByText('EntityPageInfo component');
    const ProfilerTab = screen.queryByText('ProfilerTab component');
    const DataQualityTab = await screen.findByText('DataQualityTab component');
    const deletedTestSwitch = await screen.findByText('Deleted Tests');
    const statusDropdown = await screen.findByText('Status');

    expect(pageContainer).toBeInTheDocument();
    expect(profilerSwitch).toBeInTheDocument();
    expect(EntityPageInfo).toBeInTheDocument();
    expect(DataQualityTab).toBeInTheDocument();
    expect(deletedTestSwitch).toBeInTheDocument();
    expect(statusDropdown).toBeInTheDocument();
    expect(ProfilerTab).not.toBeInTheDocument();
  });

  it('If tab is not provided profiler tab should be selected default', async () => {
    mockParam = {
      ...mockParam,
      tab: undefined,
    };
    await act(async () => {
      render(<ProfilerDashboard {...profilerDashboardProps} />, {
        wrapper: MemoryRouter,
      });
    });
    const pageContainer = await screen.findByTestId('page-layout-v1');
    const profilerSwitch = await screen.findByTestId('profiler-switch');
    const EntityPageInfo = await screen.findByText('EntityPageInfo component');
    const ProfilerTab = await screen.findByText('ProfilerTab component');
    const selectedTimeFrame = await screen.findByText('Last 3 days');
    const DataQualityTab = screen.queryByText('DataQualityTab component');

    expect(pageContainer).toBeInTheDocument();
    expect(profilerSwitch).toBeInTheDocument();
    expect(EntityPageInfo).toBeInTheDocument();
    expect(ProfilerTab).toBeInTheDocument();
    expect(selectedTimeFrame).toBeInTheDocument();
    expect(DataQualityTab).not.toBeInTheDocument();
  });

  it('Tab change should work properly', async () => {
    await act(async () => {
      render(<ProfilerDashboard {...profilerDashboardProps} />, {
        wrapper: MemoryRouter,
      });
    });

    const dataQualityTabBtn = await screen.findByDisplayValue('Data Quality');
    const profilerTabBtn = await screen.findByDisplayValue('Profiler');
    const summaryTabBtn = await screen.findByDisplayValue('Summary');
    const ProfilerTab = await screen.findByText('ProfilerTab component');
    const DataQualityTab = screen.queryByText('DataQualityTab component');

    expect(ProfilerTab).toBeInTheDocument();
    expect(profilerTabBtn).toBeInTheDocument();
    expect(summaryTabBtn).toBeInTheDocument();
    expect(DataQualityTab).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(dataQualityTabBtn);
    });

    const DQTab = await screen.findByText('DataQualityTab component');

    expect(DQTab).toBeInTheDocument();
    expect(profilerDashboardProps.fetchTestCases).toHaveBeenCalled();
    expect(ProfilerTab).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(profilerTabBtn);
    });
    const profilerContainer = await screen.findByText('ProfilerTab component');

    expect(profilerContainer).toBeInTheDocument();
    expect(profilerDashboardProps.fetchProfilerData).toHaveBeenCalled();
    expect(DQTab).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(summaryTabBtn);
    });

    expect(mockHistory.push).toHaveBeenCalled();
  });

  it('Add test button should work properly', async () => {
    await act(async () => {
      render(<ProfilerDashboard {...profilerDashboardProps} />, {
        wrapper: MemoryRouter,
      });
    });

    const pageContainer = await screen.findByTestId('page-layout-v1');
    const addTest = await screen.findByTestId('add-test');

    expect(pageContainer).toBeInTheDocument();
    expect(addTest).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(addTest);

      expect(mockHistory.push).toHaveBeenCalled();
    });
  });
});
