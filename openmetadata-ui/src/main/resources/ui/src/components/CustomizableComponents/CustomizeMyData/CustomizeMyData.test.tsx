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

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { PageType } from '../../../generated/system/ui/page';
import {
  mockActiveAnnouncementData,
  mockCustomizePageClassBase,
  mockDefaultLayout,
  mockDocumentData,
  mockPersonaName,
  mockUserData,
} from '../../../mocks/MyDataPage.mock';
import { WidgetConfig } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import CustomizeMyData from './CustomizeMyData';
import { CustomizeMyDataProps } from './CustomizeMyData.interface';

const mockPush = jest.fn();

const mockProps: CustomizeMyDataProps = {
  initialPageData: mockDocumentData,
  onSaveLayout: jest.fn(),
  handlePageDataChange: jest.fn(),
  handleSaveCurrentPageLayout: jest.fn(),
};

jest.mock(
  '../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider',
  () => {
    return jest
      .fn()
      .mockImplementation(({ children }) => (
        <div data-testid="activity-feed-provider">{children}</div>
      ));
  }
);

jest.mock('../AddWidgetModal/AddWidgetModal', () => {
  return jest.fn().mockImplementation(({ handleCloseAddWidgetModal }) => (
    <div>
      AddWidgetModal
      <div onClick={handleCloseAddWidgetModal}>handleCloseAddWidgetModal</div>
    </div>
  ));
});

jest.mock('../EmptyWidgetPlaceholder/EmptyWidgetPlaceholder', () => {
  return jest.fn().mockImplementation(({ handleOpenAddWidgetModal }) => (
    <div>
      EmptyWidgetPlaceholder
      <div onClick={handleOpenAddWidgetModal}>handleOpenAddWidgetModal</div>
    </div>
  ));
});

jest.mock('../../../utils/CustomizePageClassBase', () => {
  return mockCustomizePageClassBase;
});

jest.mock('../../PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children, header }) => (
    <div data-testid="page-layout-v1">
      <div data-testid="page-header">{header}</div>
      {children}
    </div>
  ));
});

jest.mock('../../Auth/AuthProviders/AuthProvider', () => ({
  useAuthContext: jest
    .fn()
    .mockImplementation(() => ({ currentUser: mockUserData })),
}));

jest.mock('../../../rest/feedsAPI', () => ({
  getActiveAnnouncement: jest
    .fn()
    .mockImplementation(() => mockActiveAnnouncementData),
}));

jest.mock('../../../rest/userAPI', () => ({
  getUserById: jest.fn().mockImplementation(() => mockUserData),
}));

jest.mock('react-router-dom', () => ({
  useLocation: jest.fn().mockImplementation(() => ({ pathname: '' })),
  useHistory: jest.fn().mockImplementation(() => ({
    push: mockPush,
  })),
  useParams: jest.fn().mockImplementation(() => ({
    fqn: mockPersonaName,
    pageFqn: PageType.LandingPage,
  })),
  Link: jest.fn().mockImplementation(() => <div>Link</div>),
}));

jest.mock('react-grid-layout', () => ({
  WidthProvider: jest
    .fn()
    .mockImplementation(() =>
      jest
        .fn()
        .mockImplementation(({ children }) => (
          <div data-testid="react-grid-layout">{children}</div>
        ))
    ),
  __esModule: true,
  default: '',
}));

jest.mock('../../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockImplementation(() => ({ isAuthDisabled: false })),
}));

describe('CustomizeMyData component', () => {
  it('CustomizeMyData should render the widgets in the page config', async () => {
    await act(async () => {
      render(<CustomizeMyData {...mockProps} />);
    });

    expect(screen.getByText('KnowledgePanel.ActivityFeed')).toBeInTheDocument();
    expect(screen.getByText('KnowledgePanel.Following')).toBeInTheDocument();
    expect(
      screen.getByText('KnowledgePanel.RecentlyViewed')
    ).toBeInTheDocument();
    expect(screen.queryByText('KnowledgePanel.Announcements')).toBeNull();
    expect(screen.queryByText('KnowledgePanel.KPI')).toBeNull();
    expect(screen.queryByText('KnowledgePanel.TotalAssets')).toBeNull();
    expect(screen.queryByText('KnowledgePanel.MyData')).toBeNull();
  });

  it('CustomizeMyData should reroute to the customizable page settings page on click of cancel button', async () => {
    await act(async () => {
      render(<CustomizeMyData {...mockProps} />);
    });

    const cancelButton = screen.getByTestId('cancel-button');

    await act(async () => userEvent.click(cancelButton));

    expect(mockPush).toHaveBeenCalledWith(
      '/settings/openMetadata/customizeLandingPage'
    );
  });

  it('CustomizeMyData should display reset layout confirmation modal on click of reset button', async () => {
    await act(async () => {
      render(<CustomizeMyData {...mockProps} />);
    });

    const resetButton = screen.getByTestId('reset-button');

    await act(async () => userEvent.click(resetButton));

    expect(screen.getByTestId('reset-layout-modal')).toBeInTheDocument();
  });

  it('CustomizeMyData should call handlePageDataChange with default layout and close the reset confirmation modal', async () => {
    await act(async () => {
      render(<CustomizeMyData {...mockProps} />);
    });

    // handlePageDataChange is called 1 time on mount
    expect(mockProps.handlePageDataChange).toHaveBeenCalledTimes(1);

    const resetButton = screen.getByTestId('reset-button');

    await act(async () => userEvent.click(resetButton));

    expect(screen.getByTestId('reset-layout-modal')).toBeInTheDocument();

    const yesButton = screen.getByText('label.yes');

    await act(async () => userEvent.click(yesButton));

    expect(mockProps.handlePageDataChange).toHaveBeenCalledTimes(3);
    // Check if the handlePageDataChange is passed an object with the default layout
    expect(mockProps.handlePageDataChange).toHaveBeenCalledWith(
      expect.objectContaining({
        ...mockDocumentData,
        data: {
          page: {
            layout: expect.arrayContaining<WidgetConfig>(mockDefaultLayout),
          },
        },
      })
    );

    expect(screen.queryByTestId('reset-layout-modal')).toBeNull();
  });

  it('CustomizeMyData should close the reset confirmation modal without calling handlePageDataChange', async () => {
    await act(async () => {
      render(<CustomizeMyData {...mockProps} />);
    });

    // handlePageDataChange is called 1 time on mount
    expect(mockProps.handlePageDataChange).toHaveBeenCalledTimes(1);

    const resetButton = screen.getByTestId('reset-button');

    await act(async () => userEvent.click(resetButton));

    expect(screen.getByTestId('reset-layout-modal')).toBeInTheDocument();

    const noButton = screen.getByText('label.no');

    await act(async () => userEvent.click(noButton));

    // handlePageDataChange is not called again
    expect(mockProps.handlePageDataChange).toHaveBeenCalledTimes(1);

    expect(screen.queryByTestId('reset-layout-modal')).toBeNull();
  });

  it('CustomizeMyData should call onSaveLayout after clicking on save layout button', async () => {
    await act(async () => {
      render(<CustomizeMyData {...mockProps} />);
    });

    expect(mockProps.onSaveLayout).toHaveBeenCalledTimes(0);

    const saveButton = screen.getByTestId('save-button');

    await act(async () => userEvent.click(saveButton));

    expect(mockProps.onSaveLayout).toHaveBeenCalledTimes(1);

    expect(screen.queryByTestId('reset-layout-modal')).toBeNull();
  });

  it('CustomizeMyData should display EmptyWidgetPlaceholder', async () => {
    await act(async () => {
      render(<CustomizeMyData {...mockProps} />);
    });

    expect(screen.getByText('EmptyWidgetPlaceholder')).toBeInTheDocument();
  });

  it('CustomizeMyData should display AddWidgetModal after handleOpenAddWidgetModal is called', async () => {
    await act(async () => {
      render(<CustomizeMyData {...mockProps} />);
    });

    const addWidgetButton = screen.getByText('handleOpenAddWidgetModal');

    await act(async () => userEvent.click(addWidgetButton));

    expect(screen.getByText('AddWidgetModal')).toBeInTheDocument();
  });

  it('CustomizeMyData should not display AddWidgetModal after handleCloseAddWidgetModal is called', async () => {
    await act(async () => {
      render(<CustomizeMyData {...mockProps} />);
    });

    const addWidgetButton = screen.getByText('handleOpenAddWidgetModal');

    await act(async () => userEvent.click(addWidgetButton));

    expect(screen.getByText('AddWidgetModal')).toBeInTheDocument();

    const closeWidgetButton = screen.getByText('handleCloseAddWidgetModal');

    await act(async () => userEvent.click(closeWidgetButton));

    expect(screen.queryByText('AddWidgetModal')).toBeNull();
  });
});
