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
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ReactComponent as TableIcon } from '../../assets/svg/ic-table.svg';
import i18n from '../../utils/i18next/LocalUtil';
import DataQualityPage from './DataQualityPage';
import { DataQualityPageTabs } from './DataQualityPage.interface';

const mockUseParam = { tab: DataQualityPageTabs.TABLES } as {
  tab?: DataQualityPageTabs;
};

// mock components
jest.mock('./DataQualityProvider', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});
jest.mock('../../components/common/LeftPanelCard/LeftPanelCard', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});
const mockComponent = () => <div>TestSuites.component</div>;
jest.mock('./DataQualityClassBase', () => {
  return {
    getLeftSideBar: jest.fn().mockReturnValue([
      {
        key: 'tables',
        label: 'Tables',
        icon: TableIcon,
        iconProps: {
          className: 'side-panel-icons',
        },
      },
    ]),
    getDataQualityTab: jest.fn().mockReturnValue([
      {
        component: mockComponent,
        key: 'tables',
        path: '/data-quality/tables',
      },
    ]),
    getDefaultActiveTab: jest.fn().mockReturnValue('tables'),
    getManageExtraOptions: jest.fn().mockReturnValue([]),
  };
});
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

jest.mock('react-router-dom', () => {
  return {
    ...jest.requireActual('react-router-dom'),
    Route: jest
      .fn()
      .mockImplementation(({ component }) => (
        <div data-testid="route">{component}</div>
      )),
    useParams: jest.fn().mockImplementation(() => mockUseParam),
  };
});

const mockProps = {
  pageTitle: i18n.t('label.data-quality'),
};

describe('DataQualityPage', () => {
  it('component should render', async () => {
    render(<DataQualityPage {...mockProps} />, { wrapper: MemoryRouter });

    expect(await screen.findByTestId('page-title')).toBeInTheDocument();
    expect(await screen.findByTestId('page-sub-title')).toBeInTheDocument();
    expect(await screen.findByTestId('tabs')).toBeInTheDocument();
  });
});
