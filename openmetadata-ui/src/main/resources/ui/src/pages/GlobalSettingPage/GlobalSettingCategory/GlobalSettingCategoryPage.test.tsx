/*
 *  Copyright 2026 Collate.
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

import { fireEvent, render, screen } from '@testing-library/react';
import { GlobalSettingsMenuCategory } from '../../../constants/GlobalSettings.constants';
import { ALL_SERVICES_CATEGORY } from '../../../constants/Services.constant';
import { ServiceCategory } from '../../../enums/service.enum';
import GlobalSettingCategoryPage from './GlobalSettingCategoryPage';

const mockNavigate = jest.fn();
const mockGetAddServicePath = jest.fn(
  (category: string) => `/${category}/add-service`
);
const mockCheckPermission = jest.fn().mockReturnValue(true);

let mockSettingCategory: string = GlobalSettingsMenuCategory.SERVICES;
let mockPermissions: Record<string, unknown> = { databaseService: {} };

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/settings/services' }),
}));

jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: () => ({ settingCategory: mockSettingCategory }),
}));

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({ permissions: mockPermissions }),
}));

jest.mock(
  '../../../context/AirflowStatusProvider/AirflowStatusProvider',
  () => ({
    useAirflowStatus: () => ({ isFetchingStatus: false }),
  })
);

jest.mock('../../../hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: true }),
}));

jest.mock('../../../utils/ConnectionsRouterClassBase', () => ({
  __esModule: true,
  default: {
    getAddServicePath: (...args: [string]) => mockGetAddServicePath(...args),
    getSettingsServicesPath: jest.fn().mockReturnValue('/services'),
    isEmbeddedMode: jest.fn().mockReturnValue(false),
  },
}));

// Identity mapping keeps the assertions about which resource was checked readable.
// `canCreateAnyServiceCategory` mirrors the real implementation (any category is enough).
jest.mock('../../../utils/ServicePureUtils', () => ({
  getResourceEntityFromServiceCategory: (category: string) => category,
  canCreateAnyServiceCategory: (permissions: unknown) =>
    Object.values(
      jest.requireActual('../../../enums/service.enum').ServiceCategory
    ).some((category) => mockCheckPermission('Create', category, permissions)),
}));

jest.mock('../../../utils/GlobalSettingsClassBase', () => ({
  __esModule: true,
  default: {
    getGlobalSettingsMenuWithPermission: () => [
      {
        category: 'label.service-plural',
        key: 'services',
        description: 'message.service-description',
        items: [],
      },
    ],
  },
}));

jest.mock('../../../utils/GlobalSettingsUtils', () => ({
  getSettingPageEntityBreadCrumb: jest.fn().mockReturnValue([]),
}));

jest.mock('../../../hoc/LimitWrapper', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock(
  '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => jest.fn().mockImplementation(() => <div>TitleBreadcrumb</div>)
);

jest.mock('../../../components/PageHeader/PageHeader.component', () =>
  jest.fn().mockImplementation(() => <div>PageHeader</div>)
);

jest.mock('../../../components/PageLayoutV1/PageLayoutV1', () =>
  jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ))
);

jest.mock(
  '../../../components/Settings/SettingItemCard/SettingItemCard.component',
  () => jest.fn().mockImplementation(() => <div>SettingItemCard</div>)
);

jest.mock(
  '../../../components/common/Skeleton/CommonSkeletons/ControlElements/ControlElements.component',
  () => jest.fn().mockImplementation(() => <div>ButtonSkeleton</div>)
);

describe('GlobalSettingCategoryPage add-service action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckPermission.mockReturnValue(true);
    mockSettingCategory = GlobalSettingsMenuCategory.SERVICES;
    mockPermissions = { databaseService: {} };
  });

  it('opens the wizard on the all sentinel, not a hardcoded category', () => {
    render(<GlobalSettingCategoryPage />);

    fireEvent.click(screen.getByTestId('add-service-button'));

    // This landing page spans every category, so nothing should be pre-selected.
    expect(mockGetAddServicePath).toHaveBeenCalledWith(ALL_SERVICES_CATEGORY);
    expect(mockNavigate).toHaveBeenCalledWith(
      `/${ALL_SERVICES_CATEGORY}/add-service`
    );
  });

  it('shows the action for a user who can create only one category', () => {
    // Regression guard: the old check asked about databases specifically, which wrongly hid the
    // button from a user permitted to create just API services.
    mockCheckPermission.mockImplementation(
      (_operation, resource) => resource === ServiceCategory.API_SERVICES
    );

    render(<GlobalSettingCategoryPage />);

    expect(screen.getByTestId('add-service-button')).toBeInTheDocument();
  });

  it('hides the action when the user can create nothing', () => {
    mockCheckPermission.mockReturnValue(false);

    render(<GlobalSettingCategoryPage />);

    expect(screen.queryByTestId('add-service-button')).not.toBeInTheDocument();
  });

  it('hides the action until permissions have loaded', () => {
    mockPermissions = {};

    render(<GlobalSettingCategoryPage />);

    expect(screen.queryByTestId('add-service-button')).not.toBeInTheDocument();
    expect(mockCheckPermission).not.toHaveBeenCalled();
  });
});
