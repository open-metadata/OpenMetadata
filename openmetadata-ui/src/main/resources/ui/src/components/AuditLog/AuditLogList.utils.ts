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
import { NO_DATA_PLACEHOLDER } from '../../constants/constants';
import { EntityType } from '../../enums/entity.enum';
import {
  ChangeDescription,
  EventType,
  FieldChange,
} from '../../generated/type/changeEvent';
import { AuditLogEntry } from '../../types/auditLogs.interface';
import { formatDateTime } from '../../utils/date-time/DateTimeUtils';
import { getEntityLinkFromType } from '../../utils/EntityLinkUtils';
import Fqn from '../../utils/Fqn';
import { getTeamsWithFqnPath, getUserPath } from '../../utils/RouterUtils';
import { getSettingsLink } from '../../utils/SettingsModalLinkUtils';
import { isValidJSONString } from '../../utils/StringUtils';

export type ChangeAction = 'added' | 'updated' | 'removed';

/** Tags, tiers, glossary terms and domains render as core `Tag`s; other references as entity chips. */
export type ChangeRefKind =
  | 'tier'
  | 'classification'
  | 'glossary'
  | 'domain'
  | 'entity';

export interface ChangeRef {
  /** Entity id of a referenced user, team or entity; tags have none. */
  id?: string;
  name?: string;
  label: string;
  fqn: string;
  refKind: ChangeRefKind;
  /** Entity type of an entity reference (`user`, `team`, `domain`, ...). */
  entityType?: string;
}

export type ChangeValue =
  | { type: 'refs'; refs: ChangeRef[] }
  | {
      type: 'records';
      records: Record<string, unknown>[];
      totalCount: number;
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

export interface CellValue {
  text: string;
  color?: BadgeColors;
  isEmpty?: boolean;
}

// ADR:2026-11-25-audit-log-rows-show-five-records-and-three-lines-of-a-change
export const MAX_RECORDS = 5;

const UUID_PREVIEW_LENGTH = 8;

/**
 * Colour per audited event type — the server records exactly these
 * (`AuditLogRepository.SUPPORTED_EVENT_TYPES`); anything else renders gray.
 */
export const EVENT_TYPE_COLORS: Partial<Record<string, BadgeColors>> = {
  [EventType.EntityCreated]: 'success',
  [EventType.EntityUpdated]: 'blue',
  [EventType.EntityFieldsChanged]: 'blue',
  [EventType.EntitySoftDeleted]: 'warning',
  [EventType.EntityDeleted]: 'error',
  [EventType.EntityRestored]: 'success',
  [EventType.EntityLineageAdded]: 'indigo',
  [EventType.EntityLineageUpdated]: 'indigo',
  [EventType.EntityLineageDeleted]: 'indigo',
  [EventType.UserLogin]: 'blue-light',
  [EventType.UserLogout]: 'blue-light',
};

export const CHANGE_ACTION_STYLES: Record<
  ChangeAction,
  { labelKey: string; className: string }
> = {
  added: { labelKey: 'label.added', className: 'tw:text-utility-success-700' },
  updated: { labelKey: 'label.updated', className: 'tw:text-utility-blue-700' },
  removed: {
    labelKey: 'label.removed',
    className: 'tw:text-utility-error-700',
  },
};

/** Dot colour that tells the kinds of `Tag` apart. */
export const REF_DOT_CLASSES: Partial<Record<ChangeRefKind, string>> = {
  tier: 'tw:text-utility-purple-500',
  classification: 'tw:text-utility-blue-500',
  glossary: 'tw:text-utility-success-500',
  domain: 'tw:text-utility-orange-500',
};

const DOMAIN_REF_TYPES = new Set<string>([
  EntityType.DOMAIN,
  EntityType.DATA_PRODUCT,
]);

const STATUS_COLORS: [RegExp, BadgeColors][] = [
  [/^(success|successful|passed|completed)$/, 'success'],
  [/^(failed|failure|error)$/, 'error'],
  [/^(aborted|queued|running|partialsuccess|pending)$/, 'warning'],
];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Epoch-millisecond values only — avoids formatting small counts under a "time" key as 1970 dates.
const MIN_EPOCH_MS = 1e11;

export interface LineageEdge {
  from: ChangeRef;
  to: ChangeRef;
}

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

const getTagRefKind = (tagFQN: string, source?: unknown): ChangeRefKind => {
  if (tagFQN.startsWith('Tier.')) {
    return 'tier';
  }

  return source === 'Glossary' ? 'glossary' : 'classification';
};

const toChangeRef = (object: Record<string, unknown>): ChangeRef => {
  const name = object.name as string | undefined;
  const displayName = object.displayName as string | undefined;
  if (typeof object.tagFQN === 'string') {
    const refKind = getTagRefKind(object.tagFQN, object.source);

    return {
      fqn: object.tagFQN,
      refKind,
      label:
        refKind === 'tier'
          ? displayName || name || object.tagFQN
          : object.tagFQN,
    };
  }
  const fqn = (object.fullyQualifiedName as string | undefined) ?? name ?? '';
  const entityType = object.type as string;

  return {
    id: object.id as string | undefined,
    name,
    fqn,
    entityType,
    refKind: DOMAIN_REF_TYPES.has(entityType) ? 'domain' : 'entity',
    label: displayName || name || fqn,
  };
};

// Closing block tags become spaces so `<p>a</p><p>b</p>` reads "a b", not "ab".
const BLOCK_END_PATTERN = /<\/(p|div|li|h[1-6])>|<br\s*\/?>/gi;

// Only rich-text markup or an entity marks a value as HTML; a type such as `map<string,int>`
// would otherwise be parsed as an element and vanish from the audit log.
const HTML_MARKUP_PATTERN =
  /<\/?(p|div|span|br|li|ul|ol|h[1-6]|strong|em|b|i|u|s|a|code|pre|blockquote|table|tr|td|th)(\s[^>]*)?\/?>|&(#\d+|#x[\da-f]+|[a-z]+);/i;

/** Plain text of an HTML value, with entities such as `&amp;` decoded; other text is kept as is. */
const toPlainText = (value: string): string => {
  if (!HTML_MARKUP_PATTERN.test(value)) {
    return value;
  }
  const html = value.replace(BLOCK_END_PATTERN, ' ');
  const text = new DOMParser().parseFromString(html, 'text/html').body
    .textContent;

  return text?.replace(/\s+/g, ' ').trim() || value;
};

const toTextValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return toPlainText(value);
  }
  if (Array.isArray(value)) {
    return value.map(toTextValue).filter(Boolean).join(', ');
  }

  return isPlainObject(value) ? JSON.stringify(value) : String(value);
};

const toArrayValue = (values: unknown[]): ChangeValue | undefined => {
  if (values.length === 0) {
    return undefined;
  }
  if (values.every(isRefObject)) {
    return { type: 'refs', refs: values.map(toChangeRef) };
  }
  if (values.every(isPlainObject)) {
    return {
      type: 'records',
      records: (values as Record<string, unknown>[]).slice(0, MAX_RECORDS),
      totalCount: values.length,
    };
  }

  return { type: 'text', text: toTextValue(values) };
};

/** Classifies a raw field value into the shape the list renders; `undefined` when there is nothing to show. */
export const toChangeValue = (raw: unknown): ChangeValue | undefined => {
  const value = parseChangeValue(raw);
  if (isNil(value) || value === '') {
    return undefined;
  }
  if (Array.isArray(value)) {
    return toArrayValue(value);
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

const toChangeRow = (action: ChangeAction, change: FieldChange): ChangeRow => {
  const name = change.name ?? '';

  return {
    key: `${action}-${name}`,
    action,
    name,
    path: getFieldPath(name),
    oldValue: action === 'added' ? undefined : toChangeValue(change.oldValue),
    newValue: action === 'removed' ? undefined : toChangeValue(change.newValue),
  };
};

/** The `deleted` flag change is the soft-delete/restore event itself, already shown by its badge and summary. */
export const getChangeRows = (
  changeDescription?: ChangeDescription
): ChangeRow[] => {
  if (!changeDescription) {
    return [];
  }

  return [
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

const formatScalar = (value: unknown): CellValue => {
  const text = String(value);

  return UUID_PATTERN.test(text)
    ? { text: `${text.slice(0, UUID_PREVIEW_LENGTH)}…` }
    : { text };
};

/** Formats one inline `key value` pair, inferring timestamps, statuses and ids from the key. */
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
    const text = getStructuredText(value as unknown[] | object);

    return text ? { text } : { text: '', isEmpty: true };
  }

  return formatScalar(value);
};

export const findEntityType = (value?: string): EntityType | undefined => {
  const normalized = value?.toLowerCase();

  return normalized
    ? Object.values(EntityType).find(
        (entityType) => entityType.toLowerCase() === normalized
      )
    : undefined;
};

export const isOwnerRef = (ref: ChangeRef): boolean =>
  ref.entityType === EntityType.USER || ref.entityType === EntityType.TEAM;

/** Href for a referenced user, team or entity; `undefined` when it has no page. */
export const getEntityRefLink = (ref: ChangeRef): string | undefined => {
  switch (ref.entityType) {
    case EntityType.USER:
      return getSettingsLink(getUserPath(ref.fqn));
    case EntityType.TEAM:
      return getSettingsLink(getTeamsWithFqnPath(ref.fqn));
    default: {
      const entityType = findEntityType(ref.entityType);

      return (
        (entityType && getEntityLinkFromType(ref.fqn, entityType)) || undefined
      );
    }
  }
};

/**
 * A lineage event's "entity" is the edge (`a--upstream-->b`); its change event carries the
 * two endpoints as `fromEntity` / `toEntity`, sometimes still as a JSON string.
 */
export const getLineageEdge = (log: AuditLogEntry): LineageEdge | undefined => {
  const entity = parseChangeValue(log.changeEvent?.entity) as
    | { fromEntity?: unknown; toEntity?: unknown }
    | undefined;
  if (!isRefObject(entity?.fromEntity) || !isRefObject(entity?.toEntity)) {
    return undefined;
  }

  return {
    from: toChangeRef(entity.fromEntity),
    to: toChangeRef(entity.toEntity),
  };
};

/** The server's summary for lineage events is the bare event type, which says nothing. */
export const getReadableSummary = (log: AuditLogEntry): string | undefined =>
  log.summary && log.summary !== log.eventType ? log.summary : undefined;
