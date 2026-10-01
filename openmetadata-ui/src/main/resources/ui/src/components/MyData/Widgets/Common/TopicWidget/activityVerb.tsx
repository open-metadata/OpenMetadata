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

import { TFunction } from 'i18next';
import { ActivityEventType } from '../../../../../generated/entity/activity/activityEvent';

/**
 * The phrase between the actor and the entity, e.g. "added tags to".
 *
 * OSS builds the same sentences in `FeedUtils`' ACTIVITY_EVENT_HEADER_RENDERERS,
 * but that map is unexported and returns Ant Design nodes, so it cannot be
 * reused here. The label keys below are the ones it uses, so the wording stays
 * identical across both feeds without adding a translation per verb.
 */
const UPDATED = 'label.updated-lowercase';
const ADDED = 'label.added-lowercase';

const FIELD_VERBS: Partial<
  Record<ActivityEventType, { field: string; action: string }>
> = {
  [ActivityEventType.ColumnDescriptionUpdated]: {
    action: UPDATED,
    field: 'label.description',
  },
  [ActivityEventType.ColumnTagsUpdated]: {
    action: ADDED,
    field: 'label.tag-plural',
  },
  [ActivityEventType.DescriptionUpdated]: {
    action: UPDATED,
    field: 'label.description',
  },
  [ActivityEventType.DomainUpdated]: {
    action: UPDATED,
    field: 'label.domain',
  },
  [ActivityEventType.OwnerUpdated]: {
    action: UPDATED,
    field: 'label.owner',
  },
  [ActivityEventType.TagsUpdated]: {
    action: ADDED,
    field: 'label.tag-plural',
  },
  [ActivityEventType.TierUpdated]: {
    action: UPDATED,
    field: 'label.tier',
  },
};

const SIMPLE_VERBS: Partial<Record<ActivityEventType, string>> = {
  [ActivityEventType.EntityCreated]: 'label.created-lowercase',
  [ActivityEventType.EntityDeleted]: 'label.deleted-lowercase',
  [ActivityEventType.EntityRestored]: 'label.restored-lowercase',
  [ActivityEventType.EntitySoftDeleted]: 'label.deleted-lowercase',
  [ActivityEventType.EntityUpdated]: UPDATED,
};

/**
 * Renders as "<actor> {verb} <entity>", so the phrase carries the preposition
 * and the caller supplies both ends.
 */
export const getActivityVerb = (
  eventType: ActivityEventType,
  t: TFunction
): string => {
  const fieldVerb = FIELD_VERBS[eventType];
  if (fieldVerb) {
    return `${t(fieldVerb.action)} ${t(fieldVerb.field).toLowerCase()}`;
  }

  const simpleVerb = SIMPLE_VERBS[eventType];

  // An unmapped event still reads sensibly as a generic update rather than
  // leaving a gap in the sentence.
  return t(simpleVerb ?? UPDATED);
};
