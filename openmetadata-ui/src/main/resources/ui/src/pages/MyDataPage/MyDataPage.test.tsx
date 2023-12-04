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
import {
  mockActiveAnnouncementData,
  mockDocumentData,
  mockPersonaName,
  mockUserData,
} from '../../mocks/MyDataPage.mock';
import { getDocumentByFQN } from '../../rest/DocStoreAPI';
import { getActiveAnnouncement } from '../../rest/feedsAPI';
import MyDataPage from './MyDataPage.component';

const mockLocalStorage = (() => {
  let store: Record<string, string> = {};

  return {
    getItem(key: string) {
      return store[key] || '';
    },
    setItem(key: string, value: string) {
      store[key] = value.toString();
    },
    clear() {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

jest.mock(
  '../../components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider',
  () => {
    return jest
      .fn()
      .mockImplementation(({ children }) => (
        <div data-testid="activity-feed-provider">{children}</div>
      ));
  }
);

jest.mock('../../components/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <div>Loader</div>);
});

jest.mock('../../components/Widgets/FeedsWidget/FeedsWidget.component', () => {
  return jest.fn().mockImplementation(() => <div>FeedsWidget</div>);
});

jest.mock('../../components/Widgets/RecentlyViewed/RecentlyViewed', () => {
  return jest.fn().mockImplementation(() => <div>RecentlyViewed</div>);
});

jest.mock('../../components/KPIWidget/KPIWidget.component', () => {
  return jest.fn().mockImplementation(() => <div>KPIWidget</div>);
});

jest.mock(
  '../../components/TotalDataAssetsWidget/TotalDataAssetsWidget.component',
  () => {
    return jest.fn().mockImplementation(() => <div>TotalDataAssetsWidget</div>);
  }
);

jest.mock('../../components/MyData/RightSidebar/AnnouncementsWidget', () => {
  return jest.fn().mockImplementation(() => <div>AnnouncementsWidget</div>);
});

jest.mock('../../components/MyData/RightSidebar/FollowingWidget', () => {
  return jest.fn().mockImplementation(() => <div>FollowingWidget</div>);
});

jest.mock(
  '../../components/MyData/MyDataWidget/MyDataWidget.component',
  () => ({
    MyDataWidget: jest.fn().mockImplementation(() => <div>MyDataWidget</div>),
  })
);

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest
    .fn()
    .mockImplementation(({ children }) => (
      <div data-testid="page-layout-v1">{children}</div>
    ));
});

jest.mock('../../components/WelcomeScreen/WelcomeScreen.component', () => {
  return jest
    .fn()
    .mockImplementation(({ onClose }) => (
      <div onClick={onClose}>WelcomeScreen</div>
    ));
});

jest.mock(
  '../../components/ApplicationConfigProvider/ApplicationConfigProvider',
  () => ({
    useApplicationConfigContext: jest
      .fn()
      .mockImplementation(() => ({ selectedPersona: mockPersonaName })),
  })
);

jest.mock('../../components/Auth/AuthProviders/AuthProvider', () => ({
  useAuthContext: jest
    .fn()
    .mockImplementation(() => ({ currentUser: mockUserData })),
}));

jest.mock('../../rest/DocStoreAPI', () => ({
  getDocumentByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockDocumentData)),
}));

jest.mock('../../rest/feedsAPI', () => ({
  getActiveAnnouncement: jest
    .fn()
    .mockImplementation(() => mockActiveAnnouncementData),
}));

jest.mock('../../rest/userAPI', () => ({
  getUserById: jest.fn().mockImplementation(() => mockUserData),
}));

jest.mock('../../AppState', () => ({
  userDetails: mockUserData,
  users: [mockUserData],
}));

jest.mock('react-router-dom', () => ({
  useLocation: jest.fn().mockImplementation(() => ({ pathname: '' })),
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

jest.mock('../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockImplementation(() => ({ isAuthDisabled: false })),
}));

describe('MyDataPage component', () => {
  beforeEach(() => {
    localStorage.setItem('loggedInUsers', mockUserData.name);
  });

  it('MyDataPage should only display WelcomeScreen when user logs in for the first time', async () => {
    // Simulate no user is logged in condition
    localStorage.clear();

    await act(async () => {
      render(<MyDataPage />);
    });

    expect(screen.getByText('WelcomeScreen')).toBeInTheDocument();
    expect(screen.queryByTestId('activity-feed-provider')).toBeNull();
  });

  it('MyDataPage should display the main content after the WelcomeScreen is closed', async () => {
    // Simulate no user is logged in condition
    localStorage.clear();

    await act(async () => {
      render(<MyDataPage />);
    });
    const welcomeScreen = screen.getByText('WelcomeScreen');

    expect(welcomeScreen).toBeInTheDocument();
    expect(screen.queryByTestId('activity-feed-provider')).toBeNull();

    await act(async () => userEvent.click(welcomeScreen));

    expect(screen.queryByText('WelcomeScreen')).toBeNull();
    expect(screen.getByTestId('activity-feed-provider')).toBeInTheDocument();
    expect(screen.getByTestId('react-grid-layout')).toBeInTheDocument();
  });

  it('MyDataPage should display loader initially while loading data', async () => {
    await act(async () => {
      render(<MyDataPage />);

      expect(screen.queryByText('WelcomeScreen')).toBeNull();
      expect(screen.queryByTestId('react-grid-layout')).toBeNull();
      expect(screen.getByTestId('activity-feed-provider')).toBeInTheDocument();
      expect(screen.getByText('Loader')).toBeInTheDocument();
    });
  });

  it('MyDataPage should display all the widgets in the config and the announcements widget if there are announcements', async () => {
    await act(async () => {
      render(<MyDataPage />);
    });

    expect(screen.getByText('FeedsWidget')).toBeInTheDocument();
    expect(screen.getByText('FollowingWidget')).toBeInTheDocument();
    expect(screen.getByText('RecentlyViewed')).toBeInTheDocument();
    expect(screen.getByText('AnnouncementsWidget')).toBeInTheDocument();
    expect(screen.queryByText('KPIWidget')).toBeNull();
    expect(screen.queryByText('TotalDataAssetsWidget')).toBeNull();
    expect(screen.queryByText('MyDataWidget')).toBeNull();
  });

  it('MyDataPage should not render announcement widget if there are no announcements', async () => {
    (getActiveAnnouncement as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        response: { ...mockActiveAnnouncementData, data: [] },
      })
    );

    await act(async () => {
      render(<MyDataPage />);
    });

    expect(screen.getByText('FeedsWidget')).toBeInTheDocument();
    expect(screen.getByText('FollowingWidget')).toBeInTheDocument();
    expect(screen.getByText('RecentlyViewed')).toBeInTheDocument();
    expect(screen.queryByText('AnnouncementsWidget')).toBeNull();
    expect(screen.queryByText('KPIWidget')).toBeNull();
    expect(screen.queryByText('TotalDataAssetsWidget')).toBeNull();
    expect(screen.queryByText('MyDataWidget')).toBeNull();
  });

  it('MyDataPage should render default widgets when getDocumentByFQN API fails', async () => {
    (getDocumentByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.reject({
        error: 'API failure',
      })
    );

    await act(async () => {
      render(<MyDataPage />);
    });

    expect(screen.getByText('FeedsWidget')).toBeInTheDocument();
    expect(screen.getByText('RecentlyViewed')).toBeInTheDocument();
    expect(screen.getByText('FollowingWidget')).toBeInTheDocument();
    expect(screen.getByText('AnnouncementsWidget')).toBeInTheDocument();
    expect(screen.getByText('KPIWidget')).toBeInTheDocument();
    expect(screen.getByText('TotalDataAssetsWidget')).toBeInTheDocument();
    expect(screen.getByText('MyDataWidget')).toBeInTheDocument();
  });
});
