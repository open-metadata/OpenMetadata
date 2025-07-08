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
import { DomainFormType } from '../components/Domain/DomainPage.interface';
import { CreateDataProduct } from '../generated/api/domains/createDataProduct';
import {
  CreateDomain,
  DomainType,
} from '../generated/api/domains/createDomain';
import {
  createFormConfig,
  domainsToOptions,
  ENTITY_API_ENDPOINTS,
  FORM_PRESETS,
  getEntityTypeFromData,
  isCreateDataProduct,
  isCreateDomain,
  validateFormData,
} from './AddEntityFormUtils';

// Mock types for testing
interface MockCreateDomain {
  name: string;
  description: string;
  domainType?: DomainType;
  parent?: string;
}

interface MockCreateDataProduct {
  name: string;
  description: string;
  domain: string;
}

describe('AddEntityFormV2Utils', () => {
  describe('createFormConfig', () => {
    it('should create domain config', () => {
      const config = createFormConfig.domain({ title: 'Domain' });

      expect(config.entityType).toBe(DomainFormType.DOMAIN);
      expect(config.showDomainType).toBe(true);
      expect(config.showParentDomain).toBe(false);
      expect(config.title).toBe('Domain');
    });

    it('should create subdomain config', () => {
      const config = createFormConfig.subdomain({ parentDomain: 'parent' });

      expect(config.entityType).toBe(DomainFormType.SUBDOMAIN);
      expect(config.showParentDomain).toBe(true);
      expect(config.parentDomain).toBe('parent');
    });

    it('should create dataProduct config', () => {
      const config = createFormConfig.dataProduct({
        availableDomains: [{ label: 'A', value: 'a' }],
      });

      expect(config.entityType).toBe(DomainFormType.DATA_PRODUCT);
      expect(config.showDomainSelector).toBe(true);
      expect(config.availableDomains).toEqual([{ label: 'A', value: 'a' }]);
    });
  });

  describe('isCreateDomain', () => {
    it('should return true for CreateDomain', () => {
      const data: MockCreateDomain = {
        name: 'n',
        description: 'd',
        domainType: DomainType.Aggregate,
      };

      expect(isCreateDomain(data as CreateDomain | CreateDataProduct)).toBe(
        true
      );
    });

    it('should return false for CreateDataProduct', () => {
      const data: MockCreateDataProduct = {
        name: 'n',
        description: 'd',
        domain: 'dom',
      };

      expect(isCreateDomain(data as CreateDomain | CreateDataProduct)).toBe(
        false
      );
    });
  });

  describe('isCreateDataProduct', () => {
    it('should return true for CreateDataProduct', () => {
      const data: MockCreateDataProduct = {
        name: 'n',
        description: 'd',
        domain: 'dom',
      };

      expect(
        isCreateDataProduct(data as CreateDomain | CreateDataProduct)
      ).toBe(true);
    });

    it('should return false for CreateDomain', () => {
      const data: MockCreateDomain = {
        name: 'n',
        description: 'd',
        domainType: DomainType.Aggregate,
      };

      expect(
        isCreateDataProduct(data as CreateDomain | CreateDataProduct)
      ).toBe(false);
    });
  });

  describe('domainsToOptions', () => {
    it('should map domains to options', () => {
      const domains = [
        { name: 'n1', fullyQualifiedName: 'fq1', displayName: 'd1' },
        { name: 'n2' },
      ];

      expect(domainsToOptions(domains)).toEqual([
        { label: 'd1', value: 'fq1' },
        { label: 'n2', value: 'n2' },
      ]);
    });
  });

  describe('FORM_PRESETS', () => {
    it('should provide CREATE_DOMAIN config', () => {
      expect(FORM_PRESETS.CREATE_DOMAIN.entityType).toBe(DomainFormType.DOMAIN);
    });

    it('should provide CREATE_SUBDOMAIN config', () => {
      const config = FORM_PRESETS.CREATE_SUBDOMAIN('parent');

      expect(config.entityType).toBe(DomainFormType.SUBDOMAIN);
      expect(config.parentDomain).toBe('parent');
      expect(config.defaultValues).toEqual({ parent: 'parent' });
    });

    it('should provide CREATE_DATA_PRODUCT config', () => {
      const config = FORM_PRESETS.CREATE_DATA_PRODUCT([
        { label: 'A', value: 'a' },
      ]);

      expect(config.entityType).toBe(DomainFormType.DATA_PRODUCT);
      expect(config.availableDomains).toEqual([{ label: 'A', value: 'a' }]);
    });
  });

  describe('validateFormData', () => {
    it('should validate domain', () => {
      expect(
        validateFormData.domain({
          name: 'n',
          description: 'd',
          domainType: DomainType.Aggregate,
        } as CreateDomain)
      ).toBe(true);
      expect(
        validateFormData.domain({
          name: '',
          description: 'd',
          domainType: DomainType.Aggregate,
        } as CreateDomain)
      ).toBe(false);
    });

    it('should validate dataProduct', () => {
      expect(
        validateFormData.dataProduct({
          name: 'n',
          description: 'd',
          domain: 'dom',
        } as CreateDataProduct)
      ).toBe(true);
      expect(
        validateFormData.dataProduct({
          name: '',
          description: 'd',
          domain: 'dom',
        } as CreateDataProduct)
      ).toBe(false);
    });

    it('should validate subdomain', () => {
      expect(
        validateFormData.subdomain({
          name: 'n',
          description: 'd',
          domainType: DomainType.Aggregate,
          parent: 'p',
        } as CreateDomain)
      ).toBe(true);
      expect(
        validateFormData.subdomain({
          name: 'n',
          description: 'd',
          domainType: DomainType.Aggregate,
        } as CreateDomain)
      ).toBe(false);
    });
  });

  describe('ENTITY_API_ENDPOINTS', () => {
    it('should map entity types to endpoints', () => {
      expect(ENTITY_API_ENDPOINTS[DomainFormType.DOMAIN]).toBe(
        '/api/v1/domains'
      );
      expect(ENTITY_API_ENDPOINTS[DomainFormType.SUBDOMAIN]).toBe(
        '/api/v1/domains'
      );
      expect(ENTITY_API_ENDPOINTS[DomainFormType.DATA_PRODUCT]).toBe(
        '/api/v1/dataProducts'
      );
    });
  });

  describe('getEntityTypeFromData', () => {
    it('should return DATA_PRODUCT for CreateDataProduct', () => {
      const data: MockCreateDataProduct = {
        name: 'n',
        description: 'd',
        domain: 'dom',
      };

      expect(
        getEntityTypeFromData(data as CreateDomain | CreateDataProduct)
      ).toBe(DomainFormType.DATA_PRODUCT);
    });

    it('should return SUBDOMAIN for CreateDomain with parent', () => {
      const data: MockCreateDomain = {
        name: 'n',
        description: 'd',
        domainType: DomainType.Aggregate,
        parent: 'p',
      };

      expect(
        getEntityTypeFromData(data as CreateDomain | CreateDataProduct)
      ).toBe(DomainFormType.SUBDOMAIN);
    });

    it('should return DOMAIN for CreateDomain without parent', () => {
      const data: MockCreateDomain = {
        name: 'n',
        description: 'd',
        domainType: DomainType.Aggregate,
      };

      expect(
        getEntityTypeFromData(data as CreateDomain | CreateDataProduct)
      ).toBe(DomainFormType.DOMAIN);
    });
  });
});
