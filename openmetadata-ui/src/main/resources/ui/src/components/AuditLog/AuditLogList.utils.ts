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
import { isNil, isPlainObject, startCase } from 'lodash';
import { DateTime } from 'luxon';
import { NO_DATA_PLACEHOLDER } from '../../constants/constants';
import { EntityType } from '../../enums/entity.enum';
import {
  ChangeDescription,
  EventType,
  FieldChange,
} from '../../generated/type/changeEvent';
import { AuditLogEntry } from '../../types/auditLogs.interface';
import { getTextFromHtmlString } from '../../utils/BlockEditorPureUtils';
import { formatDateTime } from '../../utils/date-time/DateTimeUtils';
import { getEntityLinkFromType } from '../../utils/EntityLinkUtils';
import Fqn from '../../utils/Fqn';
import {
  getGlossaryPath,
  getTagPath,
  getTeamsWithFqnPath,
  getUserPath,
} from '../../utils/RouterUtils';
import { getSettingsLink } from '../../utils/SettingsModalLinkUtils';
import { isValidJSONString } from '../../utils/StringUtils';

export type ChangeAction = 'added' | 'updated' | 'removed';

export type ChangeRefKind = 'tier' | 'tag' | 'entity';

export interface ChangeRef {
  label: string;
  fqn: string;
  refKind: ChangeRefKind;
  /** Entity type of an entity reference (`user`, `team`, `domain`, ...). */
  entityType?: string;
  /** Tag source (`Classification` or `Glossary`). */
  source?: string;
}

export type ChangeValue =
  | { type: 'refs'; refs: ChangeRef[] }
  | {
      type: 'table';
      columns: string[];
      rows: Record<string, unknown>[];
      hiddenRowCount: number;
    }
  | { type: 'keyValue'; entries: [string, unknown][] }
  | { type: 'text'; text: string };

export interface ChangeRow {
  key: string;
  action: ChangeAction;
  name: string;
  path: string;
  oldValue?: ChangeValue;
  newValue?: ChangeValue;
}

export interface AuditLogDayGroup {
  dayKey: string;
  timestamp: number;
  logs: AuditLogEntry[];
}

export interface CellValue {
  text: string;
  color?: BadgeColors;
  isMono?: boolean;
}

export const MAX_TABLE_ROWS = 5;

/** Event type → badge label key and colour; unknown types fall back to a gray humanized name. */
export const EVENT_TYPE_BADGES: Partial<
  Record<string, { labelKey: string; color: BadgeColors }>
> = {
  [EventType.EntityCreated]: { labelKey: 'label.created', color: 'success' },
  [EventType.EntityUpdated]: { labelKey: 'label.updated', color: 'blue' },
  [EventType.EntityFieldsChanged]: {
    labelKey: 'label.updated',
    color: 'blue',
  },
  [EventType.EntitySoftDeleted]: {
    labelKey: 'label.soft-deleted',
    color: 'warning',
  },
  [EventType.EntityDeleted]: { labelKey: 'label.deleted', color: 'error' },
  [EventType.EntityRestored]: { labelKey: 'label.restored', color: 'success' },
  [EventType.UserLogin]: { labelKey: 'label.logged-in', color: 'blue-light' },
  [EventType.UserLogout]: {
    labelKey: 'label.logged-out',
    color: 'blue-light',
  },
};

export const CHANGE_ACTION_BADGES: Record<
  ChangeAction,
  { labelKey: string; color: BadgeColors }
> = {
  added: { labelKey: 'label.added', color: 'success' },
  updated: { labelKey: 'label.updated', color: 'blue' },
  removed: { labelKey: 'label.removed', color: 'error' },
};

const STATUS_COLORS: [RegExp, BadgeColors][] = [
  [/^(success|successful|passed|completed)$/, 'success'],
  [/^(failed|failure|error)$/, 'error'],
  [/^(aborted|queued|running|partialsuccess|pending)$/, 'warning'],
];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Epoch-millisecond values only — avoids formatting small counts under a "time" key as 1970 dates.
const MIN_EPOCH_MS = 1e11;

export const isAuthEvent = (eventType?: string) =>
  eventType === EventType.UserLogin || eventType === EventType.UserLogout;

/**
 * `columns.customer_id.tags` → "Columns › customer_id › Tags". Inner segments are entity
 * names, so they stay verbatim apart from FQN quoting (`columns."order.id".tags`).
 */
export const getFieldPath = (name?: string): string => {
  if (!name) {
    return '';
  }
  const parts = Fqn.split(name).map((part) => Fqn.unquoteName(part));
  if (parts.length === 1) {
    return startCase(parts[0]);
  }
  const [first, ...rest] = parts;
  const last = rest.pop();

  return [startCase(first), ...rest, startCase(last)].join(' › ');
};

export const parseChangeValue = (value: unknown): unknown => {
  if (typeof value !== 'string' || !isValidJSONString(value)) {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const isRefObject = (value: unknown): value is Record<string, unknown> => {
  if (!isPlainObject(value)) {
    return false;
  }
  const object = value as Record<string, unknown>;
  const hasName =
    typeof object.name === 'string' ||
    typeof object.fullyQualifiedName === 'string';

  return (
    typeof object.tagFQN === 'string' ||
    (typeof object.type === 'string' && hasName)
  );
};

const toChangeRef = (object: Record<string, unknown>): ChangeRef => {
  const name = object.name as string | undefined;
  const displayName = object.displayName as string | undefined;
  if (typeof object.tagFQN === 'string') {
    const isTier = object.tagFQN.startsWith('Tier.');

    return {
      fqn: object.tagFQN,
      refKind: isTier ? 'tier' : 'tag',
      source: object.source as string | undefined,
      label: isTier
        ? displayName || name || object.tagFQN
        : Fqn.split(object.tagFQN).join(' › '),
    };
  }
  const fqn = (object.fullyQualifiedName as string | undefined) ?? name ?? '';

  return {
    fqn,
    refKind: 'entity',
    entityType: object.type as string,
    label: displayName || name || fqn,
  };
};

const toTextValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return getTextFromHtmlString(value) || value;
  }
  if (Array.isArray(value)) {
    return value.map(toTextValue).filter(Boolean).join(', ');
  }

  return isPlainObject(value) ? JSON.stringify(value) : String(value);
};

/** Classifies a raw field value into the shape the list renders; `undefined` when there is nothing to show. */
export const toChangeValue = (raw: unknown): ChangeValue | undefined => {
  const value = parseChangeValue(raw);
  if (isNil(value) || value === '') {
    return undefined;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return undefined;
    }
    if (value.every(isRefObject)) {
      return { type: 'refs', refs: value.map(toChangeRef) };
    }
    if (value.every(isPlainObject)) {
      const rows = value as Record<string, unknown>[];
      const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];

      return {
        type: 'table',
        columns,
        rows: rows.slice(0, MAX_TABLE_ROWS),
        hiddenRowCount: Math.max(0, rows.length - MAX_TABLE_ROWS),
      };
    }
  }
  if (isRefObject(value)) {
    return { type: 'refs', refs: [toChangeRef(value)] };
  }
  if (isPlainObject(value)) {
    return {
      type: 'keyValue',
      entries: Object.entries(value as Record<string, unknown>),
    };
  }

  return { type: 'text', text: toTextValue(value) };
};

const toChangeRow = (
  action: ChangeAction,
  change: FieldChange
): ChangeRow | undefined => {
  const name = change.name ?? '';
  const row: ChangeRow = {
    key: `${action}-${name}`,
    action,
    name,
    path: getFieldPath(name),
    oldValue: action === 'added' ? undefined : toChangeValue(change.oldValue),
    newValue: action === 'removed' ? undefined : toChangeValue(change.newValue),
  };

  return row.oldValue || row.newValue || name ? row : undefined;
};

/** The `deleted` flag change is the soft-delete/restore event itself, already shown by its badge and summary. */
export const getChangeRows = (
  changeDescription?: ChangeDescription
): ChangeRow[] => {
  if (!changeDescription) {
    return [];
  }
  const rows = [
    ...(changeDescription.fieldsAdded ?? []).map((change) =>
      toChangeRow('added', change)
    ),
    ...(changeDescription.fieldsUpdated ?? [])
      .filter((change) => change.name !== 'deleted')
      .map((change) => toChangeRow('updated', change)),
    ...(changeDescription.fieldsDeleted ?? []).map((change) =>
      toChangeRow('removed', change)
    ),
  ];

  return rows.filter((row): row is ChangeRow => Boolean(row));
};

export const getStatusColor = (value: string): BadgeColors =>
  STATUS_COLORS.find(([pattern]) => pattern.test(value.toLowerCase()))?.[1] ??
  'gray';

const getItemName = (item: unknown): string => {
  if (!isPlainObject(item)) {
    return String(item);
  }
  const named = item as { displayName?: string; name?: string };

  return named.displayName ?? named.name ?? JSON.stringify(item);
};

const isEpochTimestamp = (key: string, value: unknown): value is number =>
  typeof value === 'number' && /time|date/i.test(key) && value > MIN_EPOCH_MS;

const isStatusValue = (key: string, value: unknown): value is string =>
  typeof value === 'string' && /status|state/i.test(key);

const getStructuredText = (value: unknown[] | object): string => {
  if (Array.isArray(value)) {
    return value.map(getItemName).join(', ');
  }

  return Object.keys(value).length ? JSON.stringify(value) : '';
};

/** Formats one table / key-value cell, inferring timestamps, statuses and ids from the key. */
export const formatCellValue = (key: string, value: unknown): CellValue => {
  if (isNil(value) || value === '') {
    return { text: NO_DATA_PLACEHOLDER };
  }
  if (isEpochTimestamp(key, value)) {
    return { text: formatDateTime(value) };
  }
  if (isStatusValue(key, value)) {
    return { text: value, color: getStatusColor(value) };
  }
  if (Array.isArray(value) || isPlainObject(value)) {
    return {
      text:
        getStructuredText(value as unknown[] | object) || NO_DATA_PLACEHOLDER,
    };
  }
  const text = String(value);

  return { text, isMono: UUID_PATTERN.test(text) };
};

/** Href for a referenced tag, user, team or entity; `undefined` when it has no page. */
export const getChangeRefLink = (ref: ChangeRef): string | undefined => {
  if (ref.refKind !== 'entity') {
    return ref.source === 'Glossary'
      ? getGlossaryPath(ref.fqn)
      : getTagPath(ref.fqn);
  }
  switch (ref.entityType) {
    case EntityType.USER:
      return getSettingsLink(getUserPath(ref.fqn));
    case EntityType.TEAM:
      return getSettingsLink(getTeamsWithFqnPath(ref.fqn));
    default: {
      const entityType = Object.values(EntityType).find(
        (type) => type.toLowerCase() === ref.entityType?.toLowerCase()
      );
      const link = entityType
        ? getEntityLinkFromType(ref.fqn, entityType)
        : undefined;

      return link || undefined;
    }
  }
};

/** Consecutive logs that fall on the same local day; the list arrives newest first. */
export const groupLogsByDay = (logs: AuditLogEntry[]): AuditLogDayGroup[] =>
  logs.reduce<AuditLogDayGroup[]>((groups, log) => {
    const timestamp = log.eventTs ?? 0;
    const dayKey = DateTime.fromMillis(timestamp).toISODate() ?? '';
    const current = groups.at(-1);
    if (current?.dayKey === dayKey) {
      current.logs.push(log);
    } else {
      groups.push({ dayKey, timestamp, logs: [log] });
    }

    return groups;
  }, []);

export const isToday = (timestamp: number) =>
  DateTime.fromMillis(timestamp).hasSame(DateTime.now(), 'day');

/** Pretty JSON for the "View JSON" dialog: the stored raw event, else the parsed event. */
export const getAuditLogJson = (log: AuditLogEntry): string => {
  const parsed = log.rawEventJson
    ? parseChangeValue(log.rawEventJson)
    : log.changeEvent ?? log;

  return JSON.stringify(parsed, null, 2);
};
