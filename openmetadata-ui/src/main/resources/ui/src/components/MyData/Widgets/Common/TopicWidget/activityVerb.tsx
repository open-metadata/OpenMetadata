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

import React from 'react';
import { Trans } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  ActivityEvent,
  ActivityEventType,
} from '../../../../../generated/entity/activity/activityEvent';
import { getEntityName } from '../../../../../utils/EntityNameUtils';

const UPDATED = 'message.activity-actor-updated-entity';
const DELETED = 'message.activity-actor-deleted-entity';
const STATUS_CHANGED = 'message.activity-actor-changed-status-of-entity';

/**
 * One whole sentence per event, with the actor and the entity as its slots.
 *
 * Each sentence is translated as a unit rather than assembled from a verb and
 * a field noun, so a locale can order the parts its own way and keep its own
 * capitalisation (a German noun stays capitalised mid-sentence).
 */
const SENTENCE_KEYS: Partial<Record<ActivityEventType, string>> = {
  [ActivityEventType.ColumnDescriptionUpdated]:
    'message.activity-actor-updated-column-description-of-entity',
  [ActivityEventType.ColumnTagsUpdated]:
    'message.activity-actor-updated-column-tags-of-entity',
  [ActivityEventType.CustomPropertyUpdated]:
    'message.activity-actor-updated-custom-property-of-entity',
  [ActivityEventType.DescriptionUpdated]:
    'message.activity-actor-updated-description-of-entity',
  [ActivityEventType.DomainUpdated]:
    'message.activity-actor-updated-domain-of-entity',
  [ActivityEventType.EntityCreated]: 'message.activity-actor-created-entity',
  [ActivityEventType.EntityDeleted]: DELETED,
  [ActivityEventType.EntityRestored]: 'message.activity-actor-restored-entity',
  [ActivityEventType.EntitySoftDeleted]: DELETED,
  [ActivityEventType.EntityUpdated]: UPDATED,
  [ActivityEventType.OwnerUpdated]:
    'message.activity-actor-updated-owners-of-entity',
  [ActivityEventType.PipelineStatusChanged]: STATUS_CHANGED,
  [ActivityEventType.TagsUpdated]:
    'message.activity-actor-updated-tags-of-entity',
  [ActivityEventType.TestCaseStatusChanged]: STATUS_CHANGED,
  [ActivityEventType.TierUpdated]:
    'message.activity-actor-updated-tier-of-entity',
};

/** An unmapped event still reads as a generic update rather than a gap. */
export const getActivitySentenceKey = (eventType: ActivityEventType): string =>
  SENTENCE_KEYS[eventType] ?? UPDATED;

export interface ActivitySentenceProps {
  event: ActivityEvent;
  /**
   * Where the entity name links to. Omit it where the sentence sits inside
   * another control (a card header's toggle), which must not nest a link.
   */
  entityLink?: string;
}

/** "<actor> updated the description of <entity>", translated as one sentence. */
export const ActivitySentence: React.FC<ActivitySentenceProps> = ({
  event,
  entityLink,
}) => (
  <Trans
    components={{
      actor: <span className="tw:font-medium tw:text-text-primary" />,
      entity: entityLink ? (
        <Link
          className="tw:font-medium tw:text-brand-secondary"
          data-testid={`activity-entity-link-${event.id}`}
          to={entityLink}
        />
      ) : (
        <span className="tw:font-medium tw:text-text-primary" />
      ),
    }}
    i18nKey={getActivitySentenceKey(event.eventType)}
    values={{
      actor: getEntityName(event.actor),
      entity: getEntityName(event.entity),
    }}
  />
);
