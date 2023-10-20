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

import {
  findByTestId,
  findByText,
  queryByTestId,
  render,
} from '@testing-library/react';
import React, { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { mockTeamsData, mockUserData, mockUserRole } from './mocks/User.mocks';
import Users from './Users.component';
import { UserPageTabs } from './Users.interface';

const mockParams = {
  tab: UserPageTabs.ACTIVITY,
};

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn().mockImplementation(() => mockParams),
}));

jest.mock('../../rest/rolesAPIV1', () => ({
  getRoles: jest.fn().mockImplementation(() => Promise.resolve(mockUserRole)),
}));

jest.mock('../common/ProfilePicture/ProfilePicture', () => {
  return jest.fn().mockReturnValue(<p>ProfilePicture</p>);
});

jest.mock(
  './UsersProfile/UserProfileDetails/UserProfileDetails.component',
  () => {
    return jest.fn().mockReturnValue(<div>UserProfileDetails</div>);
  }
);

jest.mock('./UsersProfile/UserProfileImage/UserProfileImage.component', () => {
  return jest.fn().mockReturnValue(<div>UserProfileImage</div>);
});

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

jest.mock('../../components/searched-data/SearchedData', () => {
  return jest.fn().mockReturnValue(<p>SearchedData</p>);
});

jest.mock(
  '../../components/Explore/EntitySummaryPanel/EntitySummaryPanel.component',
  () => {
    return jest.fn().mockReturnValue(<p>EntitySummaryPanel</p>);
  }
);

jest.mock(
  '../Persona/PersonaSelectableList/PersonaSelectableList.component',
  () => ({
    PersonaSelectableList: jest
      .fn()
      .mockReturnValue(<p>PersonaSelectableList</p>),
  })
);

jest.mock('../Glossary/GlossaryTerms/tabs/AssetsTabs.component', () => {
  return jest.fn().mockReturnValue(<p>AssetsTabs</p>);
});

jest.mock(
  '../../components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider',
  () => {
    return jest.fn().mockImplementation(({ children }) => <>{children}</>);
  }
);

jest.mock(
  '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component',
  () => ({
    ActivityFeedTab: jest
      .fn()
      .mockImplementation(() => <>ActivityFeedTabTest</>),
  })
);

jest.mock('../../rest/teamsAPI', () => ({
  getTeams: jest.fn().mockImplementation(() => Promise.resolve(mockTeamsData)),
}));

jest.mock('../containers/PageLayoutV1', () =>
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

jest.mock('../common/description/Description', () => {
  return jest.fn().mockReturnValue(<p>Description</p>);
});
const updateUserDetails = jest.fn();

const mockProp = {
  username: 'test',
  queryFilters: {
    myData: 'my-data',
    following: 'following',
  },
  updateUserDetails,
  handlePaginate: jest.fn(),
};

jest.mock('../../rest/userAPI', () => ({
  checkValidImage: jest.fn().mockImplementation(() => Promise.resolve(true)),
}));

jest.mock('../containers/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children, leftPanel, rightPanel }) => (
    <div>
      {leftPanel}
      {children}
      {rightPanel}
    </div>
  ))
);

describe('Test User Component', () => {
  it('Should render user component', async () => {
    const { container } = render(
      <Users userData={mockUserData} {...mockProp} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const UserProfileDetails = await findByText(
      container,
      'UserProfileDetails'
    );
    const UserProfileImage = await findByText(container, 'UserProfileImage');
    const UserProfileInheritedRoles = await findByText(
      container,
      'UserProfileInheritedRoles'
    );
    const UserProfileRoles = await findByText(container, 'UserProfileRoles');

    const UserProfileTeams = await findByText(container, 'UserProfileTeams');

    expect(UserProfileDetails).toBeInTheDocument();
    expect(UserProfileImage).toBeInTheDocument();
    expect(UserProfileRoles).toBeInTheDocument();
    expect(UserProfileTeams).toBeInTheDocument();
    expect(UserProfileInheritedRoles).toBeInTheDocument();
  });

  it('Tab should not visible to normal user', async () => {
    const { container } = render(
      <Users userData={mockUserData} {...mockProp} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const tabs = queryByTestId(container, 'tab');

    expect(tabs).not.toBeInTheDocument();
  });

  it('Should check if cards are rendered', async () => {
    mockParams.tab = UserPageTabs.MY_DATA;
    const { container } = render(
      <Users userData={mockUserData} {...mockProp} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const datasetContainer = await findByTestId(container, 'table-container');

    expect(datasetContainer).toBeInTheDocument();
  });

  it('MyData tab should load asset component', async () => {
    mockParams.tab = UserPageTabs.MY_DATA;
    const { container } = render(
      <Users userData={mockUserData} {...mockProp} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const assetComponent = await findByText(container, 'AssetsTabs');

    expect(assetComponent).toBeInTheDocument();
  });

  it('Following tab should show load asset component', async () => {
    mockParams.tab = UserPageTabs.FOLLOWING;
    const { container } = render(
      <Users userData={mockUserData} {...mockProp} />,
      {
        wrapper: MemoryRouter,
      }
    );
    const assetComponent = await findByText(container, 'AssetsTabs');

    expect(assetComponent).toBeInTheDocument();
  });
});
