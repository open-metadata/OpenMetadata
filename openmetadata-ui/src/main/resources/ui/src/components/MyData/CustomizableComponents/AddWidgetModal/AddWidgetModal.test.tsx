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
import { PAGE_SIZE_MEDIUM } from '../../../../constants/constants';
import { mockWidgetsData } from '../../../../mocks/AddWidgetModal.mock';
import { getAllKnowledgePanels } from '../../../../rest/DocStoreAPI';
import AddWidgetModal from './AddWidgetModal';
import { AddWidgetModalProps } from './AddWidgetModal.interface';

const mockProps: AddWidgetModalProps = {
  open: true,
  addedWidgetsList: [],
  handleCloseAddWidgetModal: jest.fn(),
  handleAddWidget: jest.fn(),
  maxGridSizeSupport: 4,
  placeholderWidgetKey: 'placeholderKey',
  handleLayoutUpdate: jest.fn(),
};

jest.mock('../../../common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>Loader</div>)
);

jest.mock('../../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockImplementation(() => <div>ErrorPlaceHolder</div>)
);

jest.mock('./AddWidgetTabContent', () =>
  jest.fn().mockImplementation(({ getAddWidgetHandler }) => (
    <div>
      AddWidgetTabContent
      <div onClick={getAddWidgetHandler(mockWidgetsData.data[0], 3)}>
        getAddWidgetHandler
      </div>
    </div>
  ))
);

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../../rest/DocStoreAPI', () => ({
  getAllKnowledgePanels: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockWidgetsData)),
}));

jest.mock('../../../../utils/CustomizableLandingPageUtils', () => ({
  getWidgetWidthLabelFromKey: jest.fn().mockImplementation((label) => label),
}));

describe('AddWidgetModal component', () => {
  it('AddWidgetModal should not display the modal when open is false', async () => {
    await act(async () => {
      render(<AddWidgetModal {...mockProps} open={false} />);
    });

    expect(screen.queryByTestId('add-widget-modal')).toBeNull();
  });

  it('AddWidgetModal should display all widgets tab from the widgets list', async () => {
    await act(async () => {
      render(<AddWidgetModal {...mockProps} />);
    });

    expect(getAllKnowledgePanels).toHaveBeenCalledWith({
      fqnPrefix: 'KnowledgePanel',
      limit: PAGE_SIZE_MEDIUM,
    });

    expect(
      screen.getByTestId('ActivityFeed-widget-tab-label')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('Following-widget-tab-label')
    ).toBeInTheDocument();
    expect(screen.getByTestId('KPI-widget-tab-label')).toBeInTheDocument();
    expect(screen.getByTestId('MyData-widget-tab-label')).toBeInTheDocument();
    expect(
      screen.getByTestId('RecentlyViewed-widget-tab-label')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('TotalAssets-widget-tab-label')
    ).toBeInTheDocument();
    expect(screen.getByText('AddWidgetTabContent')).toBeInTheDocument();
  });

  it('AddWidgetModal should display check icons in the tab labels only for the tabs included in addedWidgetsList', async () => {
    await act(async () => {
      render(
        <AddWidgetModal
          {...mockProps}
          addedWidgetsList={[
            'KnowledgePanel.ActivityFeed',
            'KnowledgePanel.Following',
          ]}
        />
      );
    });

    expect(screen.getByTestId('ActivityFeed-check-icon')).toBeInTheDocument();
    expect(screen.getByTestId('Following-check-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('KPI-check-icon')).toBeNull();
    expect(screen.queryByTestId('MyData-check-icon')).toBeNull();
    expect(screen.queryByTestId('RecentlyViewed-check-icon')).toBeNull();
    expect(screen.queryByTestId('TotalAssets-check-icon')).toBeNull();
  });

  it('AddWidgetModal should not display check icons in the tab labels only if widget includes EmptyWidgetPlaceholder with it', async () => {
    await act(async () => {
      render(
        <AddWidgetModal
          {...mockProps}
          addedWidgetsList={[
            'KnowledgePanel.ActivityFeed',
            'KnowledgePanel.Following-EmptyWidgetPlaceholder',
          ]}
        />
      );
    });

    expect(screen.getByTestId('ActivityFeed-check-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('Following-check-icon')).toBeNull();
    expect(screen.queryByTestId('KPI-check-icon')).toBeNull();
  });

  it('AddWidgetModal should call handleAddWidget when clicked on add widget button', async () => {
    render(<AddWidgetModal {...mockProps} />);

    const addWidgetButton = await screen.findByText('getAddWidgetHandler');

    expect(addWidgetButton).toBeInTheDocument();

    fireEvent.click(addWidgetButton);

    expect(mockProps.handleAddWidget).toHaveBeenCalledTimes(1);
    expect(mockProps.handleAddWidget).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'ActivityFeed',
      }),
      'placeholderKey',
      3
    );
  });

  it('AddWidgetModal should display ErrorPlaceHolder when API to fetch widgets list is failed', async () => {
    (getAllKnowledgePanels as jest.Mock).mockImplementation(() =>
      Promise.reject(new Error('API Failed'))
    );

    await act(async () => {
      render(<AddWidgetModal {...mockProps} />);
    });

    expect(screen.getByText('ErrorPlaceHolder')).toBeInTheDocument();
  });
});
