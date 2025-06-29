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
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ROUTES } from '../../constants/constants';
import SettingsRouter from './SettingsRouter';

jest.mock('../../pages/AddNotificationPage/AddNotificationPage', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue(<div>AddNotificationPage</div>),
}));

jest.mock('../../pages/AlertDetailsPage/AlertDetailsPage', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue(<div>AlertDetailsPage</div>),
}));

jest.mock('../../pages/Application/ApplicationPage', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue(<div>ApplicationPage</div>),
}));

jest.mock('../../pages/BotsPageV1/BotsPageV1.component', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue(<div>BotsPageV1</div>),
}));

jest.mock(
  '../../pages/Configuration/EditLoginConfiguration/EditLoginConfigurationPage',
  () => ({
    __esModule: true,
    default: jest.fn().mockReturnValue(<div>EditLoginConfigurationPage</div>),
  })
);

jest.mock(
  '../../pages/Configuration/LoginConfigurationDetails/LoginConfigurationPage',
  () => ({
    __esModule: true,
    default: jest.fn().mockReturnValue(<div>LoginConfigurationPage</div>),
  })
);

jest.mock('../../pages/CustomPageSettings/CustomPageSettings', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue(<div>CustomPageSettings</div>),
}));

jest.mock('../../pages/CustomPropertiesPageV1/CustomPropertiesPageV1', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue(<div>CustomPropertiesPageV1</div>),
}));

jest.mock(
  '../../pages/EditEmailConfigPage/EditEmailConfigPage.component',
  () => ({
    __esModule: true,
    default: jest.fn().mockReturnValue(<div>EditEmailConfigPage</div>),
  })
);

jest.mock(
  '../../pages/EmailConfigSettingsPage/EmailConfigSettingsPage.component',
  () => ({
    __esModule: true,
    default: jest.fn().mockReturnValue(<div>EmailConfigSettingsPage</div>),
  })
);

jest.mock(
  '../../pages/GlobalSettingPage/GlobalSettingCategory/GlobalSettingCategoryPage',
  () => ({
    __esModule: true,
    default: jest.fn().mockReturnValue(<div>GlobalSettingCategoryPage</div>),
  })
);

jest.mock('../../pages/GlobalSettingPage/GlobalSettingPage', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue(<div>GlobalSettingPage</div>),
}));

jest.mock('../../pages/NotificationListPage/NotificationListPage', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue(<div>NotificationListPage</div>),
}));

jest.mock('../../pages/Persona/PersonaDetailsPage/PersonaDetailsPage', () => ({
  __esModule: true,
  PersonaDetailsPage: jest.fn().mockReturnValue(<div>PersonaDetailsPage</div>),
}));

jest.mock('../../pages/Persona/PersonaListPage/PersonaPage', () => ({
  __esModule: true,
  PersonaPage: jest.fn().mockReturnValue(<div>PersonaPage</div>),
}));

jest.mock('../../pages/PoliciesPage/AddPolicyPage/AddPolicyPage', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue(<div>AddPolicyPage</div>),
}));

jest.mock('../../pages/PoliciesPage/PoliciesDetailPage/AddRulePage', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue(<div>AddRulePage</div>),
}));

jest.mock('../../pages/PoliciesPage/PoliciesDetailPage/EditRulePage', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue(<div>EditRulePage</div>),
}));

jest.mock(
  '../../pages/PoliciesPage/PoliciesDetailPage/PoliciesDetailPage',
  () => ({
    __esModule: true,
    default: jest.fn().mockReturnValue(<div>PoliciesDetailPage</div>),
  })
);

jest.mock('../../pages/PoliciesPage/PoliciesListPage/PoliciesListPage', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue(<div>PoliciesListPage</div>),
}));

jest.mock('../../pages/RolesPage/AddRolePage/AddRolePage', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue(<div>AddRolePage</div>),
}));

jest.mock('../../pages/RolesPage/RolesDetailPage/RolesDetailPage', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue(<div>RolesDetailPage</div>),
}));

jest.mock('../../pages/RolesPage/RolesListPage/RolesListPage', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue(<div>RolesListPage</div>),
}));

jest.mock('../../pages/ServicesPage/ServicesPage', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue(<div>ServicesPage</div>),
}));

jest.mock('../../pages/TeamsPage/ImportTeamsPage/ImportTeamsPage', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue(<div>ImportTeamsPage</div>),
}));

jest.mock('../../pages/TeamsPage/TeamsPage', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue(<div>TeamsPage</div>),
}));

jest.mock('../../pages/UserListPage/UserListPageV1', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue(<div>UserListPageV1</div>),
}));

jest.mock('../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn().mockReturnValue(true),
  userPermissions: {
    hasViewPermissions: jest.fn(() => true),
  },
}));

jest.mock('./AdminProtectedRoute', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(({ children }) => children),
}));

describe.skip('SettingsRouter', () => {
  it('should render GlobalSettingPage component for exact settings route', async () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <SettingsRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('GlobalSettingPage')).toBeInTheDocument();
  });

  it('should render AddRolePage component for add role route', async () => {
    render(
      <MemoryRouter initialEntries={[ROUTES.ADD_ROLE]}>
        <SettingsRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('AddRolePage')).toBeInTheDocument();
  });

  it('should render RolesDetailPage component for roles details route', async () => {
    render(
      <MemoryRouter initialEntries={[`/settings/access/roles/testRole`]}>
        <SettingsRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('RolesDetailPage')).toBeInTheDocument();
  });

  it('should render RolesListPage component for roles list route', async () => {
    render(
      <MemoryRouter initialEntries={[`/settings/access/roles`]}>
        <SettingsRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('RolesListPage')).toBeInTheDocument();
  });

  it('should render AddPolicyPage component for add policy route', async () => {
    render(
      <MemoryRouter initialEntries={[ROUTES.ADD_POLICY]}>
        <SettingsRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('AddPolicyPage')).toBeInTheDocument();
  });

  it('should render AddRulePage component for add rule route', async () => {
    render(
      <MemoryRouter initialEntries={[ROUTES.ADD_POLICY_RULE]}>
        <SettingsRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('AddRulePage')).toBeInTheDocument();
  });

  it('should render EditRulePage component for edit rule route', async () => {
    render(
      <MemoryRouter initialEntries={[ROUTES.EDIT_POLICY_RULE]}>
        <SettingsRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('EditRulePage')).toBeInTheDocument();
  });

  it('should render PoliciesDetailPage component for policies details route', async () => {
    render(
      <MemoryRouter initialEntries={[`/settings/access/policies/testPolicy`]}>
        <SettingsRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('PoliciesDetailPage')).toBeInTheDocument();
  });

  it('should render PoliciesListPage component for policies list route', async () => {
    render(
      <MemoryRouter initialEntries={['/settings/access/policies']}>
        <SettingsRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('PoliciesListPage')).toBeInTheDocument();
  });

  it('should render UserListPageV1 component for user list route', async () => {
    render(
      <MemoryRouter initialEntries={[`/settings/members/users`]}>
        <SettingsRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('UserListPageV1')).toBeInTheDocument();
  });

  it('should render ServicesPage component for services route', async () => {
    render(
      <MemoryRouter initialEntries={[`/settings/services/databases`]}>
        <SettingsRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('ServicesPage')).toBeInTheDocument();
  });

  it('should render TeamsPage component for teams route', async () => {
    render(
      <MemoryRouter initialEntries={[`/settings/members/teams/Organization`]}>
        <SettingsRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('TeamsPage')).toBeInTheDocument();
  });

  it('should render ImportTeamsPage component for import teams route', async () => {
    render(
      <MemoryRouter
        initialEntries={[
          `/settings/members/teams/Organization/import?type=teams`,
        ]}>
        <SettingsRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('ImportTeamsPage')).toBeInTheDocument();
  });

  it('should render CustomPropertiesPageV1 component for custom properties route', async () => {
    render(
      <MemoryRouter initialEntries={[`/settings/customProperties/table`]}>
        <SettingsRouter />
      </MemoryRouter>
    );

    expect(
      await screen.findByText('CustomPropertiesPageV1')
    ).toBeInTheDocument();
  });

  it.skip('should render CustomPageSettings component for custom page settings route', async () => {
    render(
      <MemoryRouter
        initialEntries={[`/settings/preferences/customizeLandingPage`]}>
        <SettingsRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('CustomPageSettings')).toBeInTheDocument();
  });

  it('should render EmailConfigSettingsPage component for email config settings route', async () => {
    render(
      <MemoryRouter initialEntries={[`/settings/preferences/email`]}>
        <SettingsRouter />
      </MemoryRouter>
    );

    expect(
      await screen.findByText('EmailConfigSettingsPage')
    ).toBeInTheDocument();
  });

  it('should render EditEmailConfigPage component for edit email config route', async () => {
    render(
      <MemoryRouter initialEntries={[ROUTES.SETTINGS_EDIT_EMAIL_CONFIG]}>
        <SettingsRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('EditEmailConfigPage')).toBeInTheDocument();
  });

  it('should render LoginConfigurationPage component for login configuration details route', async () => {
    render(
      <MemoryRouter
        initialEntries={[`/settings/preferences/loginConfiguration`]}>
        <SettingsRouter />
      </MemoryRouter>
    );

    expect(
      await screen.findByText('LoginConfigurationPage')
    ).toBeInTheDocument();
  });

  it('should render EditLoginConfigurationPage component for edit login configuration route', async () => {
    render(
      <MemoryRouter initialEntries={[ROUTES.SETTINGS_EDIT_CUSTOM_LOGIN_CONFIG]}>
        <SettingsRouter />
      </MemoryRouter>
    );

    expect(
      await screen.findByText('EditLoginConfigurationPage')
    ).toBeInTheDocument();
  });

  it('should render NotificationListPage component for notification list route', async () => {
    render(
      <MemoryRouter initialEntries={[ROUTES.NOTIFICATION_ALERTS]}>
        <SettingsRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('NotificationListPage')).toBeInTheDocument();
  });

  it('should render AddNotificationPage component for add notification route', async () => {
    render(
      <MemoryRouter initialEntries={[ROUTES.EDIT_NOTIFICATION_ALERTS]}>
        <SettingsRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('AddNotificationPage')).toBeInTheDocument();
  });

  it('should render PersonaPage component for persona list route', async () => {
    render(
      <MemoryRouter initialEntries={[`/settings/persona`]}>
        <SettingsRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('PersonaPage')).toBeInTheDocument();
  });

  it('should render PersonaDetailsPage component for persona details route', async () => {
    render(
      <MemoryRouter initialEntries={[`/settings/persona/testPersona`]}>
        <SettingsRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('PersonaDetailsPage')).toBeInTheDocument();
  });

  it('should render BotsPageV1 component for bots route', async () => {
    render(
      <MemoryRouter initialEntries={[`/settings/bots`]}>
        <SettingsRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('BotsPageV1')).toBeInTheDocument();
  });

  it('should render ApplicationPage component for application route', async () => {
    render(
      <MemoryRouter initialEntries={[`/settings/apps`]}>
        <SettingsRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('ApplicationPage')).toBeInTheDocument();
  });

  it('should render AlertDetailsPage component for alert details route', async () => {
    render(
      <MemoryRouter
        initialEntries={[ROUTES.NOTIFICATION_ALERT_DETAILS_WITH_TAB]}>
        <SettingsRouter />
      </MemoryRouter>
    );

    expect(await screen.findByText('AlertDetailsPage')).toBeInTheDocument();
  });
});
