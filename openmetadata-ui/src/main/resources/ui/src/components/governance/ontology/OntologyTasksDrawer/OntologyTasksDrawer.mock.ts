/*
 *  Copyright 2026 Collate.
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
  AssigneeStatus,
  EntityStatus,
  OntologyApprovalRule,
  OntologyReleaseReview,
} from '../../../../generated/api/data/ontologyReleaseReview';
import {
  EncodingVersion,
  EntityStatus as ReleaseStatus,
  LogicalCheck,
  OntologyRelease,
} from '../../../../generated/entity/data/ontologyRelease';
import {
  ResolutionType,
  Task,
  TaskCategory,
  TaskStatus,
  TaskType,
} from '../../../../generated/entity/tasks/task';

export const reviewer = { id: 'reviewer', name: 'Reviewer', type: 'user' };
export const review: OntologyReleaseReview = {
  task: { id: 'task', type: 'task' },
  taskId: 'TASK-00042',
  release: { id: 'release', type: 'ontologyRelease' },
  ontology: { id: 'ontology', name: 'Commerce', type: 'ontology' },
  status: EntityStatus.InReview,
  approvalRule: OntologyApprovalRule.AllReviewers,
  callerCanVote: true,
  callerCompletesRule: false,
  requester: { id: 'author', name: 'Author', type: 'user' },
  assignees: [{ assignee: reviewer, status: AssigneeStatus.Pending }],
};
export const task: Task = {
  id: 'task',
  name: 'Review Commerce',
  type: TaskType.RequestApproval,
  status: TaskStatus.Open,
  category: TaskCategory.Approval,
  about: review.release,
  createdBy: review.requester ?? reviewer,
  ontologyReview: {
    entityId: 'release',
    ontologyId: 'ontology',
    entityVersion: 0.2,
    contentDigest: 'a'.repeat(64),
    author: 'author',
  },
  availableTransitions: [
    {
      id: 'approve',
      label: 'Approve',
      resolutionType: ResolutionType.Approved,
      targetStageId: 'approved',
      targetTaskStatus: TaskStatus.Approved,
    },
    {
      id: 'reject',
      label: 'Reject',
      resolutionType: ResolutionType.Rejected,
      targetStageId: 'rejected',
      targetTaskStatus: TaskStatus.Rejected,
    },
  ],
  comments: [],
};
export const release: OntologyRelease = {
  id: 'release',
  name: 'Commerce release',
  fullyQualifiedName: 'Commerce.release',
  ontology: review.ontology,
  semanticVersion: '1.4.0',
  entityStatus: ReleaseStatus.InReview,
  contentDigest: 'b'.repeat(64),
  version: 0.2,
  encodingVersion: EncodingVersion.OntologyReleaseV1,
  logicalCheck: LogicalCheck.NotRun,
  memberCount: 1,
  ontologyIri: 'urn:commerce',
  releaseRevision: 1,
  sealedAt: 1,
  sealedBy: 'author',
  sourceWorkingRevision: 1,
  totalBytes: 1,
  versionIri: 'urn:commerce:1',
};
