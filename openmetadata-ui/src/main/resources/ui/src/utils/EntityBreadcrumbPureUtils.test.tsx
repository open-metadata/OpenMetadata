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
import { startCase } from 'lodash';
import { EntityType } from '../enums/entity.enum';
import { ServiceCategory } from '../enums/service.enum';
import { getEntityBreadcrumbs } from './EntityBreadcrumbPureUtils';
import {
  mockDatabaseUrl,
  mockEntityForDatabase,
  mockEntityForDatabaseSchema,
  mockServiceUrl,
  mockSettingUrl,
  mockUrl,
} from './mocks/EntityUtils.mock';
import {
  getEntityDetailsPath,
  getServiceDetailsPath,
  getSettingPath,
} from './RouterUtils';
import { getServiceRouteFromServiceType } from './ServicePureUtils';

jest.mock('./RouterUtils', () => ({
  getDataQualityPagePath: jest.fn(),
  getDomainPath: jest.fn(),
  getSettingPath: jest.fn(),
  getServiceDetailsPath: jest.fn(),
  getEntityDetailsPath: jest.fn(),
}));

jest.mock('./ServicePureUtils', () => ({
  getServiceRouteFromServiceType: jest.fn(),
}));

describe('EntityBreadcrumbPureUtils unit tests', () => {
  describe('getEntityBreadcrumbs', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return ancestor-only breadcrumbs for EntityType.DATABASE', () => {
      (getServiceRouteFromServiceType as jest.Mock).mockReturnValue(mockUrl);
      (getSettingPath as jest.Mock).mockReturnValue(mockSettingUrl);
      (getServiceDetailsPath as jest.Mock).mockReturnValue(
        '/service/databaseServices/mysql_sample'
      );
      (getEntityDetailsPath as jest.Mock).mockReturnValue('/database/default');

      const result = getEntityBreadcrumbs(
        mockEntityForDatabase,
        EntityType.DATABASE
      );

      expect(result).toEqual([
        {
          name: startCase(ServiceCategory.DATABASE_SERVICES),
          url: mockSettingUrl,
        },
        { name: 'mysql_sample', url: '/service/databaseServices/mysql_sample' },
      ]);

      expect(getServiceRouteFromServiceType).toHaveBeenCalledWith(
        ServiceCategory.DATABASE_SERVICES
      );
    });

    it('should append the current entity for EntityType.DATABASE when includeCurrent is true', () => {
      (getServiceRouteFromServiceType as jest.Mock).mockReturnValue(mockUrl);
      (getSettingPath as jest.Mock).mockReturnValue(mockSettingUrl);
      (getServiceDetailsPath as jest.Mock).mockReturnValue(
        '/service/databaseServices/mysql_sample'
      );

      const result = getEntityBreadcrumbs(
        mockEntityForDatabase,
        EntityType.DATABASE,
        true
      );

      expect(result[result.length - 1].name).toBe('default');
    });

    it('should return ancestor-only breadcrumbs for EntityType.DATABASE_SCHEMA', () => {
      (getSettingPath as jest.Mock).mockReturnValue(mockSettingUrl);
      (getServiceDetailsPath as jest.Mock).mockReturnValue(mockServiceUrl);
      (getEntityDetailsPath as jest.Mock).mockReturnValue(mockDatabaseUrl);

      const result = getEntityBreadcrumbs(
        mockEntityForDatabaseSchema,
        EntityType.DATABASE_SCHEMA
      );

      expect(result).toEqual([
        {
          name: startCase(ServiceCategory.DATABASE_SERVICES),
          url: mockSettingUrl,
        },
        {
          name: 'sample_data',
          url: mockServiceUrl,
        },
        {
          name: 'ecommerce_db',
          url: mockDatabaseUrl,
        },
      ]);

      expect(getServiceDetailsPath).toHaveBeenCalledWith(
        'sample_data',
        ServiceCategory.DATABASE_SERVICES
      );
      expect(getEntityDetailsPath).toHaveBeenCalledWith(
        EntityType.DATABASE,
        'sample_data.ecommerce_db'
      );
    });

    it('should append the current entity for EntityType.DATABASE_SCHEMA when includeCurrent is true', () => {
      (getSettingPath as jest.Mock).mockReturnValue(mockSettingUrl);
      (getServiceDetailsPath as jest.Mock).mockReturnValue(mockServiceUrl);
      (getEntityDetailsPath as jest.Mock).mockReturnValue(mockDatabaseUrl);

      const result = getEntityBreadcrumbs(
        mockEntityForDatabaseSchema,
        EntityType.DATABASE_SCHEMA,
        true
      );

      expect(result[result.length - 1].name).toBe('shopify');
    });
  });
});
