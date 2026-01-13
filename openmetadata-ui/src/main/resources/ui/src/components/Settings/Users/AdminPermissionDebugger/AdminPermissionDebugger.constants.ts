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

import { Operation } from '../../../../generated/entity/policies/accessControl/resourcePermission';

export const PERMISSION_OPERATIONS = [
  // View operations
  Operation.ViewAll,
  Operation.ViewBasic,
  Operation.ViewUsage,
  Operation.ViewTests,
  Operation.ViewQueries,
  Operation.ViewDataProfile,
  Operation.ViewSampleData,
  Operation.ViewProfilerGlobalConfiguration,
  Operation.ViewTestCaseFailedRowsSample,

  // Create operations
  Operation.Create,
  Operation.CreateIngestionPipelineAutomator,

  // Edit operations
  Operation.EditAll,
  Operation.EditDescription,
  Operation.EditDisplayName,
  Operation.EditLineage,
  Operation.EditOwners,
  Operation.EditCustomFields,
  Operation.EditTags,
  Operation.EditQueries,
  Operation.EditDataProfile,
  Operation.EditSampleData,
  Operation.EditTests,
  Operation.EditCertification,
  Operation.EditEntityRelationship,
  Operation.EditPolicy,
  Operation.EditReviewers,
  Operation.EditRole,
  Operation.EditStatus,
  Operation.EditGlossaryTerms,
  Operation.EditTeams,
  Operation.EditTier,
  Operation.EditUsage,
  Operation.EditUsers,
  Operation.EditLifeCycle,
  Operation.EditKnowledgePanel,
  Operation.EditPage,
  Operation.EditIngestionPipelineStatus,

  // Delete operations
  Operation.Delete,
  Operation.DeleteTestCaseFailedRowsSample,

  // Other operations
  Operation.Deploy,
  Operation.Trigger,
  Operation.Kill,
  Operation.GenerateToken,

  // SCIM operations
  Operation.CreateScim,
  Operation.EditScim,
  Operation.DeleteScim,
  Operation.ViewScim,
];

export const PERMISSION_RESOURCES = [
  'table',
  'database',
  'databaseSchema',
  'dashboard',
  'pipeline',
  'topic',
  'container',
  'mlmodel',
  'searchIndex',
  'glossary',
  'glossaryTerm',
  'tag',
  'policy',
  'role',
  'team',
  'user',
];
