/*
 *  Copyright 2024 Collate.
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
import {
  LAST_VERSION_FETCH_TIME_KEY,
  ONE_HOUR_MS,
} from '../../constants/constants';
import { getVersion } from '../../rest/miscAPI';
import { getHelpDropdownItems } from '../../utils/NavbarUtils';
import NavBarComponent from './NavBar';

// Place these at the very top of your test file, before any imports!
const mockGetItem = jest.fn();
const mockSetItem = jest.fn();

jest.mock('cookie-storage', () => ({
  CookieStorage: class {
    getItem(...args: any[]) {
      return mockGetItem(...args);
    }
    setItem(...args: any[]) {
      return mockSetItem(...args);
    }
    constructor() {
      // Do nothing
    }
  },
}));

jest.mock('../../utils/NavbarUtils', () => ({
  getHelpDropdownItems: jest.fn().mockReturnValue([]),
}));

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    searchCriteria: '',
    updateSearchCriteria: jest.fn(),
    subscribe: jest.fn(),
  })),
}));

jest.mock('../GlobalSearchBar/GlobalSearchBar', () => ({
  GlobalSearchBar: jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="global-search-bar">GlobalSearchBar</div>
    )),
}));

jest.mock('../../context/WebSocketProvider/WebSocketProvider', () => ({
  useWebSocketConnector: jest.fn().mockImplementation(() => ({
    socket: {
      on: jest.fn(),
      off: jest.fn(),
    },
  })),
}));
jest.mock('../../utils/BrowserNotificationUtils', () => ({
  hasNotificationPermission: jest.fn(),
  shouldRequestPermission: jest.fn(),
}));
jest.mock('../../utils/CommonUtils', () => ({
  refreshPage: jest.fn(),
  getEntityDetailLink: jest.fn(),
  getNameFromFQN: jest.fn().mockImplementation((value) => value),
}));
jest.mock('../../utils/FeedUtils', () => ({
  getEntityFQN: jest.fn().mockReturnValue('entityFQN'),
  getEntityType: jest.fn().mockReturnValue('entityType'),
  prepareFeedLink: jest.fn().mockReturnValue('entity-link'),
}));

jest.mock('../../hooks/useDomainStore', () => ({
  useDomainStore: jest.fn().mockImplementation(() => ({
    domainOptions: jest.fn().mockReturnValue('domainOptions'),
    activeDomain: jest.fn().mockReturnValue('activeDomain'),
    updateActiveDomain: jest.fn(),
  })),
}));

jest.mock('../NotificationBox/NotificationBox.component', () => {
  return jest.fn().mockImplementation(({ onTabChange }) => (
    <div data-testid="tab-change" onClick={onTabChange}>
      tab change
    </div>
  ));
});

jest.mock(
  '../Settings/Users/UserProfileIcon/UserProfileIcon.component',
  () => ({
    UserProfileIcon: jest
      .fn()
      .mockReturnValue(
        <div data-testid="user-profile-icon">UserProfileIcon</div>
      ),
  })
);

const mockUseCustomLocation = {
  search: 'search',
  pathname: '/my-data',
};

jest.mock('../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => mockUseCustomLocation);
});
jest.mock('../AppBar/SearchOptions', () => {
  return jest.fn().mockReturnValue(<div data-testid="cmd">SearchOptions</div>);
});
jest.mock('../AppBar/Suggestions', () => {
  return jest.fn().mockReturnValue(<div data-testid="cmd">Suggestions</div>);
});
jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock('../../context/AsyncDeleteProvider/AsyncDeleteProvider', () => ({
  useAsyncDeleteProvider: jest.fn().mockImplementation(() => ({
    deleteEntity: jest.fn(),
  })),
}));

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),

  Dropdown: jest.fn().mockImplementation(({ dropdownRender }) => {
    return (
      <div data-testid="dropdownRender">
        <div>{dropdownRender}</div>
      </div>
    );
  }),
}));

jest.mock('../../rest/miscAPI', () => ({
  getVersion: jest.fn().mockResolvedValue({
    version: '0.5.0-SNAPSHOT',
  }),
}));

jest.mock('../../utils/ApplicationRoutesClassBase', () => ({
  __esModule: true,
  default: {
    isProtectedRoute: jest.fn().mockReturnValue(false),
  },
}));

jest.mock('../../utils/BrandData/BrandClassBase', () => ({
  __esModule: true,
  default: {
    getBrandName: jest.fn().mockReturnValue('OpenMetadata'),
    getMonogram: jest.fn().mockReturnValue({ src: 'monogram.svg' }),
  },
}));

jest.mock('../../utils/EntityUtilClassBase', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    getEntityName: jest.fn().mockReturnValue('EntityName'),
  })),
}));

jest.mock('../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('MockedEntityName'),
}));

jest.mock(
  '../common/DomainSelectableList/DomainSelectableList.component',
  () => ({
    __esModule: true,
    default: jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="domain-selectable-list">DomainSelectableList</div>
      )),
  })
);

jest.mock(
  '../Entity/EntityExportModalProvider/EntityExportModalProvider.component',
  () => ({
    useEntityExportModalProvider: jest.fn().mockImplementation(() => ({
      onUpdateCSVExportJob: jest.fn(),
    })),
  })
);

jest.mock('./PopupAlertClassBase', () => ({
  __esModule: true,
  default: {
    alertsCards: jest.fn().mockReturnValue([
      {
        key: '1',
        component: jest
          .fn()
          .mockReturnValue(
            <div data-testid="whats-new-alert-card">Alert 1</div>
          ),
      },
    ]),
  },
}));

describe('Test NavBar Component', () => {
  it('Should render NavBar component', async () => {
    render(<NavBarComponent />);

    expect(screen.queryByTestId('global-search-bar')).not.toBeInTheDocument();
    expect(await screen.findByTestId('user-profile-icon')).toBeInTheDocument();
    expect(
      await screen.findByTestId('whats-new-alert-card')
    ).toBeInTheDocument();
  });

  it('should call getVersion onMount', () => {
    render(<NavBarComponent />);

    expect(getVersion).toHaveBeenCalled();
  });

  it('should call getHelpDropdownItems function', async () => {
    render(<NavBarComponent />);

    expect(getHelpDropdownItems).toHaveBeenCalled();
  });

  it('should hide global search bar and domain dropdown on my-data route', () => {
    mockUseCustomLocation.pathname = '/my-data';
    mockUseCustomLocation.search = 'search';

    render(<NavBarComponent />);

    expect(screen.queryByTestId('global-search-bar')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('domain-selectable-list')
    ).not.toBeInTheDocument();
  });

  it('should hide global search bar and domain dropdown on customize-page route', () => {
    mockUseCustomLocation.pathname = '/customize-page/test-domain/test-page';
    mockUseCustomLocation.search = 'search';

    render(<NavBarComponent />);

    expect(screen.getByTestId('global-search-bar')).toBeInTheDocument();
    expect(screen.getByTestId('domain-selectable-list')).toBeInTheDocument();
  });

  it('should show global search bar and domain dropdown on other routes', () => {
    mockUseCustomLocation.pathname = '/explore';
    mockUseCustomLocation.search = 'search';

    render(<NavBarComponent />);

    expect(screen.getByTestId('global-search-bar')).toBeInTheDocument();
    expect(screen.getByTestId('domain-selectable-list')).toBeInTheDocument();
  });

  it('should show global search bar and domain dropdown on settings route', () => {
    mockUseCustomLocation.pathname = '/settings';
    mockUseCustomLocation.search = 'search';

    render(<NavBarComponent />);

    expect(screen.getByTestId('global-search-bar')).toBeInTheDocument();
    expect(screen.getByTestId('domain-selectable-list')).toBeInTheDocument();
  });
});

// --- Tests for handleDocumentVisibilityChange one hour threshold ---
describe('handleDocumentVisibilityChange one hour threshold', () => {
  const OLD_DATE_NOW = Date.now;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    global.Date.now = jest.fn();
  });

  afterEach(() => {
    global.Date.now = OLD_DATE_NOW;
  });

  it('should NOT call getVersion on window focus if less than one hour since last fetch', async () => {
    const now = 2000000;
    const lastFetch = now - (ONE_HOUR_MS - 1000); // less than 1 hour ago
    mockGetItem.mockReturnValue(String(lastFetch));
    jest.spyOn(global.Date, 'now').mockReturnValue(now);

    render(<NavBarComponent />);
    await screen.findByTestId('global-search-bar');

    // Clear the initial getVersion call from mount
    jest.clearAllMocks();

    // Simulate window focus event
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(getVersion).not.toHaveBeenCalled();
  });

  it('should call getVersion and setItem on window focus if more than one hour since last fetch', async () => {
    const now = 3000000;
    const lastFetch = now - (ONE_HOUR_MS + 1000); // more than 1 hour ago
    mockGetItem.mockReturnValue(String(lastFetch));
    (global.Date.now as jest.Mock).mockReturnValue(now);

    render(<NavBarComponent />);
    await screen.findByTestId('global-search-bar');

    // Clear the initial getVersion call from mount
    jest.clearAllMocks();

    // Simulate window focus event
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(getVersion).toHaveBeenCalled();
    expect(mockSetItem).toHaveBeenCalledWith(
      LAST_VERSION_FETCH_TIME_KEY,
      '3000000',
      expect.objectContaining({ expires: expect.any(Date) })
    );
  });

  it('should call getVersion on window focus if no previous fetch time exists', async () => {
    const now = 4000000;
    mockGetItem.mockReturnValue(null); // No previous fetch time
    (global.Date.now as jest.Mock).mockReturnValue(now);

    render(<NavBarComponent />);
    await screen.findByTestId('global-search-bar');

    // Clear the initial getVersion call from mount
    jest.clearAllMocks();

    // Simulate window focus event
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(getVersion).toHaveBeenCalled();
    expect(mockSetItem).toHaveBeenCalledWith(
      LAST_VERSION_FETCH_TIME_KEY,
      '4000000',
      expect.objectContaining({ expires: expect.any(Date) })
    );
  });
});
