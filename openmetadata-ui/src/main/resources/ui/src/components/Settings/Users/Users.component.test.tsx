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

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../../generated/settings/settings';
import { useAuth } from '../../../hooks/authHooks';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useFqn } from '../../../hooks/useFqn';
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
  './UsersProfile/UserProfileDetails/UserProfileDetails.component',
  () => {
    return jest
      .fn()
      .mockImplementation(({ afterDeleteAction, updateUserDetails }) => (
        <>
          <div>UserProfileDetails</div>
          <button onClick={afterDeleteAction}>AfterDeleteActionButton</button>
          <button onClick={updateUserDetails}>UpdateUserDetailsButton</button>
        </>
      ));
  }
);

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
  return jest.fn().mockReturnValue(<p>AssetsTabs</p>);
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

describe('Test User Component', () => {
  it('Should render user component', async () => {
    await act(async () => {
      render(<Users userData={mockUserData} {...mockProp} />, {
        wrapper: MemoryRouter,
      });
    });

    const UserProfileDetails = await screen.findByText('UserProfileDetails');

    expect(UserProfileDetails).toBeInTheDocument();
  });

  it('should trigger afterDeleteAction from UserProfileDetails', async () => {
    await act(async () => {
      render(<Users userData={mockUserData} {...mockProp} />, {
        wrapper: MemoryRouter,
      });
    });

    await act(async () => {
      userEvent.click(screen.getByText('AfterDeleteActionButton'));
    });

    expect(mockProp.afterDeleteAction).toHaveBeenCalled();
  });

  it('should trigger updateUserDetails from UserProfileDetails', async () => {
    await act(async () => {
      render(<Users userData={mockUserData} {...mockProp} />, {
        wrapper: MemoryRouter,
      });
    });

    await act(async () => {
      userEvent.click(screen.getByText('UpdateUserDetailsButton'));
    });

    expect(mockProp.updateUserDetails).toHaveBeenCalled();
  });

  it('User profile should render when open collapsible header', async () => {
    await act(async () => {
      render(<Users userData={mockUserData} {...mockProp} />, {
        wrapper: MemoryRouter,
      });
    });

    const collapsibleButton = await screen.findByRole('img');

    userEvent.click(collapsibleButton);

    const UserProfileInheritedRoles = await screen.findByText(
      'UserProfileInheritedRoles'
    );
    const UserProfileRoles = await screen.findByText('UserProfileRoles');
    const UserProfileTeams = await screen.findByText('UserProfileTeams');
    const description = await screen.findByText('Description');

    expect(description).toBeInTheDocument();
    expect(UserProfileRoles).toBeInTheDocument();
    expect(UserProfileTeams).toBeInTheDocument();
    expect(UserProfileInheritedRoles).toBeInTheDocument();
  });

  it('should call updateUserDetails on click of SaveDescriptionButton', async () => {
    await act(async () => {
      render(<Users userData={mockUserData} {...mockProp} />, {
        wrapper: MemoryRouter,
      });
    });

    const collapsibleButton = await screen.findByRole('img');

    await act(async () => {
      userEvent.click(collapsibleButton);
    });

    const saveDescriptionButton = await screen.findByText(
      'SaveDescriptionButton'
    );

    await act(async () => {
      userEvent.click(saveDescriptionButton);
    });

    expect(mockProp.updateUserDetails).toHaveBeenCalledWith(
      {
        description: 'testDescription',
      },
      'description'
    );
  });

  it('should call updateUserDetails on click of SavePersonaSelectableListButton', async () => {
    await act(async () => {
      render(<Users userData={mockUserData} {...mockProp} />, {
        wrapper: MemoryRouter,
      });
    });

    const collapsibleButton = await screen.findByRole('img');

    await act(async () => {
      userEvent.click(collapsibleButton);
    });

    const savePersonaSelectableListButton = await screen.findByText(
      'SavePersonaSelectableListButton'
    );

    await act(async () => {
      userEvent.click(savePersonaSelectableListButton);
    });

    expect(mockProp.updateUserDetails).toHaveBeenCalledWith(
      {
        personas: [],
      },
      'personas'
    );
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

  it('should show the edit description button for non admin logged in user profile', async () => {
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

    const collapsibleButton = await screen.findByRole('img');

    userEvent.click(collapsibleButton);

    expect(screen.getByText('Edit Button')).toBeInTheDocument();
  });

  it('should not show the edit description button for admins in user profile page', async () => {
    (useAuth as jest.Mock).mockImplementation(() => ({
      isAdminUser: true,
    }));
    (useFqn as jest.Mock).mockImplementation(() => ({
      fqn: 'test1',
    }));
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

    const collapsibleButton = await screen.findByRole('img');

    userEvent.click(collapsibleButton);

    expect(screen.queryByText('Edit Button')).toBeNull();
  });
});
