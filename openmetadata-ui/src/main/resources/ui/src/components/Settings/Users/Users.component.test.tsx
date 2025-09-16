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

import { act, fireEvent, render, screen } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../../generated/settings/settings';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { searchQuery } from '../../../rest/searchAPI';
import { mockAccessData, mockUserData, mockUserRole } from './mocks/User.mocks';
import Users from './Users.component';
import { UserPageTabs } from './Users.interface';

const mockParams = {
  tab: UserPageTabs.ACTIVITY,
};

jest.mock('../../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({ isAdminUser: false }),
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'test' }),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn().mockImplementation(() => mockParams),
}));

jest.mock('../../../rest/rolesAPIV1', () => ({
  getRoles: jest.fn().mockImplementation(() => Promise.resolve(mockUserRole)),
}));

jest.mock(
  './UsersProfile/UserProfileInheritedRoles/UserProfileInheritedRoles.component',
  () => {
    return jest.fn().mockReturnValue(<div>UserProfileInheritedRoles</div>);
  }
);

jest.mock('./UsersProfile/UserProfileRoles/UserProfileRoles.component', () => {
  return jest.fn().mockReturnValue(<div>UserProfileRoles</div>);
});

jest.mock('./UsersProfile/UserProfileTeams/UserProfileTeams.component', () => {
  return jest.fn().mockReturnValue(<div>UserProfileTeams</div>);
});

jest.mock(
  '../../Explore/EntitySummaryPanel/EntitySummaryPanel.component',
  () => {
    return jest.fn().mockReturnValue(<p>EntitySummaryPanel</p>);
  }
);

jest.mock(
  '../../MyData/Persona/PersonaSelectableList/PersonaSelectableList.component',
  () => ({
    PersonaSelectableList: jest.fn().mockImplementation(({ onUpdate }) => (
      <div>
        <p>PersonaSelectableList</p>
        <button onClick={() => onUpdate([])}>
          SavePersonaSelectableListButton
        </button>
      </div>
    )),
  })
);

jest.mock('../../Glossary/GlossaryTerms/tabs/AssetsTabs.component', () => {
  return jest.fn().mockImplementation((props) => {
    React.useEffect(() => {
      if (props.queryFilter === 'my-data') {
        searchQuery({
          searchIndex: ['all'] as any,
          query: '*',
          filters: props.queryFilter,
        });
      }
    }, [props.queryFilter]);

    return <p>AssetsTabs</p>;
  });
});

jest.mock(
  '../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider',
  () => {
    return jest.fn().mockImplementation(({ children }) => <>{children}</>);
  }
);

jest.mock(
  '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.component',
  () => ({
    ActivityFeedTab: jest
      .fn()
      .mockImplementation(() => <>ActivityFeedTabTest</>),
  })
);
jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    authConfig: {
      provider: AuthProvider.Basic,
    },
    currentUser: {
      name: 'test',
    },
  })),
}));

jest.mock('../../PageLayoutV1/PageLayoutV1', () =>
  jest
    .fn()
    .mockImplementation(
      ({
        children,
        leftPanel,
        rightPanel,
      }: {
        children: ReactNode;
        rightPanel: ReactNode;
        leftPanel: ReactNode;
      }) => (
        <div data-testid="PageLayout">
          <div>{leftPanel}</div>
          <div>{rightPanel}</div>
          {children}
        </div>
      )
    )
);

jest.mock('../../common/EntityDescription/DescriptionV1', () => {
  return jest
    .fn()
    .mockImplementation(({ onDescriptionUpdate, hasEditAccess }) => (
      <div>
        <span>Description</span>
        {hasEditAccess && <span>Edit Button</span>}
        <button onClick={() => onDescriptionUpdate('testDescription')}>
          SaveDescriptionButton
        </button>
      </div>
    ));
});

const mockProp = {
  queryFilters: {
    myData: 'my-data',
    following: 'following',
  },
  updateUserDetails: jest.fn(),
  handlePaginate: jest.fn(),
  afterDeleteAction: jest.fn(),
};

jest.mock('../../PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children, leftPanel, rightPanel }) => (
    <div>
      {leftPanel}
      {children}
      {rightPanel}
    </div>
  ))
);

const mockGetResourceLimit = jest.fn().mockResolvedValue({
  configuredLimit: { disabledFields: [] },
});

jest.mock('../../../context/LimitsProvider/useLimitsStore', () => ({
  useLimitStore: jest.fn().mockImplementation(() => ({
    getResourceLimit: mockGetResourceLimit,
  })),
}));

jest.mock('../../ProfileCard/ProfileSectionUserDetailsCard.component', () => {
  return jest.fn().mockImplementation((props) => (
    <div data-testid="profile-section-card">
      <div>ProfileSectionUserDetailsCard</div>
      <button onClick={props.afterDeleteAction}>AfterDeleteActionButton</button>
      <button onClick={props.updateUserDetails}>UpdateUserDetailsButton</button>
    </div>
  ));
});

jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockResolvedValue({
    hits: {
      hits: [],
      total: { value: 0 },
    },
    aggregations: {},
  }),
}));

describe('Test User Component', () => {
  it('Should render user component', async () => {
    await act(async () => {
      render(<Users userData={mockUserData} {...mockProp} />, {
        wrapper: MemoryRouter,
      });
    });

    const profileSection = await screen.findByTestId('profile-section-card');

    expect(profileSection).toBeInTheDocument();
  });

  it('should trigger afterDeleteAction from UserProfileDetails', async () => {
    await act(async () => {
      render(<Users userData={mockUserData} {...mockProp} />, {
        wrapper: MemoryRouter,
      });
    });

    fireEvent.click(screen.getByText('AfterDeleteActionButton'));

    expect(mockProp.afterDeleteAction).toHaveBeenCalled();
  });

  it('should trigger updateUserDetails from UserProfileDetails', async () => {
    await act(async () => {
      render(<Users userData={mockUserData} {...mockProp} />, {
        wrapper: MemoryRouter,
      });
    });

    fireEvent.click(screen.getByText('UpdateUserDetailsButton'));

    expect(mockProp.updateUserDetails).toHaveBeenCalled();
  });

  it('User profile should render Persona, Teams and Domains and Roles', async () => {
    await act(async () => {
      render(<Users userData={mockUserData} {...mockProp} />, {
        wrapper: MemoryRouter,
      });
    });

    const UserProfileRoles = await screen.findByText('UserProfileRoles');
    const UserProfileTeams = await screen.findByText('UserProfileTeams');

    expect(UserProfileRoles).toBeInTheDocument();
    expect(UserProfileTeams).toBeInTheDocument();
  });

  it('Tab should not visible to normal user', async () => {
    await act(async () => {
      render(<Users userData={mockUserData} {...mockProp} />, {
        wrapper: MemoryRouter,
      });
    });

    const tabs = screen.queryByTestId('tab');

    expect(tabs).not.toBeInTheDocument();
  });

  it('Should check if cards are rendered', async () => {
    mockParams.tab = UserPageTabs.MY_DATA;

    await act(async () => {
      render(<Users userData={mockUserData} {...mockProp} />, {
        wrapper: MemoryRouter,
      });
    });

    const datasetContainer = await screen.findByTestId('user-profile');

    expect(datasetContainer).toBeInTheDocument();
  });

  it('MyData tab should load asset component', async () => {
    mockParams.tab = UserPageTabs.MY_DATA;

    await act(async () => {
      render(<Users userData={mockUserData} {...mockProp} />, {
        wrapper: MemoryRouter,
      });
    });
    const assetComponent = await screen.findByText('AssetsTabs');

    expect(assetComponent).toBeInTheDocument();
  });

  it('Following tab should show load asset component', async () => {
    mockParams.tab = UserPageTabs.FOLLOWING;

    await act(async () => {
      render(<Users userData={mockUserData} {...mockProp} />, {
        wrapper: MemoryRouter,
      });
    });
    const assetComponent = await screen.findByText('AssetsTabs');

    expect(assetComponent).toBeInTheDocument();
  });

  it('Access Token tab should show user access component', async () => {
    (useApplicationStore as unknown as jest.Mock).mockImplementationOnce(
      () => ({
        currentUser: {
          name: 'test',
        },
      })
    );
    mockParams.tab = UserPageTabs.ACCESS_TOKEN;

    await act(async () => {
      render(
        <Users
          authenticationMechanism={mockAccessData}
          userData={mockUserData}
          {...mockProp}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });
    const assetComponent = await screen.findByTestId('center-panel');

    expect(assetComponent).toBeInTheDocument();
  });

  it('should disable access token tab, if limit has personalAccessToken as disabledFields', async () => {
    mockGetResourceLimit.mockResolvedValueOnce({
      configuredLimit: { disabledFields: ['personalAccessToken'] },
    });

    await act(async () => {
      render(
        <Users
          authenticationMechanism={mockAccessData}
          userData={mockUserData}
          {...mockProp}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(
      (await screen.findByTestId('access-token'))?.closest('.ant-tabs-tab')
    ).toHaveClass('ant-tabs-tab-disabled');
  });

  it('MyData tab should make query call only once on initial load', async () => {
    mockParams.tab = UserPageTabs.MY_DATA;

    await act(async () => {
      render(<Users userData={mockUserData} {...mockProp} />, {
        wrapper: MemoryRouter,
      });
    });
    const assetComponent = await screen.findByText('AssetsTabs');

    expect(assetComponent).toBeInTheDocument();

    expect(searchQuery).toHaveBeenCalledTimes(1);
  });
});
