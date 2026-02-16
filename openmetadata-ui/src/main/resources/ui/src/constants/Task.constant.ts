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

import { TaskEntityType } from '../rest/tasksAPI';

export const TASK_TYPES = {
  RequestTag: 'message.request-tags-message',
  RequestDescription: 'message.request-description-message',
  UpdateTag: 'message.update-tag-message',
  UpdateDescription: 'message.update-description-message',
  RequestTestCaseFailureResolution:
    'message.request-test-case-failure-resolution-message',
  RequestApproval: 'message.request-approval-message',
  RecognizerFeedbackApproval: 'message.recognizer-feedback-approval-message',
  Generic: 'message.request-tags-message',
};

export const TASK_ENTITY_TYPES: Record<TaskEntityType, string> = {
  [TaskEntityType.GlossaryApproval]: 'message.request-approval-message',
  [TaskEntityType.DataAccessRequest]: 'message.data-access-request-message',
  [TaskEntityType.DescriptionUpdate]: 'message.update-description-message',
  [TaskEntityType.TagUpdate]: 'message.update-tag-message',
  [TaskEntityType.OwnershipUpdate]: 'message.ownership-update-message',
  [TaskEntityType.TierUpdate]: 'message.tier-update-message',
  [TaskEntityType.DomainUpdate]: 'message.domain-update-message',
  [TaskEntityType.Suggestion]: 'message.suggestion-message',
  [TaskEntityType.TestCaseResolution]:
    'message.request-test-case-failure-resolution-message',
  [TaskEntityType.IncidentResolution]: 'message.incident-resolution-message',
  [TaskEntityType.PipelineReview]: 'message.pipeline-review-message',
  [TaskEntityType.DataQualityReview]: 'message.data-quality-review-message',
  [TaskEntityType.CustomTask]: 'message.custom-task-message',
};
