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
import {
  ResourceEntity,
  UIPermission,
} from '../context/PermissionProvider/PermissionProvider.interface';
import { ENTITY_PERMISSIONS } from '../mocks/Permissions.mock';
import globalSettingsClassBase, {
  GlobalSettingsClassBase,
} from './GlobalSettingsClassBase';
import { userPermissions } from './PermissionsUtils';

jest.mock('./i18next/LocalUtil', () => ({
  t: jest.fn((key: string) => key),
}));

jest.mock('./BrandData/BrandClassBase', () => ({
  __esModule: true,
  default: {
    getPageTitle: jest.fn(() => 'OpenMetadata'),
  },
}));

jest.mock('./PermissionsUtils', () => ({
  ...jest.requireActual('./PermissionsUtils'),
  userPermissions: {
    hasViewPermissions: jest.fn(),
  },
}));

describe('GlobalSettingsClassBase', () => {
  const mockPermissions: UIPermission = {
    [ResourceEntity.DATABASE_SERVICE]: ENTITY_PERMISSIONS,
    [ResourceEntity.MESSAGING_SERVICE]: ENTITY_PERMISSIONS,
    [ResourceEntity.DASHBOARD_SERVICE]: ENTITY_PERMISSIONS,
    [ResourceEntity.PIPELINE_SERVICE]: ENTITY_PERMISSIONS,
    [ResourceEntity.ML_MODEL_SERVICE]: ENTITY_PERMISSIONS,
    [ResourceEntity.STORAGE_SERVICE]: ENTITY_PERMISSIONS,
    [ResourceEntity.SEARCH_SERVICE]: ENTITY_PERMISSIONS,
    [ResourceEntity.METADATA_SERVICE]: ENTITY_PERMISSIONS,
    [ResourceEntity.API_SERVICE]: ENTITY_PERMISSIONS,
    [ResourceEntity.DRIVE_SERVICE]: ENTITY_PERMISSIONS,
    [ResourceEntity.EVENT_SUBSCRIPTION]: ENTITY_PERMISSIONS,
    [ResourceEntity.TEAM]: ENTITY_PERMISSIONS,
    [ResourceEntity.USER]: ENTITY_PERMISSIONS,
  } as UIPermission;

  const mockNoPermissions: UIPermission = {} as UIPermission;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getGlobalSettingsMenuWithPermission', () => {
    it('should return menu items for admin user with all permissions', () => {
      (userPermissions.hasViewPermissions as jest.Mock).mockReturnValue(true);

      const result =
        globalSettingsClassBase.getGlobalSettingsMenuWithPermission(
          mockPermissions,
          true
        );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return menu items for non-admin user with all permissions', () => {
      (userPermissions.hasViewPermissions as jest.Mock).mockReturnValue(true);

      const result =
        globalSettingsClassBase.getGlobalSettingsMenuWithPermission(
          mockPermissions,
          false
        );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should filter service items based on permissions', () => {
      (userPermissions.hasViewPermissions as jest.Mock).mockImplementation(
        (entity: ResourceEntity) => {
          return entity === ResourceEntity.DATABASE_SERVICE;
        }
      );

      const result =
        globalSettingsClassBase.getGlobalSettingsMenuWithPermission(
          mockNoPermissions,
          false
        );

      const servicesCategory = result.find((item) => item.key === 'services');

      expect(servicesCategory).toBeDefined();
      expect(servicesCategory?.items).toBeDefined();

      const databaseService = servicesCategory?.items?.find(
        (item) => item.key === 'services.databases'
      );

      expect(databaseService?.isProtected).toBe(true);
    });

    it('should include applications category for admin user', () => {
      (userPermissions.hasViewPermissions as jest.Mock).mockReturnValue(false);

      const result =
        globalSettingsClassBase.getGlobalSettingsMenuWithPermission(
          mockNoPermissions,
          true
        );

      const applicationsCategory = result.find((item) => item.key === 'apps');

      expect(applicationsCategory).toBeDefined();
      expect(applicationsCategory?.isProtected).toBe(true);
    });

    it('should not grant applications access to non-admin user', () => {
      (userPermissions.hasViewPermissions as jest.Mock).mockReturnValue(false);

      const result =
        globalSettingsClassBase.getGlobalSettingsMenuWithPermission(
          mockNoPermissions,
          false
        );

      const applicationsCategory = result.find((item) => item.key === 'apps');

      expect(applicationsCategory).toBeDefined();
      expect(applicationsCategory?.isProtected).toBe(false);
    });

    it('should include notifications category with correct permissions', () => {
      (userPermissions.hasViewPermissions as jest.Mock).mockImplementation(
        (entity: ResourceEntity) => {
          return entity === ResourceEntity.EVENT_SUBSCRIPTION;
        }
      );

      const result =
        globalSettingsClassBase.getGlobalSettingsMenuWithPermission(
          mockPermissions,
          false
        );

      const notificationsCategory = result.find(
        (item) => item.key === 'notifications'
      );

      expect(notificationsCategory).toBeDefined();
      expect(notificationsCategory?.isProtected).toBe(true);
    });

    it('should include team-user management with correct sub-items', () => {
      (userPermissions.hasViewPermissions as jest.Mock).mockImplementation(
        (entity: ResourceEntity) => {
          return (
            entity === ResourceEntity.TEAM || entity === ResourceEntity.USER
          );
        }
      );

      const result =
        globalSettingsClassBase.getGlobalSettingsMenuWithPermission(
          mockPermissions,
          false
        );

      const membersCategory = result.find((item) => item.key === 'members');

      expect(membersCategory).toBeDefined();
      expect(membersCategory?.items).toBeDefined();

      const teamsItem = membersCategory?.items?.find(
        (item) => item.key === 'members.teams'
      );

      expect(teamsItem?.isProtected).toBe(true);

      const usersItem = membersCategory?.items?.find(
        (item) => item.key === 'members.users'
      );

      expect(usersItem?.isProtected).toBe(true);
    });

    it('should include access control items for admin only', () => {
      (userPermissions.hasViewPermissions as jest.Mock).mockReturnValue(false);

      const resultAdmin =
        globalSettingsClassBase.getGlobalSettingsMenuWithPermission(
          mockNoPermissions,
          true
        );

      const accessCategoryAdmin = resultAdmin.find(
        (item) => item.key === 'access'
      );

      expect(accessCategoryAdmin).toBeDefined();
      expect(accessCategoryAdmin?.items).toBeDefined();

      const rolesItem = accessCategoryAdmin?.items?.find(
        (item) => item.key === 'access.roles'
      );

      expect(rolesItem?.isProtected).toBe(true);

      const policiesItem = accessCategoryAdmin?.items?.find(
        (item) => item.key === 'access.policies'
      );

      expect(policiesItem?.isProtected).toBe(true);

      const resultNonAdmin =
        globalSettingsClassBase.getGlobalSettingsMenuWithPermission(
          mockNoPermissions,
          false
        );

      const accessCategoryNonAdmin = resultNonAdmin.find(
        (item) => item.key === 'access'
      );
      const rolesItemNonAdmin = accessCategoryNonAdmin?.items?.find(
        (item) => item.key === 'access.roles'
      );

      expect(rolesItemNonAdmin?.isProtected).toBe(false);
    });

    it('should include preferences with nested search settings for admin', () => {
      (userPermissions.hasViewPermissions as jest.Mock).mockReturnValue(false);

      const result =
        globalSettingsClassBase.getGlobalSettingsMenuWithPermission(
          mockNoPermissions,
          true
        );

      const preferencesCategory = result.find(
        (item) => item.key === 'preferences'
      );

      expect(preferencesCategory).toBeDefined();
      expect(preferencesCategory?.items).toBeDefined();

      const searchSettings = preferencesCategory?.items?.find(
        (item) => item.key === 'preferences.search-settings'
      );

      expect(searchSettings).toBeDefined();
      expect(searchSettings?.isProtected).toBe(true);
      expect(searchSettings?.items).toBeDefined();
      expect(searchSettings?.items?.length).toBeGreaterThan(0);
    });

    it('should sort search settings items alphabetically', () => {
      (userPermissions.hasViewPermissions as jest.Mock).mockReturnValue(false);

      const result =
        globalSettingsClassBase.getGlobalSettingsMenuWithPermission(
          mockNoPermissions,
          true
        );

      const preferencesCategory = result.find(
        (item) => item.key === 'preferences'
      );
      const searchSettings = preferencesCategory?.items?.find(
        (item) => item.key === 'preferences.search-settings'
      );
      const items = searchSettings?.items || [];

      expect(items.length).toBeGreaterThan(1);

      for (let i = 0; i < items.length - 1; i++) {
        const currentLabel = items[i].label || '';
        const nextLabel = items[i + 1].label || '';

        expect(currentLabel.localeCompare(nextLabel)).toBeLessThanOrEqual(0);
      }
    });

    it('should include custom properties with sorted items for admin', () => {
      (userPermissions.hasViewPermissions as jest.Mock).mockReturnValue(false);

      const result =
        globalSettingsClassBase.getGlobalSettingsMenuWithPermission(
          mockNoPermissions,
          true
        );

      const customPropertiesCategory = result.find(
        (item) => item.key === 'customProperties'
      );

      expect(customPropertiesCategory).toBeDefined();
      expect(customPropertiesCategory?.items).toBeDefined();
      expect(customPropertiesCategory?.items?.length).toBeGreaterThan(0);

      const items = customPropertiesCategory?.items || [];

      expect(items.length).toBeGreaterThan(1);

      for (let i = 0; i < items.length - 1; i++) {
        const currentLabel = items[i].label || '';
        const nextLabel = items[i + 1].label || '';

        expect(currentLabel.localeCompare(nextLabel)).toBeLessThanOrEqual(0);
      }
    });

    it('should include bots category for admin only', () => {
      (userPermissions.hasViewPermissions as jest.Mock).mockReturnValue(false);

      const resultAdmin =
        globalSettingsClassBase.getGlobalSettingsMenuWithPermission(
          mockNoPermissions,
          true
        );

      const botsCategory = resultAdmin.find((item) => item.key === 'bots');

      expect(botsCategory).toBeDefined();
      expect(botsCategory?.isProtected).toBe(true);

      const resultNonAdmin =
        globalSettingsClassBase.getGlobalSettingsMenuWithPermission(
          mockNoPermissions,
          false
        );

      const botsCategoryNonAdmin = resultNonAdmin.find(
        (item) => item.key === 'bots'
      );

      expect(botsCategoryNonAdmin?.isProtected).toBe(false);
    });

    it('should include persona category for admin only', () => {
      (userPermissions.hasViewPermissions as jest.Mock).mockReturnValue(false);

      const resultAdmin =
        globalSettingsClassBase.getGlobalSettingsMenuWithPermission(
          mockNoPermissions,
          true
        );

      const personaCategory = resultAdmin.find(
        (item) => item.key === 'persona'
      );

      expect(personaCategory).toBeDefined();
      expect(personaCategory?.isProtected).toBe(true);

      const resultNonAdmin =
        globalSettingsClassBase.getGlobalSettingsMenuWithPermission(
          mockNoPermissions,
          false
        );

      const personaCategoryNonAdmin = resultNonAdmin.find(
        (item) => item.key === 'persona'
      );

      expect(personaCategoryNonAdmin?.isProtected).toBe(false);
    });

    it('should include SSO category for admin only', () => {
      (userPermissions.hasViewPermissions as jest.Mock).mockReturnValue(false);

      const resultAdmin =
        globalSettingsClassBase.getGlobalSettingsMenuWithPermission(
          mockNoPermissions,
          true
        );

      const ssoCategory = resultAdmin.find((item) => item.key === 'sso');

      expect(ssoCategory).toBeDefined();
      expect(ssoCategory?.isProtected).toBe(true);

      const resultNonAdmin =
        globalSettingsClassBase.getGlobalSettingsMenuWithPermission(
          mockNoPermissions,
          false
        );

      const ssoCategoryNonAdmin = resultNonAdmin.find(
        (item) => item.key === 'sso'
      );

      expect(ssoCategoryNonAdmin?.isProtected).toBe(false);
    });

    it('should include all service types in services category', () => {
      (userPermissions.hasViewPermissions as jest.Mock).mockReturnValue(true);

      const result =
        globalSettingsClassBase.getGlobalSettingsMenuWithPermission(
          mockPermissions,
          false
        );

      const servicesCategory = result.find((item) => item.key === 'services');

      expect(servicesCategory).toBeDefined();
      expect(servicesCategory?.items).toBeDefined();

      const serviceKeys = [
        'services.apiServices',
        'services.databases',
        'services.messaging',
        'services.dashboards',
        'services.pipelines',
        'services.mlmodels',
        'services.storages',
        'services.search',
        'services.metadata',
        'services.drives',
        'services.dataObservability',
      ];

      serviceKeys.forEach((key) => {
        const serviceItem = servicesCategory?.items?.find(
          (item) => item.key === key
        );

        expect(serviceItem).toBeDefined();
      });
    });

    it('should mark data observability as always protected', () => {
      (userPermissions.hasViewPermissions as jest.Mock).mockReturnValue(false);

      const result =
        globalSettingsClassBase.getGlobalSettingsMenuWithPermission(
          mockNoPermissions,
          false
        );

      const servicesCategory = result.find((item) => item.key === 'services');
      const dataObservability = servicesCategory?.items?.find(
        (item) => item.key === 'services.dataObservability'
      );

      expect(dataObservability).toBeDefined();
      expect(dataObservability?.isProtected).toBe(true);
    });

    it('should include online users in members for admin only', () => {
      (userPermissions.hasViewPermissions as jest.Mock).mockReturnValue(false);

      const resultAdmin =
        globalSettingsClassBase.getGlobalSettingsMenuWithPermission(
          mockNoPermissions,
          true
        );

      const membersCategory = resultAdmin.find(
        (item) => item.key === 'members'
      );
      const onlineUsers = membersCategory?.items?.find(
        (item) => item.key === 'members.online-users'
      );

      expect(onlineUsers).toBeDefined();
      expect(onlineUsers?.isProtected).toBe(true);

      const resultNonAdmin =
        globalSettingsClassBase.getGlobalSettingsMenuWithPermission(
          mockNoPermissions,
          false
        );

      const membersCategoryNonAdmin = resultNonAdmin.find(
        (item) => item.key === 'members'
      );
      const onlineUsersNonAdmin = membersCategoryNonAdmin?.items?.find(
        (item) => item.key === 'members.online-users'
      );

      expect(onlineUsersNonAdmin?.isProtected).toBe(false);
    });

    it('should include all preference items for admin', () => {
      (userPermissions.hasViewPermissions as jest.Mock).mockReturnValue(false);

      const result =
        globalSettingsClassBase.getGlobalSettingsMenuWithPermission(
          mockNoPermissions,
          true
        );

      const preferencesCategory = result.find(
        (item) => item.key === 'preferences'
      );

      expect(preferencesCategory).toBeDefined();
      expect(preferencesCategory?.items).toBeDefined();

      const preferenceKeys = [
        'preferences.appearance',
        'preferences.email',
        'preferences.loginConfiguration',
        'preferences.om-health',
        'preferences.profiler-configuration',
        'preferences.search-settings',
        'preferences.lineageConfig',
        'preferences.om-url-config',
        'preferences.dataAssetRules',
      ];

      preferenceKeys.forEach((key) => {
        const preferenceItem = preferencesCategory?.items?.find(
          (item) => item.key === key
        );

        expect(preferenceItem).toBeDefined();
      });

      const searchSettingsItem = preferencesCategory?.items?.find(
        (item) => item.key === 'preferences.search-settings'
      );

      expect(searchSettingsItem?.items).toBeDefined();
    });

    it('should mark data asset rules as beta', () => {
      (userPermissions.hasViewPermissions as jest.Mock).mockReturnValue(false);

      const result =
        globalSettingsClassBase.getGlobalSettingsMenuWithPermission(
          mockNoPermissions,
          true
        );

      const preferencesCategory = result.find(
        (item) => item.key === 'preferences'
      );
      const dataAssetRules = preferencesCategory?.items?.find(
        (item) => item.key === 'preferences.dataAssetRules'
      );

      expect(dataAssetRules).toBeDefined();
      expect(dataAssetRules?.isBeta).toBe(true);
    });

    it('should call userPermissions.hasViewPermissions with correct arguments', () => {
      (userPermissions.hasViewPermissions as jest.Mock).mockReturnValue(true);

      globalSettingsClassBase.getGlobalSettingsMenuWithPermission(
        mockPermissions,
        false
      );

      expect(userPermissions.hasViewPermissions).toHaveBeenCalledWith(
        ResourceEntity.DATABASE_SERVICE,
        mockPermissions
      );
      expect(userPermissions.hasViewPermissions).toHaveBeenCalledWith(
        ResourceEntity.EVENT_SUBSCRIPTION,
        mockPermissions
      );
      expect(userPermissions.hasViewPermissions).toHaveBeenCalledWith(
        ResourceEntity.TEAM,
        mockPermissions
      );
    });

    it('should handle undefined isAdminUser parameter', () => {
      (userPermissions.hasViewPermissions as jest.Mock).mockReturnValue(false);

      const result =
        globalSettingsClassBase.getGlobalSettingsMenuWithPermission(
          mockNoPermissions
        );

      const applicationsCategory = result.find((item) => item.key === 'apps');

      expect(applicationsCategory?.isProtected).toBe(false);
    });
  });

  describe('getServiceIcon', () => {
    it('should return ServiceIcon', () => {
      const icon = globalSettingsClassBase.getServiceIcon();

      expect(icon).toBeDefined();
    });
  });

  describe('getPreferenceIcon', () => {
    it('should return OpenMetadataIcon', () => {
      const icon = globalSettingsClassBase.getPreferenceIcon();

      expect(icon).toBeDefined();
    });
  });

  describe('settingCategories', () => {
    it('should have all required categories', () => {
      const categories = globalSettingsClassBase.settingCategories;

      expect(categories).toHaveProperty('services');
      expect(categories).toHaveProperty('notifications');
      expect(categories).toHaveProperty('members');
      expect(categories).toHaveProperty('access');
      expect(categories).toHaveProperty('preferences');
      expect(categories).toHaveProperty('search-settings');
      expect(categories).toHaveProperty('customProperties');
      expect(categories).toHaveProperty('bots');
      expect(categories).toHaveProperty('apps');
      expect(categories).toHaveProperty('persona');
      expect(categories).toHaveProperty('sso');
    });

    it('should have correct structure for each category', () => {
      const categories = globalSettingsClassBase.settingCategories;

      Object.values(categories).forEach((category) => {
        expect(category).toHaveProperty('name');
        expect(category).toHaveProperty('url');
        expect(typeof category.name).toBe('string');
        expect(typeof category.url).toBe('string');
      });
    });
  });

  describe('GlobalSettingsClassBase instance', () => {
    it('should create a new instance', () => {
      const instance = new GlobalSettingsClassBase();

      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(GlobalSettingsClassBase);
    });

    it('should export default singleton instance', () => {
      expect(globalSettingsClassBase).toBeDefined();
      expect(globalSettingsClassBase).toBeInstanceOf(GlobalSettingsClassBase);
    });
  });
});
