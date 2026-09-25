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

import { BadgeColors } from '@openmetadata/ui-core-components';
import { EntityReference, Task } from '../../../../generated/entity/tasks/task';
import { TestCase } from '../../../../generated/tests/testCase';
import {
  Severities,
  TestCaseResolutionStatus,
} from '../../../../generated/tests/testCaseResolutionStatus';
import { TagLabel } from '../../../../generated/type/tagLabel';
import { EntityUnion } from '../../../Explore/ExplorePage.interface';

/**
 * The detail pane is described as data, never as JSX: a task type contributes a
 * descriptor, one renderer draws it. That keeps the per-type knowledge in pure,
 * testable functions and lets a plugin override a slice of it (see
 * `InboxTaskPanelContribution`) without owning the layout.
 */

/** Icon slot for a summary row; the renderer maps the key to a component. */
export type TaskDetailRowIcon =
  | 'calendar'
  | 'clock'
  | 'owner'
  | 'shield'
  | 'source'
  | 'tag'
  | 'type'
  | 'user';

export type TaskDetailRowValue =
  | { kind: 'text'; text: string }
  | { kind: 'date'; timestamp?: number }
  | { kind: 'users'; refs: EntityReference[] }
  | { kind: 'tags'; tags: TagLabel[] }
  | { kind: 'link'; label: string; to: string };

export interface TaskDetailRow {
  /** Stable React key, unique within the descriptor. */
  key: string;
  icon: TaskDetailRowIcon;
  /** Already translated. */
  label: string;
  value: TaskDetailRowValue;
}

/** The bordered box that carries the request's rationale, policy or context. */
export interface TaskDetailCallout {
  /** Already translated; rendered uppercase. */
  label: string;
  text: string;
}

export interface TaskTypeBadge {
  /** Already translated. */
  label: string;
  color: BadgeColors;
  icon: TaskTypeIconKey;
}

/** Icon slot for the task type, shared by the list row and the detail header. */
export type TaskTypeIconKey =
  | 'access'
  | 'approval'
  | 'deprecation'
  | 'description'
  | 'incident'
  | 'ownership'
  | 'tag'
  | 'tier';

/** Action labels a task type may override, keyed by the action's kind. */
export type TaskActionLabelOverrides = Partial<
  Record<'approve' | 'reject', string>
>;

export interface TaskDetailDescriptor {
  typeBadge: TaskTypeBadge;
  /**
   * i18n key for the "who did what, when" line under the title. Interpolates
   * `user` and `time`.
   */
  subtitleKey: string;
  actionLabels?: TaskActionLabelOverrides;
  rows: TaskDetailRow[];
  callout?: TaskDetailCallout;
  /**
   * The timeline's "created" event in the type's own words, e.g. "created this
   * access request — Full Access, 14 Days". Interpolates `user`.
   */
  createdEvent?: { textKey: string; textParams?: Record<string, string> };
}

/**
 * The about-entity context behind the asset card's stat tiles. Every field is
 * optional: an entity type with no handler, a lineage call that fails, or a
 * non-table asset each leave their tiles out rather than failing the pane.
 */
export interface TaskAboutEntity {
  entity?: EntityUnion;
  tier?: TagLabel;
  columnCount?: number;
  piiColumnCount?: number;
  downstreamCount?: number;
  /** Usage count for the current calendar week, not a rolling seven days. */
  weeklyQueryCount?: number;
  /** The failing test case behind an incident. */
  testCase?: TestCase;
  /** FQN of the table an incident's test case runs against. */
  testCaseTableFqn?: string;
  /** Severity on the incident's latest status record, which the task does not carry. */
  incidentSeverity?: Severities;
  /** The incident's status records, oldest first: its real event history. */
  incidentStatuses?: TestCaseResolutionStatus[];
  ownerCount?: number;
  updatedAt?: number;
}

/**
 * One tile in the asset card's strip. Data, not markup, so the per-type choice
 * of tiles stays a pure function and one renderer draws every tile set.
 */
export interface StatTile {
  key: string;
  /** Already translated. */
  label: string;
  value: string;
  /**
   * `metric` puts a large value over its label — a count or a time. `field`
   * puts the label first — a named property such as a test type.
   */
  layout?: 'metric' | 'field';
  /** Colours a value that needs a reviewer's attention. */
  tone?: 'error' | 'warning';
  /** Renders the value as a link. */
  to?: string;
  /** Renders the value as a coloured badge. */
  badgeColor?: BadgeColors;
}

export interface TaskStatTilesProps {
  task: Task;
  about?: TaskAboutEntity;
  isLoading: boolean;
}
