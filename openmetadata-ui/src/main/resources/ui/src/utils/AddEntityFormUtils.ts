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
import {
  EntityFormConfig,
  EntityFormConfigFactory,
} from '../components/Domains/AddEntityForm/AddEntityForm.interface';
import { CreateDataProduct } from '../generated/api/domains/createDataProduct';
import { CreateDomain } from '../generated/api/domains/createDomain';

/**
 * Factory functions to create form configurations for different entity types
 */
export const createFormConfig: EntityFormConfigFactory = {
  /**
   * Create configuration for Domain form
   */
  domain: (config = {}) =>
    ({
      entityType: DomainFormType.DOMAIN,
      showDomainType: true,
      showParentDomain: false,
      showDomainSelector: false,
      showAssetsSelector: false,
      title: undefined, // Will use default based on entity type
      ...config,
    } as EntityFormConfig<CreateDomain>),

  /**
   * Create configuration for Subdomain form
   */
  subdomain: (config = {}) =>
    ({
      entityType: DomainFormType.SUBDOMAIN,
      showDomainType: true,
      showParentDomain: true,
      showDomainSelector: false,
      showAssetsSelector: false,
      title: undefined, // Will use default based on entity type
      ...config,
    } as EntityFormConfig<CreateDomain>),

  /**
   * Create configuration for Data Product form
   */
  dataProduct: (config = {}) =>
    ({
      entityType: DomainFormType.DATA_PRODUCT,
      showDomainType: false,
      showParentDomain: false,
      showDomainSelector: true,
      showAssetsSelector: true,
      title: undefined, // Will use default based on entity type
      ...config,
    } as EntityFormConfig<CreateDataProduct>),
};

/**
 * Type guards to check entity types
 */
export const isCreateDomain = (
  data: CreateDomain | CreateDataProduct
): data is CreateDomain => {
  return 'domainType' in data;
};

export const isCreateDataProduct = (
  data: CreateDomain | CreateDataProduct
): data is CreateDataProduct => {
  return 'domain' in data;
};

/**
 * Helper to convert domain list to dropdown options
 */
export const domainsToOptions = (
  domains: Array<{
    name: string;
    fullyQualifiedName?: string;
    displayName?: string;
  }>
) =>
  domains.map((domain) => ({
    label: domain.displayName || domain.name,
    value: domain.fullyQualifiedName || domain.name,
  }));

/**
 * Pre-configured form configurations for common use cases
 */
export const FORM_PRESETS = {
  /**
   * Standard domain creation form
   */
  CREATE_DOMAIN: createFormConfig.domain(),

  /**
   * Standard subdomain creation form
   */
  CREATE_SUBDOMAIN: (parentDomain: string) =>
    createFormConfig.subdomain({
      parentDomain,
      defaultValues: { parent: parentDomain },
    }),

  /**
   * Standard data product creation form
   */
  CREATE_DATA_PRODUCT: (
    availableDomains: Array<{ label: string; value: string }>
  ) =>
    createFormConfig.dataProduct({
      availableDomains,
    }),
} as const;

/**
 * Validation helpers for form data
 */
export const validateFormData = {
  domain: (data: CreateDomain): boolean => {
    return !!(data.name && data.description && data.domainType);
  },

  dataProduct: (data: CreateDataProduct): boolean => {
    return !!(data.name && data.description && data.domain);
  },

  subdomain: (data: CreateDomain): boolean => {
    return !!(data.name && data.description && data.domainType && data.parent);
  },
};

/**
 * Entity type to API endpoint mapping
 */
export const ENTITY_API_ENDPOINTS = {
  [DomainFormType.DOMAIN]: '/api/v1/domains',
  [DomainFormType.SUBDOMAIN]: '/api/v1/domains',
  [DomainFormType.DATA_PRODUCT]: '/api/v1/dataProducts',
} as const;

/**
 * Helper to get entity type from form data
 */
export function getEntityTypeFromData(
  data: CreateDomain | CreateDataProduct
): DomainFormType {
  if (isCreateDataProduct(data)) {
    return DomainFormType.DATA_PRODUCT;
  }

  if ('parent' in data && data.parent) {
    return DomainFormType.SUBDOMAIN;
  }

  return DomainFormType.DOMAIN;
}
