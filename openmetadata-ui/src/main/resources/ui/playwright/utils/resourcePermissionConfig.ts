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

import { DashboardClass } from '../support/entity/DashboardClass';
import { TableClass } from '../support/entity/TableClass';

export interface OperationConfig {
  testId: string;
  type: 'button' | 'tab' | 'menu' | 'link';
  errorMessage?: string;
  requiresNavigation?: boolean;
}

export interface ResourceConfig {
  entityClass: any;
  operations: Record<string, OperationConfig>;
  pagePath?: string;
  requiresSpecialSetup?: boolean;
}

export const RESOURCE_PERMISSION_CONFIG: Record<string, ResourceConfig> = {
  table: {
    entityClass: TableClass,
    operations: {
      EditDescription: {
        testId: 'edit-description',
        type: 'button',
      },
      EditTags: {
        testId: 'edit-tags',
        type: 'button',
      },
      EditGlossaryTerms: {
        testId: 'edit-glossary-terms',
        type: 'button',
      },
      EditTier: {
        testId: 'edit-tier',
        type: 'button',
      },
      EditOwners: {
        testId: 'edit-owner',
        type: 'button',
      },
      EditLineage: {
        testId: 'edit-lineage',
        type: 'button',
      },
      EditEntityRelationship: {
        testId: 'edit-entity-relationship',
        type: 'button',
      },
      EditDisplayName: {
        testId: 'edit-display-name',
        type: 'button',
      },
      EditCustomFields: {
        testId: 'edit-custom-fields',
        type: 'button',
      },
      EditCertification: {
        testId: 'edit-certification',
        type: 'button',
      },

      // Table-specific operations (from TableResource.getEntitySpecificOperations())
      ViewTests: {
        testId: 'tests',
        type: 'tab',
        errorMessage: "You don't have necessary permissions to view tests",
      },
      ViewQueries: {
        testId: 'table_queries',
        type: 'tab',
        errorMessage: "You don't have necessary permissions to view queries",
      },
      ViewDataProfile: {
        testId: 'profiler',
        type: 'tab',
        errorMessage:
          "You don't have necessary permissions to view data profile",
      },
      ViewSampleData: {
        testId: 'sample_data',
        type: 'tab',
      },
      ViewUsage: {
        testId: 'usage',
        type: 'tab',
      },
      ViewProfilerGlobalConfiguration: {
        testId: 'profiler-config',
        type: 'tab',
      },
      EditTests: {
        testId: 'edit-tests',
        type: 'button',
        errorMessage: "You don't have necessary permissions to edit tests",
      },
      EditQueries: {
        testId: 'edit-queries',
        type: 'button',
        errorMessage: "You don't have necessary permissions to edit queries",
      },
      EditDataProfile: {
        testId: 'edit-data-profile',
        type: 'button',
      },
      EditSampleData: {
        testId: 'edit-sample-data',
        type: 'button',
      },
    },
  },
  dashboard: {
    entityClass: DashboardClass,
    operations: {
      // Common operations
      EditDescription: {
        testId: 'edit-description',
        type: 'button',
      },
      EditTags: {
        testId: 'edit-tags',
        type: 'button',
        errorMessage: "You don't have necessary permissions to edit tags",
      },
      EditGlossaryTerms: {
        testId: 'edit-glossary-terms',
        type: 'button',
        errorMessage:
          "You don't have necessary permissions to edit glossary terms",
      },
      EditTier: {
        testId: 'edit-tier',
        type: 'button',
        errorMessage: "You don't have necessary permissions to edit tier",
      },
      EditOwners: {
        testId: 'edit-owner',
        type: 'button',
      },
      EditLineage: {
        testId: 'edit-lineage',
        type: 'button',
        errorMessage: "You don't have necessary permissions to edit lineage",
      },
      EditDisplayName: {
        testId: 'edit-display-name',
        type: 'button',
      },
      EditCustomFields: {
        testId: 'edit-custom-fields',
        type: 'button',
        errorMessage:
          "You don't have necessary permissions to edit custom fields",
      },
      EditCertification: {
        testId: 'edit-certification',
        type: 'button',
      },

      // Dashboard-specific operations (from DashboardResource.getEntitySpecificOperations())
      ViewUsage: {
        testId: 'usage',
        type: 'tab',
        errorMessage: "You don't have necessary permissions to view usage",
      },
    },
  },
};

/**
 * Special resources that don't have entity classes but need permission testing
 */
export const SPECIAL_RESOURCE_CONFIG: Record<
  string,
  Partial<ResourceConfig>
> = {
  user: {
    operations: {
      EditDescription: {
        testId: 'edit-description',
        type: 'button',
      },
      EditUsers: {
        testId: 'edit-users',
        type: 'button',
      },
    },
    pagePath: '/users',
  },
  team: {
    operations: {
      EditDescription: {
        testId: 'edit-description',
        type: 'button',
      },
      EditTeams: {
        testId: 'edit-teams',
        type: 'button',
      },
      EditPolicy: {
        testId: 'edit-policy',
        type: 'button',
      },
      EditUsers: {
        testId: 'edit-users',
        type: 'button',
      },
    },
    pagePath: '/teams',
  },
  glossary: {
    operations: {
      EditDescription: {
        testId: 'edit-description',
        type: 'button',
      },
      EditTerms: {
        testId: 'edit-terms',
        type: 'button',
      },
    },
    pagePath: '/glossary',
  },
  role: {
    operations: {
      EditRole: {
        testId: 'edit-role',
        type: 'button',
      },
      EditPolicy: {
        testId: 'edit-policy',
        type: 'button',
      },
    },
    pagePath: '/roles',
  },
  policy: {
    operations: {
      EditPolicy: {
        testId: 'edit-policy',
        type: 'button',
      },
    },
    pagePath: '/policies',
  },
  ingestionPipeline: {
    operations: {
      EditDescription: {
        testId: 'edit-description',
        type: 'button',
      },
      EditTags: {
        testId: 'edit-tags',
        type: 'button',
        errorMessage: "You don't have necessary permissions to edit tags",
      },
      EditGlossaryTerms: {
        testId: 'edit-glossary-terms',
        type: 'button',
      },
      EditTier: {
        testId: 'edit-tier',
        type: 'button',
      },
      EditOwners: {
        testId: 'edit-owner',
        type: 'button',
      },
      EditIngestionPipelineStatus: {
        testId: 'edit-ingestion-pipeline-status',
        type: 'button',
      },
      Deploy: {
        testId: 'deploy',
        type: 'button',
      },
      Trigger: {
        testId: 'trigger',
        type: 'button',
      },
      Kill: {
        testId: 'kill',
        type: 'button',
      },
    },
    pagePath: '/ingestion',
  },
};

export const getResourceOperations = (resourceName: string): string[] => {
  const config =
    RESOURCE_PERMISSION_CONFIG[resourceName] ||
    SPECIAL_RESOURCE_CONFIG[resourceName];

  return config ? Object.keys(config.operations) : [];
};

export const getOperationConfig = (
  resourceName: string,
  operation: string
): OperationConfig | undefined => {
  const config =
    RESOURCE_PERMISSION_CONFIG[resourceName] ||
    SPECIAL_RESOURCE_CONFIG[resourceName];

  return config?.operations[operation];
};

export const getEntityClass = (resourceName: string): any => {
  return RESOURCE_PERMISSION_CONFIG[resourceName]?.entityClass;
};

export const hasEntityClass = (resourceName: string): boolean => {
  return !!RESOURCE_PERMISSION_CONFIG[resourceName]?.entityClass;
};

export const getEntityResources = (): string[] => {
  return Object.keys(RESOURCE_PERMISSION_CONFIG);
};

export const getSpecialResources = (): string[] => {
  return Object.keys(SPECIAL_RESOURCE_CONFIG);
};

export const getAllResources = (): string[] => {
  return [...getEntityResources(), ...getSpecialResources()];
};
