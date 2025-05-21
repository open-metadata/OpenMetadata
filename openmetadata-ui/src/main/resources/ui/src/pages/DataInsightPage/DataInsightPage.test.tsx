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
import i18n from '../../utils/i18next/LocalUtil';
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
  useParams: jest.fn().mockImplementation(() => ({ tab: activeTab })),
}));

jest.mock('../../components/common/ResizablePanels/ResizableLeftPanels', () => {
  return jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
    <div>
      <div>{firstPanel.children}</div>
      <div>{secondPanel.children}</div>
    </div>
  ));
});

jest.mock('../../hoc/withPageLayout', () => ({
  withPageLayout: jest.fn().mockImplementation(
    () =>
      (Component: React.FC) =>
      (
        props: JSX.IntrinsicAttributes & {
          children?: React.ReactNode | undefined;
        }
      ) =>
        <Component {...props} />
  ),
}));

jest.mock('../../utils/DataInsightUtils', () => ({
  getDataInsightPathWithFqn: jest.fn().mockReturnValue('/'),
}));

jest.mock('../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn().mockReturnValue(true),
}));

jest.mock('./DataInsightProvider', () =>
  jest.fn().mockImplementation(({ children }) => <>{children}</>)
);

jest.mock('../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockImplementation(() => <div>ErrorPlaceHolder</div>)
);

jest.mock('./DataInsightHeader/DataInsightHeader.component', () =>
  jest.fn().mockReturnValue(<div>DataInsightHeader.component</div>)
);
const mockComponent = () => <div>dataAssetsComponent</div>;
jest.mock('./DataInsightClassBase', () => ({
  getLeftPanel: jest.fn().mockReturnValue(() => <div>LeftPanel</div>),
  getDataInsightTab: jest.fn().mockReturnValue([
    {
      key: 'data-assets',
      path: '/data-insights/data-assets',
      component: mockComponent,
    },
  ]),
}));

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
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

const mockProps = {
  pageTitle: i18n.t('label.data-insight'),
};

describe('Test DataInsightPage Component', () => {
  it('Should render all child elements', async () => {
    render(<DataInsightPage {...mockProps} />, { wrapper: MemoryRouter });

    expect(
      await screen.findByText('DataInsightHeader.component')
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('data-insight-container')
    ).toBeInTheDocument();
  });
});
