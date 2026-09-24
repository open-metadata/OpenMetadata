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

import { startCase } from 'lodash';
import { EntityType } from '../../../../enums/entity.enum';
import {
  Task,
  TaskCategory,
  TaskType,
} from '../../../../generated/entity/tasks/task';
import { TagUpdatePayload } from '../../../../generated/type/tagUpdatePayload';
import { TestCaseResolutionPayload } from '../../../../generated/type/testCaseResolutionPayload';
import { getRelativeTime } from '../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import Fqn from '../../../../utils/Fqn';
import { getEntityDetailsPath } from '../../../../utils/RouterUtils';
import { StatTile, TaskAboutEntity } from './taskDetail.types';
import { getTaskStatusBadge } from './taskResolution.utils';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/*
 * Tile factories. Each returns an empty array when its number is unknown, so a
 * tile set is just a concatenation and a missing figure hides its tile rather
 * than showing a value nobody can vouch for. Exported so a plugin composing its
 * own tile set for a task type it owns draws the same tiles.
 */

export const downstreamTile = (
  about: TaskAboutEntity,
  t: Translate
): StatTile[] =>
  about.downstreamCount === undefined
    ? []
    : [
        {
          key: 'downstream',
          label: t('label.downstream-asset-plural'),
          value: String(about.downstreamCount),
        },
      ];

/** Column count, with the PII-tagged share called out when there is one. */
export const columnsTile = (
  about: TaskAboutEntity,
  t: Translate
): StatTile[] => {
  if (about.columnCount === undefined) {
    return [];
  }
  const piiCount = about.piiColumnCount ?? 0;

  return [
    {
      key: 'columns',
      label: piiCount
        ? t('label.column-plural-pii-count', { count: piiCount })
        : t('label.column-plural'),
      value: String(about.columnCount),
      tone: piiCount ? 'error' : undefined,
    },
  ];
};

// A calendar-week figure, so it is labelled as this week rather than as the
// last seven days.
export const queriesTile = (about: TaskAboutEntity, t: Translate): StatTile[] =>
  about.weeklyQueryCount === undefined
    ? []
    : [
        {
          key: 'queries',
          label: t('label.queries-this-week'),
          value: String(about.weeklyQueryCount),
        },
      ];

// The only timestamp available is the last metadata change — not data
// freshness — so the label names exactly that.
export const metadataUpdatedTile = (
  about: TaskAboutEntity,
  t: Translate
): StatTile[] =>
  about.updatedAt
    ? [
        {
          key: 'updatedAt',
          label: t('label.metadata-updated'),
          value: getRelativeTime(about.updatedAt),
        },
      ]
    : [];

const getIncidentTiles = (
  task: Task,
  about: TaskAboutEntity,
  t: Translate
): StatTile[] => {
  const testDefinition = about.testCase?.testDefinition;
  const tableFqn = about.testCaseTableFqn;
  const severity = (task.payload as Partial<TestCaseResolutionPayload>)
    ?.severity;
  // The workflow names the incident's stage (new, acknowledged, assigned…);
  // the raw task status only says whether it is still open.
  const status =
    task.workflowStageDisplayName ?? getTaskStatusBadge(task, t)?.label;

  return [
    ...(testDefinition
      ? [
          {
            key: 'testType',
            label: t('label.test-type'),
            value: getEntityName(testDefinition),
            layout: 'field' as const,
          },
        ]
      : []),
    ...(tableFqn
      ? [
          {
            key: 'table',
            label: t('label.table'),
            value: Fqn.split(tableFqn).pop() ?? tableFqn,
            to: getEntityDetailsPath(EntityType.TABLE, tableFqn),
            layout: 'field' as const,
          },
        ]
      : []),
    // Same wording as the incident manager's own severity chip.
    ...(severity
      ? [
          {
            key: 'severity',
            label: t('label.severity'),
            value: startCase(severity),
            badgeColor: 'error' as const,
            layout: 'field' as const,
          },
        ]
      : []),
    ...(status
      ? [
          {
            key: 'incidentStatus',
            label: t('label.incident-status'),
            value: status,
            badgeColor: 'warning' as const,
            layout: 'field' as const,
          },
        ]
      : []),
  ];
};

const getTagTiles = (
  task: Task,
  about: TaskAboutEntity,
  t: Translate
): StatTile[] => [
  ...queriesTile(about, t),
  {
    key: 'currentTags',
    label: t('label.current-entity', { entity: t('label.tag-plural') }),
    value: String(
      (task.payload as Partial<TagUpdatePayload>)?.currentTags?.length ?? 0
    ),
  },
];

// Nothing records when an asset lost its owner, so an unowned asset says so
// plainly, with no duration.
const getOwnershipTiles = (
  about: TaskAboutEntity,
  t: Translate
): StatTile[] => {
  if (about.ownerCount === undefined) {
    return downstreamTile(about, t);
  }
  const owners = (about.entity as { owners?: { name?: string }[] })?.owners;

  return [
    {
      key: 'currentOwners',
      label: t('label.current-entity', { entity: t('label.owner-plural') }),
      value: String(about.ownerCount),
      tone: about.ownerCount ? undefined : 'warning',
    },
    ...downstreamTile(about, t),
    {
      key: 'owner',
      label: t('label.owner'),
      value: about.ownerCount
        ? (owners ?? []).map((owner) => getEntityName(owner)).join(', ')
        : t('label.no-owner'),
    },
  ];
};

const isIncident = (task: Task) =>
  task.category === TaskCategory.Incident ||
  task.type === TaskType.TestCaseResolution ||
  task.type === TaskType.IncidentResolution;

/**
 * The tiles a task's asset card shows, chosen by task type: an incident shows
 * the failing test, a tag request its usage and current tags, an ownership
 * request who holds the asset, and everything else its general reach.
 */
export const getTaskStatTiles = (
  task: Task,
  about: TaskAboutEntity,
  t: Translate
): StatTile[] => {
  if (isIncident(task)) {
    return getIncidentTiles(task, about, t);
  }
  if (task.type === TaskType.TagUpdate) {
    return getTagTiles(task, about, t);
  }
  if (task.type === TaskType.OwnershipUpdate) {
    return getOwnershipTiles(about, t);
  }

  return [
    ...downstreamTile(about, t),
    ...columnsTile(about, t),
    ...queriesTile(about, t),
    ...metadataUpdatedTile(about, t),
  ];
};
