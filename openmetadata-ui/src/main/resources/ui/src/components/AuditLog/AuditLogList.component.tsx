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
  Button,
  Card,
  Dialog,
  Modal,
  ModalOverlay,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { NoSearch } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { startCase } from 'lodash';
import { FC, lazy, ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CSMode } from '../../enums/codemirror.enum';
import { EntityType } from '../../enums/entity.enum';
import {
  formatDate,
  formatDateTime,
  getRelativeTime,
} from '../../utils/date-time/DateTimeUtils';
import { getEntityIcon } from '../../utils/EntityIconUtils';
import { getEntityLinkFromType } from '../../utils/EntityLinkUtils';
import { getEntityName } from '../../utils/EntityNameUtils';
import Fqn from '../../utils/Fqn';
import { getUserPath } from '../../utils/RouterUtils';
import { getSettingsLink } from '../../utils/SettingsModalLinkUtils';
import { withSuspenseFallback } from '../AppRouter/withSuspenseFallback';
import NoDataPlaceholder from '../common/EmptyPlaceholder/NoDataPlaceholder';
import NoFilteredResultsPlaceholder from '../common/EmptyPlaceholder/NoFilteredResultsPlaceholder';
import NoSearchResultsPlaceholder from '../common/EmptyPlaceholder/NoSearchResultsPlaceholder';
import ProfilePicture from '../common/ProfilePicture/ProfilePicture';
import {
  AuditLogListItemProps,
  AuditLogListProps,
} from './AuditLogList.interface';
import {
  AuditLogDayGroup,
  ChangeRef,
  ChangeRow,
  ChangeValue,
  CHANGE_ACTION_BADGES,
  EVENT_TYPE_BADGES,
  formatCellValue,
  getAuditLogJson,
  getChangeRefLink,
  getChangeRows,
  groupLogsByDay,
  isAuthEvent,
  isToday,
} from './AuditLogList.utils';

const SchemaEditor = withSuspenseFallback(
  lazy(() => import('../Database/SchemaEditor/SchemaEditor'))
);

const JSON_EDITOR_MODE = { name: CSMode.JAVASCRIPT, json: true };

const REF_BADGE_COLORS = {
  tier: 'purple',
  tag: 'blue',
  entity: 'gray',
} as const;

/** How a value is drawn: struck through when removed, red/green when it is one side of an update. */
type ValueTone = 'plain' | 'removed' | 'before' | 'after';

const resolveEntityType = (value?: string): EntityType | undefined => {
  if (!value) {
    return undefined;
  }
  const normalized = value.toLowerCase();

  return Object.values(EntityType).find(
    (entityType) => entityType.toLowerCase() === normalized
  );
};

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

const getAuditLogDisplayInfo = (log: AuditLogListItemProps['log']) => {
  const entityType = log.entityType ?? log.changeEvent?.entityType;
  const entityFQN =
    log.entityFQN ??
    log.changeEvent?.entityFullyQualifiedName ??
    log.changeEvent?.entity?.fullyQualifiedName;

  return {
    entityType,
    entityFQN,
    entityLabel: resolveEntityLabel(log, entityFQN),
    normalizedType: resolveEntityType(entityType),
  };
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

const ChangeRefList: FC<{ refs: ChangeRef[]; isRemoved: boolean }> = ({
  refs,
  isRemoved,
}) => (
  <Box direction="row" gap={2} wrap="wrap">
    {refs.map((ref) => (
      <Badge
        className={classNames({ 'tw:line-through': isRemoved })}
        color={REF_BADGE_COLORS[ref.refKind]}
        data-testid="change-ref"
        href={getChangeRefLink(ref)}
        key={`${ref.refKind}-${ref.fqn}`}
        size="md"
        type="pill-color">
        {ref.label}
        {ref.entityType && (
          <Typography
            as="span"
            className="tw:ml-1.5"
            size="text-xs"
            weight="semibold">
            {startCase(ref.entityType)}
          </Typography>
        )}
      </Badge>
    ))}
  </Box>
);

const CellContent: FC<{ name: string; value: unknown }> = ({ name, value }) => {
  const cell = formatCellValue(name, value);

  if (cell.color) {
    return (
      <Badge color={cell.color} size="sm" type="pill-color">
        {cell.text}
      </Badge>
    );
  }

  return (
    <span
      className={classNames('tw:text-sm tw:text-primary tw:break-words', {
        'tw:font-mono tw:text-xs': cell.isMono,
      })}>
      {cell.text}
    </span>
  );
};

const ChangeValueTable: FC<{
  value: Extract<ChangeValue, { type: 'table' }>;
}> = ({ value }) => {
  const { t } = useTranslation();

  return (
    <Box direction="col" gap={1}>
      <div className="tw:overflow-x-auto tw:rounded-md tw:border tw:border-secondary tw:bg-surface">
        <table
          className="tw:w-full tw:border-collapse"
          data-testid="change-table">
          <thead>
            <tr className="tw:bg-secondary">
              {value.columns.map((column) => (
                <th
                  className="tw:whitespace-nowrap tw:px-3 tw:py-2 tw:text-left tw:text-xs tw:font-semibold tw:text-tertiary"
                  key={column}
                  scope="col">
                  {startCase(column)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {value.rows.map((row, rowIndex) => (
              // Rows are untyped API objects with no stable id; their order is the change's order.
              // eslint-disable-next-line react/no-array-index-key
              <tr className="tw:border-t tw:border-secondary" key={rowIndex}>
                {value.columns.map((column) => (
                  <td
                    className="tw:whitespace-nowrap tw:px-3 tw:py-2"
                    key={column}>
                    <CellContent name={column} value={row[column]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {value.hiddenRowCount > 0 && (
        <Typography className="tw:text-tertiary" size="text-xs">
          {t('label.plus-count-more', { count: value.hiddenRowCount })}
        </Typography>
      )}
    </Box>
  );
};

const ChangeValueKeyValue: FC<{
  value: Extract<ChangeValue, { type: 'keyValue' }>;
}> = ({ value }) => (
  <dl
    className="tw:m-0 tw:divide-y tw:divide-secondary tw:rounded-md tw:border tw:border-secondary tw:bg-surface"
    data-testid="change-key-value">
    {value.entries.map(([key, entryValue]) => (
      <div
        className="tw:flex tw:items-baseline tw:gap-3 tw:px-3 tw:py-2"
        key={key}>
        <dt className="tw:w-35 tw:shrink-0 tw:text-xs tw:text-tertiary">
          {startCase(key)}
        </dt>
        <dd className="tw:m-0 tw:min-w-0">
          <CellContent name={key} value={entryValue} />
        </dd>
      </div>
    ))}
  </dl>
);

const ChangeTextValue: FC<{ text: string; tone: ValueTone }> = ({
  text,
  tone,
}) => {
  const className = 'tw:rounded tw:px-1 tw:box-decoration-clone';

  if (tone === 'before' || tone === 'removed') {
    return (
      <del
        className={classNames(
          className,
          'tw:bg-utility-error-50 tw:text-utility-error-700'
        )}>
        {text}
      </del>
    );
  }
  if (tone === 'after') {
    return (
      <ins
        className={classNames(
          className,
          'tw:bg-utility-success-50 tw:text-utility-success-700 tw:no-underline'
        )}>
        {text}
      </ins>
    );
  }

  return <span>{text}</span>;
};

const ChangeValueView: FC<{ value: ChangeValue; tone: ValueTone }> = ({
  value,
  tone,
}) => {
  switch (value.type) {
    case 'refs':
      return (
        <ChangeRefList
          isRemoved={tone === 'removed' || tone === 'before'}
          refs={value.refs}
        />
      );
    case 'table':
      return <ChangeValueTable value={value} />;
    case 'keyValue':
      return <ChangeValueKeyValue value={value} />;
    default:
      return (
        // Long descriptions are clamped; the full text stays available in View JSON.
        <div className="tw:line-clamp-4 tw:text-sm tw:leading-6 tw:text-primary tw:break-words">
          <ChangeTextValue text={value.text} tone={tone} />
        </div>
      );
  }
};

const BeforeAfterRow: FC<{
  label: string;
  value: ChangeValue;
  tone: ValueTone;
}> = ({ label, value, tone }) => (
  <div className="tw:flex tw:items-start tw:gap-2">
    <Typography
      as="span"
      className="tw:w-12 tw:shrink-0 tw:pt-0.5 tw:text-tertiary"
      size="text-xs">
      {label}
    </Typography>
    <div className="tw:min-w-0 tw:flex-1">
      <ChangeValueView tone={tone} value={value} />
    </div>
  </div>
);

const ChangeRowView: FC<{ row: ChangeRow }> = ({ row }) => {
  const { t } = useTranslation();
  const badge = CHANGE_ACTION_BADGES[row.action];
  // Before/After only when both sides exist; a one-sided update reads like an add or a removal.
  const singleValue = row.newValue ?? row.oldValue;
  const singleTone: ValueTone = row.newValue ? 'plain' : 'removed';

  return (
    <div
      className="tw:flex tw:items-start tw:gap-3 tw:px-3.5 tw:py-3"
      data-testid="change-row">
      <Badge
        className="tw:w-18 tw:shrink-0 tw:justify-center"
        color={badge.color}
        data-testid="change-action"
        size="sm"
        type="color">
        {t(badge.labelKey)}
      </Badge>
      <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={2}>
        <Typography
          className="tw:text-secondary"
          data-testid="change-field-path"
          size="text-sm"
          title={row.name}
          weight="semibold">
          {row.path || t('label.field')}
        </Typography>
        {row.oldValue && row.newValue ? (
          <Box direction="col" gap={1}>
            <BeforeAfterRow
              label={t('label.before')}
              tone="before"
              value={row.oldValue}
            />
            <BeforeAfterRow
              label={t('label.after')}
              tone="after"
              value={row.newValue}
            />
          </Box>
        ) : (
          singleValue && (
            <ChangeValueView tone={singleTone} value={singleValue} />
          )
        )}
      </Box>
    </div>
  );
};

const AuditLogJsonDialog: FC<{ json: string; onClose: () => void }> = ({
  json,
  onClose,
}) => {
  const { t } = useTranslation();

  return (
    <ModalOverlay
      isDismissable
      isOpen
      onOpenChange={(open) => !open && onClose()}>
      <Modal>
        <Dialog dividers="scroll" onClose={onClose}>
          <Dialog.Header title={t('label.view-json')} />
          <Dialog.Content>
            <div data-testid="audit-log-json">
              <SchemaEditor readOnly mode={JSON_EDITOR_MODE} value={json} />
            </div>
          </Dialog.Content>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

const AuditLogItemHeader: FC<{
  log: AuditLogListItemProps['log'];
  userName: string;
  onViewJson: () => void;
}> = ({ log, userName, onViewJson }) => {
  const { t } = useTranslation();
  const eventBadge = log.eventType
    ? EVENT_TYPE_BADGES[log.eventType]
    : undefined;

  return (
    <Box
      align="center"
      data-testid="item-header"
      direction="row"
      gap={2}
      justify="between"
      wrap="wrap">
      <Box align="center" direction="row" gap={2} wrap="wrap">
        {log.userName ? (
          <Link
            className="tw:text-md tw:font-semibold tw:text-primary tw:hover:underline"
            to={getSettingsLink(getUserPath(log.userName))}>
            {userName}
          </Link>
        ) : (
          <Typography size="text-md" weight="semibold">
            {userName}
          </Typography>
        )}
        {log.actorType === 'BOT' && (
          <Badge color="gray" data-testid="bot-badge" size="sm" type="color">
            {t('label.bot')}
          </Badge>
        )}
        {log.eventType && (
          <Badge
            color={eventBadge?.color ?? 'gray'}
            data-testid="event-type"
            size="sm"
            type="color">
            {eventBadge ? t(eventBadge.labelKey) : startCase(log.eventType)}
          </Badge>
        )}
      </Box>
      <Button
        color="link-color"
        data-testid="view-json-button"
        size="sm"
        onClick={onViewJson}>
        {t('label.view-json')}
      </Button>
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
      <Link
        className="tw:text-md tw:font-semibold tw:text-brand-secondary tw:hover:underline"
        to={entityHref}>
        {entityLabel}
      </Link>
    ) : (
      <Typography size="text-md" weight="semibold">
        {entityLabel}
      </Typography>
    )}
    {entityFQN && entityFQN !== entityLabel && (
      <Typography
        className="tw:font-mono tw:break-all tw:text-tertiary"
        data-testid="affected-entity-fqn"
        size="text-xs">
        ({entityFQN})
      </Typography>
    )}
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
    gap={3}
    wrap="wrap">
    {entityType && (
      <Typography
        as="span"
        className="tw:inline-flex tw:items-center tw:gap-1.5 tw:text-brand-secondary"
        data-testid="entity-type-badge"
        size="text-sm"
        weight="medium">
        {getEntityIcon(entityType, 'tw:size-3.5 tw:text-brand-secondary')}
        {startCase(entityType)}
      </Typography>
    )}
    {entityType && timestamp && (
      <span
        aria-hidden="true"
        className="tw:h-3.5 tw:border-l tw:border-secondary"
      />
    )}
    {timestamp && (
      <Typography
        as="span"
        className="tw:text-tertiary"
        data-testid="timestamp"
        size="text-sm">
        <time dateTime={new Date(timestamp).toISOString()}>
          {formatDateTime(timestamp)}
        </time>
        {` · ${getRelativeTime(timestamp)}`}
      </Typography>
    )}
  </Box>
);

const AuditLogListItem: FC<AuditLogListItemProps> = ({ log }) => {
  const { t } = useTranslation();
  const [isJsonOpen, setIsJsonOpen] = useState(false);
  const { entityType, entityFQN, entityLabel, normalizedType } =
    getAuditLogDisplayInfo(log);
  const userName = log.userName || t('label.system');
  const changeRows = useMemo(
    () => getChangeRows(log.changeEvent?.changeDescription),
    [log.changeEvent?.changeDescription]
  );
  // A login/logout's entity is the actor already shown in the header.
  const showEntity = entityLabel && !isAuthEvent(log.eventType);

  return (
    <Card data-testid="audit-log-list-item">
      <Card.Content className="tw:flex tw:items-start tw:gap-3.5">
        <div className="tw:shrink-0" data-testid="item-avatar">
          <ProfilePicture
            displayName={userName}
            height="36"
            name={log.userName || 'system'}
            width="36"
          />
        </div>
        <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={3}>
          <AuditLogItemHeader
            log={log}
            userName={userName}
            onViewJson={() => setIsJsonOpen(true)}
          />
          {log.impersonatedBy && (
            <Typography
              className="tw:text-tertiary"
              data-testid="impersonated-by"
              size="text-sm">
              {t('label.impersonated-by-with-colon')}{' '}
              <Link
                className="tw:font-semibold tw:text-secondary tw:hover:underline"
                to={getSettingsLink(getUserPath(log.impersonatedBy))}>
                {log.impersonatedBy}
              </Link>
            </Typography>
          )}
          {showEntity && (
            <AuditLogItemEntity
              entityFQN={entityFQN}
              entityHref={getEntityHref(log, normalizedType, entityFQN)}
              entityLabel={entityLabel}
            />
          )}
          <div data-testid="description-content">
            {changeRows.length > 0 ? (
              <div className="tw:divide-y tw:divide-secondary tw:rounded-lg tw:border tw:border-secondary tw:bg-secondary">
                {changeRows.map((row) => (
                  <ChangeRowView key={row.key} row={row} />
                ))}
              </div>
            ) : (
              <Typography size="text-sm">
                {log.summary ?? startCase(log.eventType)}
              </Typography>
            )}
          </div>
          <AuditLogItemMeta entityType={entityType} timestamp={log.eventTs} />
        </Box>
      </Card.Content>
      {isJsonOpen && (
        <AuditLogJsonDialog
          json={getAuditLogJson(log)}
          onClose={() => setIsJsonOpen(false)}
        />
      )}
    </Card>
  );
};

const AuditLogDayHeader: FC<{ group: AuditLogDayGroup }> = ({ group }) => {
  const { t } = useTranslation();
  const date = formatDate(group.timestamp);

  return (
    <div
      className="tw:flex tw:items-center tw:gap-3"
      data-testid="audit-log-day-header">
      <h2 className="tw:m-0 tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wide tw:text-tertiary">
        {isToday(group.timestamp) ? `${t('label.today')} · ${date}` : date}
      </h2>
      <span
        aria-hidden="true"
        className="tw:flex-1 tw:border-t tw:border-secondary"
      />
    </div>
  );
};

const AuditLogListSkeleton: FC = () => (
  <div
    className="tw:flex tw:flex-col tw:gap-3 tw:p-4"
    data-testid="audit-log-list-skeleton">
    <Skeleton variant="text" width={200} />
    {[1, 2, 3, 4, 5].map((i) => (
      <Card key={i}>
        <Card.Content className="tw:flex tw:gap-3.5">
          <Skeleton
            className="tw:shrink-0"
            height={36}
            variant="circular"
            width={36}
          />
          <Box className="tw:flex-1" direction="col" gap={1}>
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="75%" />
          </Box>
        </Card.Content>
      </Card>
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
  const dayGroups = useMemo(() => groupLogsByDay(logs), [logs]);

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
    <div
      className="tw:flex tw:w-full tw:flex-col tw:gap-4 tw:p-4"
      data-testid="audit-log-list">
      {dayGroups.map((group) => (
        <section className="tw:flex tw:flex-col tw:gap-3" key={group.dayKey}>
          <AuditLogDayHeader group={group} />
          {group.logs.map((log, index) => (
            <AuditLogListItem
              key={
                log.id?.toString() ??
                log.changeEventId ??
                `${group.dayKey}-${index}`
              }
              log={log}
            />
          ))}
        </section>
      ))}
    </div>
  );
};

export default AuditLogList;
