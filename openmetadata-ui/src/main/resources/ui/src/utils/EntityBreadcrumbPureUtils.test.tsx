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
import {
    getEntityBreadcrumbs,
    getEntityTypeForIcon,
    isServiceBreadcrumbHref
} from './EntityBreadcrumbPureUtils';
import {
    mockDatabaseUrl,
    mockEntityForDatabase,
    mockEntityForDatabaseSchema,
    mockServiceUrl,
    mockSettingUrl,
    mockUrl
} from './mocks/EntityUtils.mock';
import {
    getEntityDetailsPath,
    getServiceDetailsPath,
    getSettingPath
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
  describe('isServiceBreadcrumbHref', () => {
    it('should match only service instance breadcrumb hrefs', () => {
      expect(
        isServiceBreadcrumbHref('/service/databaseServices/mysql_sample')
      ).toBe(true);
      expect(
        isServiceBreadcrumbHref('/settings/services/databaseServices')
      ).toBe(false);
      expect(isServiceBreadcrumbHref('/domain/engineering')).toBe(false);
      expect(isServiceBreadcrumbHref('/dataProduct/customer_360')).toBe(false);
      expect(isServiceBreadcrumbHref('/glossary/business')).toBe(false);
      expect(isServiceBreadcrumbHref('/tags/PII')).toBe(false);
    });
  });

  describe('getEntityTypeForIcon', () => {
    it('should resolve serviceless entity breadcrumb hrefs to their entity icon types', () => {
      expect(getEntityTypeForIcon('/domain/engineering')).toBe(
        EntityType.DOMAIN
      );
      expect(getEntityTypeForIcon('/dataProduct/customer_360')).toBe(
        EntityType.DATA_PRODUCT
      );
      expect(getEntityTypeForIcon('/glossary/business')).toBe(
        EntityType.GLOSSARY
      );
      expect(getEntityTypeForIcon('/tags/PII')).toBe(EntityType.CLASSIFICATION);
    });
  });

  describe('getEntityBreadcrumbs', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return breadcrumbs for EntityType.DATABASE', () => {
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
        {
          name: 'default',
          url: '/database/default',
        },
      ]);

      expect(getServiceRouteFromServiceType).toHaveBeenCalledWith(
        ServiceCategory.DATABASE_SERVICES
      );
    });

    it('should return breadcrumbs for EntityType.DATABASE_SCHEMA', () => {
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
        {
          name: 'shopify',
          url: '/entity/MockDatabase',
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
  });
});
