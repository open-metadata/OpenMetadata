/*
 *  Copyright 2025 Collate.
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
  Badge,
  Box,
  OwnerChip,
  Skeleton,
  Tag,
  TagGroup,
  TagList,
  Typography,
} from '@openmetadata/ui-core-components';
import { NoSearch } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { startCase } from 'lodash';
import { FC, Fragment, ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityType } from '../../enums/entity.enum';
import {
  formatDateTime,
  getRelativeTime,
} from '../../utils/date-time/DateTimeUtils';
import { getEntityLinkFromType } from '../../utils/EntityLinkUtils';
import { getEntityName } from '../../utils/EntityNameUtils';
import Fqn from '../../utils/Fqn';
import { toOwnerRef } from '../../utils/Owner/ownerConversionUtils';
import { getUserPath } from '../../utils/RouterUtils';
import { getSettingsLink } from '../../utils/SettingsModalLinkUtils';
import NoDataPlaceholder from '../common/EmptyPlaceholder/NoDataPlaceholder';
import NoFilteredResultsPlaceholder from '../common/EmptyPlaceholder/NoFilteredResultsPlaceholder';
import NoSearchResultsPlaceholder from '../common/EmptyPlaceholder/NoSearchResultsPlaceholder';
import ProfilePicture from '../common/ProfilePicture/ProfilePicture';
import {
  AuditLogListItemProps,
  AuditLogListProps,
} from './AuditLogList.interface';
import {
  ChangeRef,
  ChangeRow,
  ChangeValue,
  CHANGE_ACTION_STYLES,
  EVENT_TYPE_COLORS,
  findEntityType,
  formatCellValue,
  getChangeRows,
  getEntityRefLink,
  getLineageEdge,
  getReadableSummary,
  isAuthEvent,
  isOwnerRef,
  LineageEdge,
  REF_DOT_CLASSES,
} from './AuditLogList.utils';

/** How a value is drawn: plain, or red/struck (old / removed) and green (new) on an update. */
type ValueTone = 'plain' | 'before' | 'after';

type RecordsValue = Extract<ChangeValue, { type: 'records' }>;

const LINK_CLASS =
  'tw:font-semibold tw:text-fg-brand-primary tw:hover:underline';

const resolveEntityLabel = (
  log: AuditLogListItemProps['log'],
  entityFQN?: string
): string | undefined => {
  const entityNameLabel =
    getEntityName(log.changeEvent?.entity) ||
    (log.changeEvent?.entity as { name?: string })?.name;
  const splitEntityFqn = entityFQN ? Fqn.split(entityFQN).pop() : undefined;

  return (
    entityNameLabel ||
    splitEntityFqn ||
    log.changeEvent?.entityFullyQualifiedName ||
    log.entityId
  );
};

const getEntityHref = (
  log: AuditLogListItemProps['log'],
  normalizedType?: EntityType,
  entityFQN?: string
): string | undefined => {
  if (normalizedType === EntityType.USER) {
    const userName =
      log.changeEvent?.entity?.name ??
      log.changeEvent?.entity?.fullyQualifiedName ??
      entityFQN ??
      log.userName;

    return userName ? getSettingsLink(getUserPath(userName)) : undefined;
  }
  if (!normalizedType || !entityFQN) {
    return undefined;
  }

  return getEntityLinkFromType(entityFQN, normalizedType) || undefined;
};

/** Inline values of a change line; lists of objects render below it as records instead. */
const getLineValues = (
  row: ChangeRow
): { value: ChangeValue; tone: ValueTone }[] => {
  if (row.newValue?.type === 'records' || row.oldValue?.type === 'records') {
    return [];
  }
  if (row.oldValue && row.newValue) {
    return [
      { value: row.oldValue, tone: 'before' },
      { value: row.newValue, tone: 'after' },
    ];
  }
  if (row.newValue) {
    return [{ value: row.newValue, tone: 'plain' }];
  }

  return row.oldValue ? [{ value: row.oldValue, tone: 'before' }] : [];
};

const RefValue: FC<{
  refs: ChangeRef[];
  label: string;
  isStruck: boolean;
}> = ({ refs, label, isStruck }) => {
  const tags = refs.filter((ref) => ref.refKind !== 'entity');
  const entities = refs.filter((ref) => ref.refKind === 'entity');

  return (
    <>
      {tags.length > 0 && (
        <TagGroup label={label}>
          <TagList className="tw:flex tw:flex-wrap tw:gap-1.5">
            {tags.map((ref) => (
              <Tag
                dot
                className={classNames({ 'tw:line-through': isStruck })}
                dotClassName={REF_DOT_CLASSES[ref.refKind]}
                id={`${ref.refKind}-${ref.fqn}`}
                key={`${ref.refKind}-${ref.fqn}`}>
                {ref.label}
              </Tag>
            ))}
          </TagList>
        </TagGroup>
      )}
      {entities.map((ref) =>
        isOwnerRef(ref) && ref.id ? (
          <OwnerChip
            avatarSize={20}
            className={classNames({ 'tw:line-through': isStruck })}
            isCompactView={false}
            key={`${ref.entityType}-${ref.fqn}`}
            owner={toOwnerRef({
              id: ref.id,
              name: ref.name ?? ref.fqn,
              displayName: ref.label,
              type: ref.entityType,
            })}
          />
        ) : (
          <Badge
            className={classNames({ 'tw:line-through': isStruck })}
            color="gray"
            data-testid="change-ref"
            href={getEntityRefLink(ref)}
            key={`${ref.entityType}-${ref.fqn}`}
            size="sm"
            type="pill-color">
            {ref.entityType ? `${ref.label} (${ref.entityType})` : ref.label}
          </Badge>
        )
      )}
    </>
  );
};

const InlineCell: FC<{ name: string; value: unknown }> = ({ name, value }) => {
  const { t } = useTranslation();
  const cell = formatCellValue(name, value);

  if (cell.color) {
    return (
      <Badge color={cell.color} size="sm" type="pill-color">
        {cell.text}
      </Badge>
    );
  }

  return (
    <span className="tw:text-primary">
      {cell.isEmpty ? t('label.empty').toLowerCase() : cell.text}
    </span>
  );
};

/** `key value, key value` on one line — keys muted, values formatted by key. */
const InlineEntries: FC<{ entries: [string, unknown][] }> = ({ entries }) => (
  <span className="tw:inline-flex tw:flex-wrap tw:items-center tw:gap-x-1.5 tw:gap-y-1">
    {entries.map(([key, entryValue], index) => (
      <span className="tw:inline-flex tw:items-center tw:gap-1.5" key={key}>
        <span className="tw:text-tertiary">{key}</span>
        <InlineCell name={key} value={entryValue} />
        {index < entries.length - 1 && (
          <span className="tw:text-tertiary">,</span>
        )}
      </span>
    ))}
  </span>
);

const TEXT_TONE_CLASSES: Record<ValueTone, string> = {
  plain: '',
  before: 'tw:line-through tw:text-utility-error-700',
  after: 'tw:text-utility-success-700',
};

/**
 * Long values such as descriptions are cut to three lines so one entry cannot fill the list
 * (ADR:2026-11-25-audit-log-rows-show-five-records-and-three-lines-of-a-change).
 */
const TextValue: FC<{ text: string; tone: ValueTone }> = ({ text, tone }) => (
  <span
    className={classNames(
      'tw:line-clamp-3 tw:break-words',
      TEXT_TONE_CLASSES[tone]
    )}
    data-testid="change-text">
    {text}
  </span>
);

const InlineValue: FC<{
  value: ChangeValue;
  tone: ValueTone;
  label: string;
}> = ({ value, tone, label }) => {
  switch (value.type) {
    case 'refs':
      return (
        <RefValue
          isStruck={tone === 'before'}
          label={label}
          refs={value.refs}
        />
      );
    case 'keyValue':
      return <InlineEntries entries={value.entries} />;
    case 'records':
      // Shown as records under the line by `RecordList`.
      return null;
    default:
      return <TextValue text={value.text} tone={tone} />;
  }
};

const RecordList: FC<{ value: RecordsValue }> = ({ value }) => {
  const { t } = useTranslation();
  const hiddenCount = value.totalCount - value.records.length;

  return (
    <Box className="tw:mt-1.5" direction="col" gap={1}>
      {value.records.map((record, index) => (
        <div
          className="tw:rounded-md tw:bg-secondary tw:px-3 tw:py-2 tw:text-sm"
          data-testid="change-record"
          // Records are untyped API objects with no stable id; their order is the change's order.
          // eslint-disable-next-line react/no-array-index-key
          key={index}>
          <InlineEntries entries={Object.entries(record)} />
        </div>
      ))}
      {hiddenCount > 0 && (
        <Typography color="secondary" size="text-xs">
          {t('label.plus-count-more', { count: hiddenCount })}
        </Typography>
      )}
    </Box>
  );
};

const ChangeLine: FC<{ row: ChangeRow }> = ({ row }) => {
  const { t } = useTranslation();
  const action = CHANGE_ACTION_STYLES[row.action];
  const values = getLineValues(row);
  const records = [row.newValue, row.oldValue].find(
    (value): value is RecordsValue => value?.type === 'records'
  );

  return (
    <div data-testid="change-row">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-x-1.5 tw:gap-y-1 tw:text-sm">
        <span
          className={classNames('tw:font-semibold', action.className)}
          data-testid="change-action">
          {t(action.labelKey)}
        </span>
        <span
          className="tw:font-semibold tw:text-primary"
          data-testid="change-field-path">
          {`${row.path || t('label.field')}:`}
        </span>
        {values.map(({ value, tone }, index) => (
          <Fragment key={tone}>
            {index > 0 && <span className="tw:text-tertiary">→</span>}
            <InlineValue label={row.path} tone={tone} value={value} />
          </Fragment>
        ))}
      </div>
      {records && <RecordList value={records} />}
    </div>
  );
};

const AuditLogItemHeader: FC<{
  log: AuditLogListItemProps['log'];
  userName: string;
  entity: ReactNode;
}> = ({ log, userName, entity }) => {
  const { t } = useTranslation();

  return (
    <Box
      align="center"
      data-testid="item-header"
      direction="row"
      gap={2}
      wrap="wrap">
      {log.userName ? (
        <Link
          className={LINK_CLASS}
          to={getSettingsLink(getUserPath(log.userName))}>
          {userName}
        </Link>
      ) : (
        <Typography weight="semibold">{userName}</Typography>
      )}
      {log.actorType === 'BOT' && (
        <Badge color="gray" data-testid="bot-badge" size="sm" type="color">
          {t('label.bot')}
        </Badge>
      )}
      <Typography color="quaternary">–</Typography>
      {log.eventType && (
        <Badge
          color={EVENT_TYPE_COLORS[log.eventType] ?? 'gray'}
          data-testid="event-type"
          size="sm"
          type="color">
          {startCase(log.eventType)}
        </Badge>
      )}
      {log.impersonatedBy && (
        <Typography
          color="secondary"
          data-testid="impersonated-by"
          size="text-sm">
          {t('label.impersonated-by-with-colon')}{' '}
          <Link
            className={LINK_CLASS}
            to={getSettingsLink(getUserPath(log.impersonatedBy))}>
            {log.impersonatedBy}
          </Link>
        </Typography>
      )}
      {entity}
    </Box>
  );
};

const AuditLogItemEntity: FC<{
  entityLabel: string;
  entityFQN?: string;
  entityHref?: string;
}> = ({ entityLabel, entityFQN, entityHref }) => (
  <Box
    align="baseline"
    data-testid="affected-entity"
    direction="row"
    gap={2}
    wrap="wrap">
    {entityHref ? (
      <Link className={LINK_CLASS} to={entityHref}>
        {entityLabel}
      </Link>
    ) : (
      <Typography weight="semibold">{entityLabel}</Typography>
    )}
    {entityFQN && entityFQN !== entityLabel && (
      <Typography
        className="tw:break-all"
        color="secondary"
        data-testid="affected-entity-fqn"
        size="text-xs">
        ({entityFQN})
      </Typography>
    )}
  </Box>
);

const EntityRefLink: FC<{ entityRef: ChangeRef }> = ({ entityRef }) => {
  const href = getEntityRefLink(entityRef);

  return href ? (
    <Link className={LINK_CLASS} to={href}>
      {entityRef.label}
    </Link>
  ) : (
    <Typography weight="semibold">{entityRef.label}</Typography>
  );
};

const AuditLogItemLineage: FC<{ edge: LineageEdge }> = ({ edge }) => (
  <Box
    align="center"
    data-testid="affected-entity"
    direction="row"
    gap={2}
    wrap="wrap">
    <EntityRefLink entityRef={edge.from} />
    <Typography color="secondary">→</Typography>
    <EntityRefLink entityRef={edge.to} />
  </Box>
);

const AuditLogItemMeta: FC<{ entityType?: string; timestamp?: number }> = ({
  entityType,
  timestamp,
}) => (
  <Box
    align="center"
    data-testid="item-meta"
    direction="row"
    gap={2}
    wrap="wrap">
    {entityType && (
      <Typography
        color="secondary"
        data-testid="entity-type-badge"
        size="text-xs">
        {startCase(entityType)}
      </Typography>
    )}
    {entityType && timestamp && (
      <span
        aria-hidden="true"
        className="tw:h-3 tw:border-l tw:border-secondary"
      />
    )}
    {timestamp && (
      <Typography color="secondary" data-testid="timestamp" size="text-xs">
        <time dateTime={new Date(timestamp).toISOString()}>
          {formatDateTime(timestamp)}
        </time>
        {` · ${getRelativeTime(timestamp)}`}
      </Typography>
    )}
  </Box>
);

/** What the event happened to: the lineage edge, the changed asset, or nothing for login/logout. */
const AuditLogItemSubject: FC<{
  log: AuditLogListItemProps['log'];
  entityType?: string;
  entityFQN?: string;
  entityLabel?: string;
}> = ({ log, entityType, entityFQN, entityLabel }) => {
  const lineageEdge = getLineageEdge(log);
  if (lineageEdge) {
    return <AuditLogItemLineage edge={lineageEdge} />;
  }
  // A login/logout's entity is the actor already shown in the header.
  if (!entityLabel || isAuthEvent(log.eventType)) {
    return null;
  }

  return (
    <AuditLogItemEntity
      entityFQN={entityFQN}
      entityHref={getEntityHref(log, findEntityType(entityType), entityFQN)}
      entityLabel={entityLabel}
    />
  );
};

const AuditLogListItem: FC<AuditLogListItemProps> = ({ log }) => {
  const { t } = useTranslation();
  const entityType = log.entityType ?? log.changeEvent?.entityType;
  const entityFQN =
    log.entityFQN ??
    log.changeEvent?.entityFullyQualifiedName ??
    log.changeEvent?.entity?.fullyQualifiedName;
  const entityLabel = resolveEntityLabel(log, entityFQN);
  const userName = log.userName || t('label.system');
  const changeRows = useMemo(
    () => getChangeRows(log.changeEvent?.changeDescription),
    [log.changeEvent?.changeDescription]
  );
  const summary = getReadableSummary(log);
  const entity = (
    <AuditLogItemSubject
      entityFQN={entityFQN}
      entityLabel={entityLabel}
      entityType={entityType}
      log={log}
    />
  );

  return (
    <Box
      className="tw:p-4 tw:border-b tw:border-primary tw:transition-colors tw:hover:bg-secondary tw:last:border-b-0"
      data-testid="audit-log-list-item"
      direction="row"
      gap={3}>
      <div className="tw:shrink-0" data-testid="item-avatar">
        <ProfilePicture
          displayName={userName}
          height="32"
          name={log.userName || 'system'}
          width="32"
        />
      </div>
      <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={2}>
        <AuditLogItemHeader entity={entity} log={log} userName={userName} />
        <Box data-testid="description-content" direction="col" gap={1}>
          {changeRows.length > 0
            ? changeRows.map((row) => <ChangeLine key={row.key} row={row} />)
            : summary && <Typography size="text-sm">{summary}</Typography>}
        </Box>
        <AuditLogItemMeta entityType={entityType} timestamp={log.eventTs} />
      </Box>
    </Box>
  );
};

const AuditLogListSkeleton: FC = () => (
  <div data-testid="audit-log-list-skeleton">
    {[1, 2, 3, 4, 5].map((i) => (
      <Box
        className="tw:p-4 tw:border-b tw:border-primary tw:last:border-b-0"
        direction="row"
        gap={3}
        key={i}>
        <Skeleton
          className="tw:shrink-0"
          height={32}
          variant="circular"
          width={32}
        />
        <Box className="tw:flex-1" direction="col" gap={1}>
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="100%" />
          <Skeleton variant="text" width="75%" />
        </Box>
      </Box>
    ))}
  </div>
);

const AuditLogList: FC<AuditLogListProps> = ({
  logs,
  isLoading,
  hasActiveSearch,
  hasActiveFilters,
  onClearFilters,
}) => {
  const { t } = useTranslation();

  if (isLoading) {
    return <AuditLogListSkeleton />;
  }

  if (logs.length === 0) {
    const clearAction = onClearFilters
      ? [
          {
            color: 'primary' as const,
            key: 'clear',
            label: t('label.clear-entity', {
              entity: t('label.all-lowercase'),
            }),
            onPress: onClearFilters,
          },
        ]
      : undefined;

    let emptyContent: ReactNode;

    if (hasActiveSearch) {
      emptyContent = (
        <NoSearchResultsPlaceholder
          actions={clearAction}
          description={t('message.check-spelling-or-try-different-term')}
          icon={<NoSearch />}
          title={t('label.no-matching-results')}
        />
      );
    } else if (hasActiveFilters) {
      emptyContent = (
        <NoFilteredResultsPlaceholder
          actions={clearAction}
          description={t('message.no-results-for-filters-description')}
          icon={<NoSearch />}
          title={t('label.no-result-for-these-filter-plural')}
        />
      );
    } else {
      emptyContent = (
        <NoDataPlaceholder
          description={t('message.no-audit-logs-description')}
          title={t('label.no-audit-logs-yet')}
        />
      );
    }

    return (
      <div data-testid="audit-log-list">
        <div className="tw:relative tw:min-h-80 tw:p-8">{emptyContent}</div>
      </div>
    );
  }

  return (
    <div className="tw:w-full" data-testid="audit-log-list">
      {logs.map((log, index) => (
        <AuditLogListItem
          key={log.id?.toString() ?? log.changeEventId ?? index.toString()}
          log={log}
        />
      ))}
    </div>
  );
};

export default AuditLogList;
