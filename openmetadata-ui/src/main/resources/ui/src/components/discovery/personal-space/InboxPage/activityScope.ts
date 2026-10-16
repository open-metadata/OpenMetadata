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
import { EntityType } from '../../../../enums/entity.enum';
import EntityLink from '../../../../utils/EntityLink';
import { ActivityFilter } from './inbox.utils';
import type { TaskListScope } from './useTaskQueue';

/**
 * Whose activity a feed reads: the viewer's own Inbox, everything about one
 * entity, or what one user did.
 */
export type ActivityScope =
  | { type: 'inbox' }
  | { type: 'entity'; entityLink: string }
  | { type: 'user'; userName: string };

export const INBOX_SCOPE: ActivityScope = { type: 'inbox' };

/** The feeds each scope offers; the first is its default. */
export const SCOPE_FILTERS: Record<ActivityScope['type'], ActivityFilter[]> = {
  inbox: [
    ActivityFilter.All,
    ActivityFilter.Mentions,
    ActivityFilter.MyAssets,
    ActivityFilter.Following,
  ],
  entity: [ActivityFilter.All, ActivityFilter.Mentions],
  user: [ActivityFilter.All],
};

/** A user link reads what that user did; any other link, what happened to it. */
export const getActivityScope = (entityLink: string): ActivityScope =>
  EntityLink.getEntityType(entityLink) === EntityType.USER
    ? { type: 'user', userName: EntityLink.getEntityFqn(entityLink) }
    : { type: 'entity', entityLink };

/** The tasks a link's feed holds: about the entity, or assigned to the user. */
export const getTaskListScope = (entityLink: string): TaskListScope =>
  EntityLink.getEntityType(entityLink) === EntityType.USER
    ? { type: 'assignee', assignee: EntityLink.getEntityFqn(entityLink) }
    : { type: 'entity', aboutEntity: EntityLink.getEntityFqn(entityLink) };

/** A stable cache-key part, so each scope keeps its own lists. */
export const getActivityScopeKey = (scope: ActivityScope): string => {
  switch (scope.type) {
    case 'entity':
      return `entity:${scope.entityLink}`;
    case 'user':
      return `user:${scope.userName}`;
    default:
      return 'inbox';
  }
};
