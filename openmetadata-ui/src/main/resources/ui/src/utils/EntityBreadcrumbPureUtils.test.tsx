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

    it('should return EntityType.DATABASE breadcrumbs without the current entity by default', () => {
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

    it('should include the current entity for EntityType.DATABASE when includeCurrent is true', () => {
      (getServiceRouteFromServiceType as jest.Mock).mockReturnValue(mockUrl);
      (getSettingPath as jest.Mock).mockReturnValue(mockSettingUrl);
      (getServiceDetailsPath as jest.Mock).mockReturnValue(
        '/service/databaseServices/mysql_sample'
      );
      (getEntityDetailsPath as jest.Mock).mockReturnValue('/database/default');

      const result = getEntityBreadcrumbs(
        mockEntityForDatabase,
        EntityType.DATABASE,
        true
      );

      expect(result).toEqual([
        {
          name: startCase(ServiceCategory.DATABASE_SERVICES),
          url: mockSettingUrl,
        },
        { name: 'mysql_sample', url: '/service/databaseServices/mysql_sample' },
        {
          name: 'default',
          url: '/database/default',
        },
      ]);
    });

    it('should return EntityType.DATABASE_SCHEMA breadcrumbs without the current entity by default', () => {
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

    it('should include the current entity for EntityType.DATABASE_SCHEMA when includeCurrent is true', () => {
      (getSettingPath as jest.Mock).mockReturnValue(mockSettingUrl);
      (getServiceDetailsPath as jest.Mock).mockReturnValue(mockServiceUrl);
      (getEntityDetailsPath as jest.Mock).mockReturnValue(mockDatabaseUrl);

      const result = getEntityBreadcrumbs(
        mockEntityForDatabaseSchema,
        EntityType.DATABASE_SCHEMA,
        true
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
        {
          name: 'shopify',
          url: '/entity/MockDatabase',
        },
      ]);
    });

    it('should return EntityType.METRIC breadcrumbs without the current entity by default', () => {
      const result = getEntityBreadcrumbs(
        { name: 'monthly_active_users' } as never,
        EntityType.METRIC
      );

      expect(result).toHaveLength(1);
      expect(result).not.toContainEqual({
        name: 'monthly_active_users',
        url: '',
      });
    });

    it('should include the current entity for EntityType.METRIC when includeCurrent is true', () => {
      const result = getEntityBreadcrumbs(
        { name: 'monthly_active_users' } as never,
        EntityType.METRIC,
        true
      );

      expect(result).toHaveLength(2);
      expect(result[1]).toEqual({ name: 'monthly_active_users', url: '' });
    });
  });
});
