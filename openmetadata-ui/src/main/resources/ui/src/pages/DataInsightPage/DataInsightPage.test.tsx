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

import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { DataInsightTabs } from '../../interface/data-insight.interface';
import DataInsightPage from './DataInsightPage.component';

const activeTab = DataInsightTabs.DATA_ASSETS;

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Switch: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
  Route: jest
    .fn()
    .mockImplementation(({ children }) => (
      <div data-testid="route">{children}</div>
    )),
  useHistory: jest.fn().mockReturnValue({ push: jest.fn() }),
  useParams: jest.fn().mockImplementation(() => ({ tab: activeTab })),
}));
jest.mock('../../components/containers/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => <>{children}</>)
);
jest.mock('./DataInsightProvider', () =>
  jest.fn().mockImplementation(({ children }) => <>{children}</>)
);

jest.mock('./KPIList', () =>
  jest.fn().mockReturnValue(<div data-testid="kpi-list">KPI List</div>)
);

jest.mock('./DataInsightLeftPanel/DataInsightLeftPanel', () =>
  jest.fn().mockReturnValue(<div data-testid="left-panel">Left panel</div>)
);
jest.mock('./DataInsightHeader/DataInsightHeader.component', () =>
  jest.fn().mockReturnValue(<div>DataInsightHeader.component</div>)
);
jest.mock(
  '../../components/DataInsightDetail/DataAssetsTab/DataAssetsTab.component',
  () => jest.fn().mockReturnValue(<div>DataAssetsTab.component</div>)
);
const mockComponent = () => <div>dataAssetsComponent</div>;
jest.mock('./DataInsightClassBase', () => ({
  getDataInsightTab: jest.fn().mockReturnValue([
    {
      key: 'data-assets',
      path: '/data-insights/data-assets',
      component: mockComponent,
    },
  ]),
}));

jest.mock('../../components/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    permissions: {
      dataInsightChart: {
        ViewAll: true,
      },
      kpi: {
        ViewAll: true,
      },
    },
  }),
}));

describe('Test DataInsightPage Component', () => {
  it('Should render all child elements', async () => {
    render(<DataInsightPage />, { wrapper: MemoryRouter });

    expect(
      await screen.findByText('DataInsightHeader.component')
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('data-insight-container')
    ).toBeInTheDocument();
  });
});
