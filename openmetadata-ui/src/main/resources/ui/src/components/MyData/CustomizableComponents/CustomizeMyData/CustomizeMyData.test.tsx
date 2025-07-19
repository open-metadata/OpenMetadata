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
import { PageType } from '../../../../generated/system/ui/page';
import {
  mockActiveAnnouncementData,
  mockCustomizePageClassBase,
  mockDocumentData,
  mockPersonaName,
  mockUserData,
} from '../../../../mocks/MyDataPage.mock';
import CustomizeMyData from './CustomizeMyData';
import { CustomizeMyDataProps } from './CustomizeMyData.interface';

const mockProps: CustomizeMyDataProps = {
  initialPageData: mockDocumentData.data.pages[0],
  onSaveLayout: jest.fn(),
};

jest.mock(
  '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider',
  () => {
    return jest
      .fn()
      .mockImplementation(({ children }) => (
        <div data-testid="activity-feed-provider">{children}</div>
      ));
  }
);

jest.mock('../CustomiseHomeModal/CustomiseHomeModal', () => {
  return jest.fn().mockImplementation(({ onClose }) => (
    <div>
      CustomiseHomeModal
      <button onClick={onClose}>handleCloseCustomiseHomeModal</button>
    </div>
  ));
});

jest.mock(
  '../../../MyData/CustomizableComponents/EmptyWidgetPlaceholder/EmptyWidgetPlaceholder',
  () => {
    return jest.fn().mockImplementation(({ handleOpenAddWidgetModal }) => (
      <div>
        EmptyWidgetPlaceholder{' '}
        <button onClick={handleOpenAddWidgetModal}>
          handleOpenAddWidgetModal
        </button>
      </div>
    ));
  }
);

jest.mock('../../../../utils/CustomizeMyDataPageClassBase', () => {
  return mockCustomizePageClassBase;
});

jest.mock('../../../PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children, header }) => (
    <div data-testid="page-layout-v1">
      <div data-testid="page-header">{header}</div>
      {children}
    </div>
  ));
});

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    currentUser: mockUserData,
    theme: {
      primaryColor: '#00ff00',
    },
  })),
}));

jest.mock('../../../../rest/feedsAPI', () => ({
  getActiveAnnouncement: jest
    .fn()
    .mockImplementation(() => mockActiveAnnouncementData),
}));

jest.mock('../../../../rest/searchAPI', () => {
  return {
    searchQuery: jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve({ hits: { hits: [], total: { value: 0 } } })
      ),
  };
});

jest.mock('../../../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({ pathname: '/' }));
});

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockImplementation(() => ({
    fqn: mockPersonaName,
    pageFqn: PageType.LandingPage,
  })),
  Link: jest.fn().mockImplementation(() => <div>Link</div>),
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
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

jest.mock('../../../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockImplementation(() => ({ isAuthDisabled: false })),
}));

jest.mock(
  '../../../../components/MyData/CustomizableComponents/CustomizablePageHeader/CustomizablePageHeader',
  () => ({
    CustomizablePageHeader: jest
      .fn()
      .mockImplementation(({ onReset, onSave }) => (
        <div data-testid="customizable-page-header">
          <button data-testid="cancel-button" onClick={onReset}>
            Cancel
          </button>
          <button data-testid="reset-button" onClick={onReset}>
            Reset
          </button>
          <button data-testid="save-button" onClick={onSave}>
            Save
          </button>
        </div>
      )),
  })
);

jest.mock(
  '../../../../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.component',
  () => ({
    AdvanceSearchProvider: jest
      .fn()
      .mockImplementation(({ children }) => (
        <div data-testid="advance-search-provider">{children}</div>
      )),
  })
);

jest.mock('../CustomiseLandingPageHeader/CustomiseLandingPageHeader', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="customise-landing-page-header">
        CustomiseLandingPageHeader
      </div>
    ))
);

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

  it('should call onSaveLayout on reset', async () => {
    await act(async () => {
      render(<CustomizeMyData {...mockProps} />);
    });

    const resetButton = screen.getByTestId('reset-button');

    await act(async () => {
      fireEvent.click(resetButton);
    });

    expect(mockProps.onSaveLayout).toHaveBeenCalled();
  });

  it('CustomizeMyData should call onSaveLayout after clicking on save layout button', async () => {
    await act(async () => {
      render(<CustomizeMyData {...mockProps} />);
    });

    expect(mockProps.onSaveLayout).toHaveBeenCalledTimes(0);

    const saveButton = screen.getByTestId('save-button');

    fireEvent.click(saveButton);

    expect(mockProps.onSaveLayout).toHaveBeenCalledTimes(1);

    expect(screen.queryByTestId('reset-layout-modal')).toBeNull();
  });

  it('CustomizeMyData should display EmptyWidgetPlaceholder', async () => {
    await act(async () => {
      render(<CustomizeMyData {...mockProps} />);
    });

    expect(screen.getByText('EmptyWidgetPlaceholder')).toBeInTheDocument();
  });

  it('CustomizeMyData should display CustomiseHomeModal after handleOpenAddWidgetModal is called', async () => {
    await act(async () => {
      render(<CustomizeMyData {...mockProps} />);
    });

    const addWidgetButton = screen.getByText('handleOpenAddWidgetModal');

    fireEvent.click(addWidgetButton);

    expect(screen.getByText('CustomiseHomeModal')).toBeInTheDocument();
  });

  it('CustomizeMyData should not display CustomiseHomeModal after handleCloseAddWidgetModal is called', async () => {
    await act(async () => {
      render(<CustomizeMyData {...mockProps} />);
    });

    const addWidgetButton = screen.getByText('handleOpenAddWidgetModal');

    fireEvent.click(addWidgetButton);

    expect(screen.getByText('CustomiseHomeModal')).toBeInTheDocument();

    const closeWidgetButton = screen.getByText('handleCloseCustomiseHomeModal');

    fireEvent.click(closeWidgetButton);

    expect(screen.queryByText('CustomiseHomeModal')).toBeNull();
  });
});
