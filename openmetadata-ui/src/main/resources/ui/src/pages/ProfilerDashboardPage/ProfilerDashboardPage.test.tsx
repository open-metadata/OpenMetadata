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

import { act, cleanup, render, screen } from '@testing-library/react';
import { ProfilerDashboardTab } from 'components/ProfilerDashboard/profilerDashboard.interface';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { getTableDetailsByFQN } from 'rest/tableAPI';
import { ProfilerDashboardType } from '../../enums/table.enum';
import { MOCK_TABLE } from '../../mocks/TableData.mock';
import ProfilerDashboardPage from './ProfilerDashboardPage';

let mockParam = {
  entityTypeFQN: 'sample_data.ecommerce_db.shopify.dim_address.address_id',
  dashboardType: ProfilerDashboardType.COLUMN,
  tab: ProfilerDashboardTab.PROFILER,
};

jest.mock('react-router-dom', () => {
  return {
    useParams: jest.fn().mockImplementation(() => mockParam),
  };
});

jest.mock('rest/tableAPI', () => {
  return {
    getColumnProfilerList: jest
      .fn()
      .mockImplementation(() => Promise.resolve({ data: [] })),
    getTableDetailsByFQN: jest
      .fn()
      .mockImplementation(() => Promise.resolve({ data: MOCK_TABLE })),
    patchTableDetails: jest.fn(),
  };
});

jest.mock('rest/testAPI', () => {
  return {
    getListTestCase: jest.fn().mockImplementation(() => Promise.resolve()),
    ListTestCaseParams: jest.fn().mockImplementation(() => Promise.resolve()),
  };
});

jest.mock('components/PermissionProvider/PermissionProvider', () => {
  return {
    usePermissionProvider: jest.fn().mockImplementation(() => ({
      getEntityPermission: jest.fn().mockImplementation(() => ({
        ViewAll: true,
        ViewBasic: true,
        ViewDataProfile: true,
        ViewTests: true,
      })),
    })),
  };
});

jest.mock('components/common/error-with-placeholder/ErrorPlaceHolder', () => {
  return jest.fn().mockImplementation(() => <div>No data placeholder</div>);
});

jest.mock('components/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <p data-testid="loader">Loader</p>);
});

jest.mock('components/ProfilerDashboard/ProfilerDashboard', () => {
  return jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="profiler-dashboard">ProfilerDashboard</div>
    ));
});

describe('Test ProfilerDashboardPage component', () => {
  beforeEach(() => cleanup());

  it('Show error placeholder if table API fails', async () => {
    (getTableDetailsByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.reject()
    );
    await act(async () => {
      render(<ProfilerDashboardPage />, {
        wrapper: MemoryRouter,
      });
    });
    const noDataPlaceholder = await screen.findByText('No data placeholder');

    expect(noDataPlaceholder).toBeInTheDocument();
  });

  it('Show error placeholder if there is no fqn available', async () => {
    mockParam = {
      ...mockParam,
      entityTypeFQN: '',
    };
    await act(async () => {
      render(<ProfilerDashboardPage />, {
        wrapper: MemoryRouter,
      });
    });
    const noDataPlaceholder = await screen.findByText('No data placeholder');

    expect(noDataPlaceholder).toBeInTheDocument();
  });
});
