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

import { CreateDataProduct } from '../../../generated/api/domains/createDataProduct';
import { CreateDomain } from '../../../generated/api/domains/createDomain';
import { EntityReference } from '../../../generated/entity/type';
import { TagLabel } from '../../../generated/type/tagLabel';
import { DomainFormType } from '../../Domain/DomainPage.interface';

// Union type for all possible create types
export type CreateEntityType = CreateDomain | CreateDataProduct;

// Generic form configuration interface
export interface EntityFormConfig<T extends CreateEntityType> {
  /**
   * Type of entity being created
   */
  entityType: DomainFormType;

  /**
   * Form submission callback
   */
  onSubmit: (data: T) => Promise<void>;

  /**
   * Form title override
   */
  title?: string;

  /**
   * Additional form fields specific to entity type
   */
  additionalFields?: Record<string, unknown>;

  /**
   * Fields to exclude from the form
   */
  excludeFields?: string[];

  /**
   * Whether to show the domain type field (for domains/subdomains)
   */
  showDomainType?: boolean;

  /**
   * Whether to show the parent domain selector (for subdomains)
   */
  showParentDomain?: boolean;

  /**
   * Whether to show the domain selector (for data products)
   */
  showDomainSelector?: boolean;

  /**
   * Whether to show the assets selector (for data products)
   */
  showAssetsSelector?: boolean;

  /**
   * Default values for the form
   */
  defaultValues?: Partial<T>;

  /**
   * Parent domain for subdomains
   */
  parentDomain?: string;

  /**
   * Available domains for data products
   */
  availableDomains?: Array<{ label: string; value: string }>;
}

// Generic form props interface
export interface AddEntityFormProps<T extends CreateEntityType> {
  /**
   * Whether the panel is open/visible
   */
  open: boolean;

  /**
   * Callback fired when the panel is closed
   */
  onClose: () => void;

  /**
   * Whether the form is in loading state
   */
  loading?: boolean;

  /**
   * Form configuration
   */
  config: EntityFormConfig<T>;
}

// Specific type aliases for better developer experience
export type DomainFormProps = AddEntityFormProps<CreateDomain>;
export type DataProductFormProps = AddEntityFormProps<CreateDataProduct>;
export type SubdomainFormProps = AddEntityFormProps<CreateDomain>;

// Helper type to determine form type from entity type
export type EntityFormType<T extends DomainFormType> =
  T extends DomainFormType.DATA_PRODUCT ? CreateDataProduct : CreateDomain;

// Form values interface for type-safe form handling
export interface FormValues {
  name: string;
  displayName?: string;
  description: string;
  tags?: TagLabel[];
  glossaryTerms?: TagLabel[];
  domainType?: string;
  domain?: string;
  parent?: string;
  owners?: EntityReference[];
  experts?: string[];
  color?: string;
  iconURL?: string;
  coverImageURL?: string;
  style?: {
    color?: string;
    iconURL?: string;
  };
  assets?: EntityReference[];
  extension?: Record<string, unknown>;
}

// Factory function types for form configurations
export interface EntityFormConfigFactory {
  domain: (
    config?: Partial<EntityFormConfig<CreateDomain>>
  ) => EntityFormConfig<CreateDomain>;
  subdomain: (
    config?: Partial<EntityFormConfig<CreateDomain>>
  ) => EntityFormConfig<CreateDomain>;
  dataProduct: (
    config?: Partial<EntityFormConfig<CreateDataProduct>>
  ) => EntityFormConfig<CreateDataProduct>;
}
