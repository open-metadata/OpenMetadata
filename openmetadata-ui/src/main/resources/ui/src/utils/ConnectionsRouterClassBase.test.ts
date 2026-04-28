/*
 *  Copyright 2025 Collate.
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

import connectionsRouterClassBase, {
  ConnectionsRouterClassBase,
} from './ConnectionsRouterClassBase';

jest.mock('./RouterUtils', () => ({
  getServiceDetailsPath: (fqn: string, serviceCategory: string, tab?: string) =>
    tab
      ? `/service/${serviceCategory}/${fqn}/${tab}`
      : `/service/${serviceCategory}/${fqn}`,
  getEditConnectionPath: (serviceCategory: string, fqn: string) =>
    `/service/${serviceCategory}/${fqn}/connection/edit-connection`,
  getAddServicePath: (serviceCategory: string) =>
    `/${serviceCategory}/add-service`,
  getPathByServiceFQN: (serviceCategory: string, fqn: string) =>
    `/service/${serviceCategory}/${fqn}/connection`,
  getLogsViewerPath: (
    logEntityType: string,
    logEntityName: string,
    ingestionName: string
  ) => `/logs/${logEntityType}/${logEntityName}/${ingestionName}`,
  getSettingPath: (category: string, option: string) =>
    `/settings/${category}/${option}`,
}));

jest.mock('./ServiceUtils', () => ({
  getServiceRouteFromServiceType: (type: string) => `${type}Route`,
}));

jest.mock('../constants/constants', () => ({
  ROUTES: {
    SETTINGS_WITH_CATEGORY: '/settings/:settingCategory',
  },
  PLACEHOLDER_SETTING_CATEGORY: ':settingCategory',
}));

jest.mock('../constants/GlobalSettings.constants', () => ({
  GlobalSettingsMenuCategory: {
    SERVICES: 'services',
  },
}));

describe('ConnectionsRouterClassBase', () => {
  let router: ConnectionsRouterClassBase;

  beforeEach(() => {
    router = new ConnectionsRouterClassBase();
  });

  describe('embeddedMode', () => {
    it('setEmbeddedMode should be a no-op', () => {
      router.setEmbeddedMode(true);

      expect(router.isEmbeddedMode()).toBe(false);
    });

    it('isEmbeddedMode should always return false', () => {
      expect(router.isEmbeddedMode()).toBe(false);
    });
  });

  describe('getSettingsServicesPath', () => {
    it('should return the generic settings services path when no category given', () => {
      expect(router.getSettingsServicesPath()).toBe('/settings/services');
    });

    it('should return the specific service-type tab path when serviceCategory given', () => {
      expect(router.getSettingsServicesPath('databaseServices')).toBe(
        '/settings/services/databaseServicesRoute'
      );
    });
  });

  describe('getServiceDetailsPath', () => {
    it('should return service details path without tab', () => {
      expect(router.getServiceDetailsPath('databaseServices', 'my-db')).toBe(
        '/service/databaseServices/my-db'
      );
    });

    it('should return service details path with tab', () => {
      expect(
        router.getServiceDetailsPath('databaseServices', 'my-db', 'connection')
      ).toBe('/service/databaseServices/my-db/connection');
    });
  });

  describe('getEditConnectionPath', () => {
    it('should return the edit connection path', () => {
      expect(router.getEditConnectionPath('databaseServices', 'my-db')).toBe(
        '/service/databaseServices/my-db/connection/edit-connection'
      );
    });
  });

  describe('getAddServicePath', () => {
    it('should return the add service path', () => {
      expect(router.getAddServicePath('databaseServices')).toBe(
        '/databaseServices/add-service'
      );
    });
  });

  describe('getPathByServiceFQN', () => {
    it('should return service path with connection tab', () => {
      expect(router.getPathByServiceFQN('databaseServices', 'my-db')).toBe(
        '/service/databaseServices/my-db/connection'
      );
    });
  });

  describe('getLogsViewerPath', () => {
    it('should return the logs viewer path', () => {
      expect(
        router.getLogsViewerPath('databaseServices', 'my-db', 'pipeline-1')
      ).toBe('/logs/databaseServices/my-db/pipeline-1');
    });
  });

  describe('singleton default export', () => {
    it('default export should be an instance of ConnectionsRouterClassBase', () => {
      expect(connectionsRouterClassBase).toBeInstanceOf(
        ConnectionsRouterClassBase
      );
    });

    it('repeated imports should reference the same singleton', () => {
      const { default: reimport } = jest.requireActual<{
        default: ConnectionsRouterClassBase;
      }>('./ConnectionsRouterClassBase');

      expect(reimport).toBe(connectionsRouterClassBase);
    });
  });
});
