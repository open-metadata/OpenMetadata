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
import { TaskType } from '../../../../generated/entity/tasks/task';
import type { TaskTypeBadge } from './taskDetail.types';

// Task labels shared by the Inbox and the AI-mode global search. Kept free of
// UI and store imports so the search can label tasks without loading the Inbox.

// Type → badge label / colour / icon. Colour carries meaning here (an incident
// reads red, an access request blue), so it is declared per type rather than
// derived from the category, which is coarser.
export const TASK_TYPE_BADGE: Record<
  string,
  {
    labelKey: string;
    color: TaskTypeBadge['color'];
    icon: TaskTypeBadge['icon'];
  }
> = {
  [TaskType.TestCaseResolution]: {
    labelKey: 'label.incident',
    color: 'error',
    icon: 'incident',
  },
  [TaskType.IncidentResolution]: {
    labelKey: 'label.incident',
    color: 'error',
    icon: 'incident',
  },
  [TaskType.DataAccessRequest]: {
    labelKey: 'label.access-request',
    color: 'blue',
    icon: 'access',
  },
  [TaskType.TagUpdate]: {
    labelKey: 'label.tag-request',
    color: 'purple',
    icon: 'tag',
  },
  [TaskType.OwnershipUpdate]: {
    labelKey: 'label.ownership',
    color: 'blue-light',
    icon: 'ownership',
  },
  [TaskType.DescriptionUpdate]: {
    labelKey: 'label.description',
    color: 'gray',
    icon: 'description',
  },
  [TaskType.Suggestion]: {
    labelKey: 'label.suggestion',
    color: 'gray',
    icon: 'description',
  },
  [TaskType.TierUpdate]: {
    labelKey: 'label.tier',
    color: 'orange',
    icon: 'tier',
  },
  [TaskType.DomainUpdate]: {
    labelKey: 'label.domain',
    color: 'indigo',
    icon: 'approval',
  },
  [TaskType.GlossaryApproval]: {
    labelKey: 'label.glossary',
    color: 'brand',
    icon: 'approval',
  },
  [TaskType.RequestApproval]: {
    labelKey: 'label.approval',
    color: 'brand',
    icon: 'approval',
  },
  [TaskType.CustomTask]: {
    labelKey: 'label.custom-task',
    color: 'gray',
    icon: 'approval',
  },
  [TaskType.DataQualityReview]: {
    labelKey: 'label.data-quality-review',
    color: 'blue-light',
    icon: 'approval',
  },
  [TaskType.PipelineReview]: {
    labelKey: 'label.pipeline-review',
    color: 'indigo',
    icon: 'approval',
  },
  [TaskType.MemoryConflictReview]: {
    labelKey: 'label.memory-conflict',
    color: 'orange',
    icon: 'approval',
  },
  [TaskType.MetadataCompletion]: {
    labelKey: 'label.missing-metadata',
    color: 'warning',
    icon: 'description',
  },
  [TaskType.RecognizerFeedbackApproval]: {
    labelKey: 'label.recognizer-feedback',
    color: 'purple',
    icon: 'tag',
  },
};

export const DEFAULT_TYPE_BADGE = {
  labelKey: 'label.task',
  color: 'gray' as TaskTypeBadge['color'],
  icon: 'approval' as TaskTypeBadge['icon'],
};

/**
 * A task status enum value ("InProgress") → its kebab i18n label key
 * ("label.in-progress"). Generic over any TaskStatus.
 */
export const toStatusLabelKey = (status: string): string =>
  `label.${status.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`;

/** The label key a task type reads as, e.g. in a type filter. */
export const getTaskTypeLabelKey = (type: string) =>
  (TASK_TYPE_BADGE[type] ?? DEFAULT_TYPE_BADGE).labelKey;
