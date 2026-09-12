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
    Box,
    EmptyPlaceholder,
    Skeleton,
    Typography
} from '@openmetadata/ui-core-components';
import { NoSearch } from '@openmetadata/ui-core-components/icons';
import { compact, startCase } from 'lodash';
import { FC, isValidElement, lazy, ReactNode, Suspense, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityType } from '../../enums/entity.enum';
import {
    ChangeDescription,
    FieldChange
} from '../../generated/type/changeEvent';
import { getTextFromHtmlString } from '../../utils/BlockEditorPureUtils';
import { getRelativeTime } from '../../utils/date-time/DateTimeUtils';
import { getEntityLinkFromType } from '../../utils/EntityLinkUtils';
import { getEntityName } from '../../utils/EntityNameUtils';
import Fqn from '../../utils/Fqn';
import {
    getDomainPath,
    getTagPath,
    getTeamsWithFqnPath,
    getUserPath
} from '../../utils/RouterUtils';
import { isValidJSONString } from '../../utils/StringUtils';
import ProfilePicture from '../common/ProfilePicture/ProfilePicture';
import {
    AuditLogListItemProps,
    AuditLogListProps
} from './AuditLogList.interface';

const RichTextEditorPreviewerV1 = lazy(
  () => import('../common/RichTextEditor/RichTextEditorPreviewerV1')
);

const getFieldLabel = (name?: string) => {
  if (!name) {
    return '';
  }
  const parts = name.split('.');

  return startCase(parts[parts.length - 1]);
};

const parseValue = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    if (isValidJSONString(value)) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }

    return value;
  }

  return value;
};

const formatObjectChangeValue = (parsed: object): string => {
  const maybeEntity = parsed as { displayName?: string; name?: string };
  if (maybeEntity.displayName || maybeEntity.name) {
    return maybeEntity.displayName ?? maybeEntity.name ?? '';
  }

  return JSON.stringify(parsed);
};

const formatChangeValue = (value: unknown): string => {
  const parsed = parseValue(value);
  if (parsed === null || parsed === undefined) {
    return '';
  }
  if (Array.isArray(parsed)) {
    return compact(parsed.map((item) => formatChangeValue(item))).join(', ');
  }
  if (typeof parsed === 'string') {
    const asText = getTextFromHtmlString(parsed);

    return asText || parsed;
  }
  if (typeof parsed === 'object') {
    return formatObjectChangeValue(parsed);
  }

  return String(parsed);
};

interface EntityInfo {
  fqn: string;
  name: string;
  displayName?: string;
}

const extractEntityInfo = (value: unknown): EntityInfo[] => {
  const parsed = parseValue(value);
  if (!parsed) {
    return [];
  }

  const items = Array.isArray(parsed) ? parsed : [parsed];

  return compact(
    items.map((item) => {
      if (typeof item === 'object' && item !== null) {
        const entity = item as {
          fullyQualifiedName?: string;
          tagFQN?: string;
          fqn?: string;
          name?: string;
          displayName?: string;
        };
        const fqn =
          entity.fullyQualifiedName ??
          entity.tagFQN ??
          entity.fqn ??
          entity.name;
        if (fqn) {
          return {
            fqn,
            name: entity.name ?? Fqn.split(fqn).pop() ?? fqn,
            displayName: entity.displayName,
          };
        }
      }

      return null;
    })
  );
};

const LINKABLE_FIELD_RESOLVERS: Record<string, (fqn: string) => string> = {
  tags: getTagPath,
  dataproducts: (fqn) => getEntityLinkFromType(fqn, EntityType.DATA_PRODUCT),
  teams: getTeamsWithFqnPath,
  domain: getDomainPath,
  owner: getUserPath,
  reviewers: getUserPath,
  experts: getUserPath,
};

const findLinkableFieldKey = (field: string): string | undefined =>
  Object.keys(LINKABLE_FIELD_RESOLVERS).find(
    (key) => field === key || field.endsWith(`.${key}`)
  );

const isDescriptionField = (fieldName: string): boolean =>
  fieldName === 'description' || fieldName.endsWith('.description');

const getEntityLinkForField = (
  fieldName: string,
  entityInfo: EntityInfo
): string | null => {
  const field = fieldName.toLowerCase();
  const matchedKey = findLinkableFieldKey(field);

  return matchedKey
    ? LINKABLE_FIELD_RESOLVERS[matchedKey](entityInfo.fqn)
    : null;
};

const renderEntityLinks = (
  fieldName: string,
  value: unknown,
  keyPrefix: string
): ReactNode[] => {
  const entities = extractEntityInfo(value);
  if (entities.length === 0) {
    const plainValue = formatChangeValue(value);

    return plainValue ? [plainValue] : [];
  }

  return entities.map((entity) => {
    const link = getEntityLinkForField(fieldName, entity);
    const label = entity.displayName ?? entity.name;
    const entityKey = `${keyPrefix}-${entity.fqn ?? entity.name}`;

    if (link) {
      return (
        <Link
          className="tw:text-fg-brand-primary tw:text-sm tw:hover:underline"
          key={entityKey}
          to={link}>
          {label}
        </Link>
      );
    }

    return <span key={entityKey}>{label}</span>;
  });
};

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

const getAuditLogDisplayInfo = (
  log: AuditLogListItemProps['log'],
  systemUserLabel: string
) => {
  const userName = log.userName || systemUserLabel;
  const eventType = log.eventType ? startCase(log.eventType) : '';
  const entityType = log.entityType ?? log.changeEvent?.entityType;
  const entityFQN =
    log.entityFQN ??
    log.changeEvent?.entityFullyQualifiedName ??
    log.changeEvent?.entity?.fullyQualifiedName;
  const entityLabel = resolveEntityLabel(log, entityFQN);
  const normalizedType = resolveEntityType(entityType);

  return {
    userName,
    eventType,
    entityType,
    entityFQN,
    entityLabel,
    normalizedType,
    timestamp: log.eventTs,
  };
};

const getUserEntityLink = (
  log: AuditLogListItemProps['log'],
  entityLabel?: string
): ReactNode | null => {
  const userNameForLink =
    log.changeEvent?.entity?.name ??
    log.changeEvent?.entity?.fullyQualifiedName ??
    log.userName ??
    entityLabel;
  if (!userNameForLink) {
    return null;
  }

  return (
    <Link
      className="tw:text-fg-brand-primary tw:text-sm tw:hover:underline"
      to={getUserPath(userNameForLink)}>
      {entityLabel ?? userNameForLink}
    </Link>
  );
};

const getTypedEntityLink = (
  entityFQN?: string,
  normalizedType?: EntityType,
  entityLabel?: string
): ReactNode | null => {
  if (!normalizedType || !entityFQN) {
    return null;
  }
  const link = getEntityLinkFromType(entityFQN, normalizedType);
  if (!link) {
    return null;
  }

  return (
    <Link
      className="tw:text-fg-brand-primary tw:text-sm tw:hover:underline"
      to={link}>
      {entityLabel ?? entityFQN}
    </Link>
  );
};

interface AuditLogItemHeaderProps {
  userLink: ReactNode;
  eventType: string;
  impersonatedBy?: string;
}

const AuditLogItemHeader: FC<AuditLogItemHeaderProps> = ({
  userLink,
  eventType,
  impersonatedBy,
}) => {
  const { t } = useTranslation();

  return (
    <Box align="center" data-testid="item-header" direction="row" gap={1} wrap="wrap">
      {userLink}
      <Typography className="tw:text-quaternary">–</Typography>
      <Typography
        className="tw:text-fg-brand-primary"
        data-testid="event-type"
        weight="medium">
        {eventType}
      </Typography>
      {impersonatedBy && (
        <>
          <Typography className="tw:text-quaternary">–</Typography>
          <Typography data-testid="impersonated-by">
            {t('label.impersonated-by-with-colon')}
          </Typography>{' '}
          <Link
            className="tw:font-semibold tw:text-fg-brand-primary tw:hover:underline"
            to={getUserPath(impersonatedBy)}>
            {impersonatedBy}
          </Link>
        </>
      )}
    </Box>
  );
};

interface AuditLogItemDescriptionProps {
  descriptionNodes: ReactNode[];
  eventType: string;
  entityLink: ReactNode;
}

const AuditLogItemDescription: FC<AuditLogItemDescriptionProps> = ({
  descriptionNodes,
  eventType,
  entityLink,
}) => (
  <div>
    {descriptionNodes.length > 0 ? (
      <div>
        {descriptionNodes.map((node, idx) => (
          <div key={isValidElement(node) ? node.key : undefined}>
            {node}
            {idx < descriptionNodes.length - 1 && (
              <span className="tw:text-quaternary">; </span>
            )}
          </div>
        ))}
      </div>
    ) : (
      <Box align="center" direction="row" gap={1}>
        <Typography className="tw:text-tertiary" size="text-sm">
          {eventType}
        </Typography>
        {entityLink}
      </Box>
    )}
  </div>
);

interface AuditLogItemMetaProps {
  entityType?: string;
  timestamp?: number;
}

const AuditLogItemMeta: FC<AuditLogItemMetaProps> = ({
  entityType,
  timestamp,
}) => (
  <Box align="center" className="tw:mt-1" data-testid="item-meta" direction="row" gap={2}>
    {entityType && (
      <Typography
        className="tw:text-fg-brand-primary"
        data-testid="entity-type-badge"
        size="text-xs">
        {startCase(entityType)}
      </Typography>
    )}
    {entityType && timestamp && (
      <Typography className="tw:text-quaternary" size="text-xs">
        |
      </Typography>
    )}
    {timestamp && (
      <Typography
        className="tw:text-quaternary"
        data-testid="timestamp"
        size="text-xs">
        {getRelativeTime(timestamp)}
      </Typography>
    )}
  </Box>
);

const AuditLogListItem: FC<AuditLogListItemProps> = ({ log }) => {
  const { t } = useTranslation();

  const {
    userName,
    eventType,
    entityType,
    entityFQN,
    entityLabel,
    normalizedType,
    timestamp,
  } = getAuditLogDisplayInfo(log, t('label.system'));

  const isLinkableField = useCallback((fieldName?: string): boolean => {
    if (!fieldName) {
      return false;
    }
    const field = fieldName.toLowerCase();
    const linkableFields = [
      'tags',
      'dataproducts',
      'teams',
      'domain',
      'owner',
      'reviewers',
      'experts',
    ];

    return linkableFields.some((f) => field === f || field.endsWith(`.${f}`));
  }, []);

  const isUserField = useCallback((fieldName?: string): boolean => {
    if (!fieldName) {
      return false;
    }
    const field = fieldName.toLowerCase();
    const userFields = ['owner', 'reviewers', 'experts'];

    return userFields.some((f) => field === f || field.endsWith(`.${f}`));
  }, []);

  const renderChangeValue = useCallback(
    (change: FieldChange, value: unknown, keyPrefix: string): ReactNode => {
      if (!value) {
        return null;
      }

      const fieldName = change.name ?? '';

      if (isLinkableField(fieldName)) {
        const links = renderEntityLinks(fieldName, value, keyPrefix);
        if (links.length > 0) {
          const showProfilePic = isUserField(fieldName);

          return (
            <span className="tw:inline">
              {links.map((link, idx) => {
                const entities = extractEntityInfo(value);
                const entity = entities[idx];

                return (
                  <span
                    className="tw:inline-flex tw:items-center tw:gap-1"
                    key={`${keyPrefix}-wrap-${entity?.fqn ?? entity?.name}`}>
                    {showProfilePic && entity && (
                      <ProfilePicture
                        className="tw:align-middle"
                        displayName={entity.displayName ?? entity.name}
                        height="16"
                        name={entity.name}
                        width="16"
                      />
                    )}
                    {link}
                    {idx < links.length - 1 && ', '}
                  </span>
                );
              })}
            </span>
          );
        }
      }

      if (isDescriptionField(fieldName)) {
        const markdown = typeof value === 'string' ? value : formatChangeValue(value);

        return (
          <Suspense fallback={<span>{formatChangeValue(value)}</span>}>
            <RichTextEditorPreviewerV1 markdown={markdown} />
          </Suspense>
        );
      }

      return <span>{formatChangeValue(value)}</span>;
    },
    [isLinkableField, isUserField]
  );

  const getChangeDetails = useCallback(
    (changeDescription?: ChangeDescription): ReactNode[] => {
      if (!changeDescription) {
        return [];
      }

      const details: ReactNode[] = [];
      const addedLabel = startCase(t('label.added-lowercase'));
      const updatedLabel = startCase(t('label.updated-lowercase'));
      const removedLabel = startCase(t('label.removed-lowercase'));
      const fallbackField = t('label.field', { defaultValue: 'field' });

      (changeDescription.fieldsAdded ?? []).forEach((change) => {
        const label = getFieldLabel(change.name);
        const valueNode = renderChangeValue(
          change,
          change.newValue,
          `added-${change.name}`
        );

        details.push(
          <span key={`added-${change.name}`}>
            <span className="tw:text-tertiary">{addedLabel}</span>{' '}
            <span className="tw:font-medium">{label || fallbackField}</span>
            {valueNode && <>: {valueNode}</>}
          </span>
        );
      });

      (changeDescription.fieldsUpdated ?? [])
        .filter((change) => change.name !== 'deleted')
        .forEach((change) => {
          const label = getFieldLabel(change.name);
          const oldValueNode = renderChangeValue(
            change,
            change.oldValue,
            `updated-old-${change.name}`
          );
          const newValueNode = renderChangeValue(
            change,
            change.newValue,
            `updated-new-${change.name}`
          );
          const hasValueChange = oldValueNode || newValueNode;

          details.push(
            <span key={`updated-${change.name}`}>
              <span className="tw:text-tertiary">{updatedLabel}</span>{' '}
              <span className="tw:font-medium">{label || fallbackField}</span>
              {hasValueChange && (
                <>
                  : {oldValueNode}
                  {oldValueNode && newValueNode && ' → '}
                  {newValueNode}
                </>
              )}
            </span>
          );
        });

      (changeDescription.fieldsDeleted ?? []).forEach((change) => {
        const label = getFieldLabel(change.name);
        const valueNode = renderChangeValue(
          change,
          change.oldValue,
          `deleted-${change.name}`
        );

        details.push(
          <span key={`deleted-${change.name}`}>
            <span className="tw:text-tertiary">{removedLabel}</span>{' '}
            <span className="tw:font-medium">{label || fallbackField}</span>
            {valueNode && <>: {valueNode}</>}
          </span>
        );
      });

      return details;
    },
    [t, renderChangeValue]
  );

  const descriptionNodes = useMemo((): ReactNode[] => {
    if (log.summary) {
      return [<span key="summary">{log.summary}</span>];
    }
    if (log.changeEvent?.changeDescription) {
      return getChangeDetails(log.changeEvent.changeDescription);
    }

    return [];
  }, [log, getChangeDetails]);

  const entityLink = useMemo(() => {
    if (normalizedType === EntityType.USER) {
      const userLinkNode = getUserEntityLink(log, entityLabel);
      if (userLinkNode) {
        return userLinkNode;
      }
    }

    const typedLinkNode = getTypedEntityLink(
      entityFQN,
      normalizedType,
      entityLabel
    );
    if (typedLinkNode) {
      return typedLinkNode;
    }

    return (
      <Typography size="text-sm">
        {entityLabel ?? entityFQN ?? '--'}
      </Typography>
    );
  }, [normalizedType, entityFQN, entityLabel, log]);

  const userLink = useMemo(() => {
    if (log.userName) {
      return (
        <Link
          className="tw:font-semibold tw:text-fg-brand-primary tw:hover:underline"
          to={getUserPath(log.userName)}>
          {userName}
        </Link>
      );
    }

    return <Typography weight="semibold">{userName}</Typography>;
  }, [log.userName, userName]);

  return (
    <Box
      className="tw:p-4 tw:border-b tw:border-primary tw:transition-colors tw:hover:bg-secondary tw:last:border-b-0"
      data-testid="audit-log-list-item"
      direction="row"
      gap={2}>
      <div className="tw:shrink-0" data-testid="item-avatar">
        <ProfilePicture
          displayName={userName}
          height="32"
          name={log.userName || 'system'}
          width="32"
        />
      </div>
      <Box className="tw:flex-1 tw:min-w-0 tw:items-start" direction="col" gap={1}>
        <AuditLogItemHeader
          eventType={eventType}
          impersonatedBy={log.impersonatedBy}
          userLink={userLink}
        />
        <AuditLogItemDescription
          descriptionNodes={descriptionNodes}
          entityLink={entityLink}
          eventType={eventType}
        />
        <AuditLogItemMeta entityType={entityType} timestamp={timestamp} />
      </Box>
    </Box>
  );
};

const AuditLogList: FC<AuditLogListProps> = ({
  logs,
  isLoading,
  hasActiveSearch,
  hasActiveFilters,
  onClearFilters,
}) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div data-testid="audit-log-list">
        <div className="tw:px-4 tw:py-2 tw:bg-secondary tw:border-b tw:border-primary">
          <Skeleton variant="text" width={200} />
        </div>
        <div>
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
      </div>
    );
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

    return (
      <div data-testid="audit-log-list">
        <div className="tw:p-8">
          {hasActiveSearch ? (
            <EmptyPlaceholder
              actions={clearAction}
              description={t('message.check-spelling-or-try-different-term')}
              icon={<NoSearch className="tw:text-quaternary" />}
              title={t('label.no-matching-results')}
            />
          ) : hasActiveFilters ? (
            <EmptyPlaceholder
              actions={clearAction}
              description={t('message.no-results-for-filters-description')}
              icon={<NoSearch className="tw:text-quaternary" />}
              title={t('label.no-result-for-these-filter-plural')}
            />
          ) : (
            <EmptyPlaceholder
              description={t('message.no-audit-logs-description')}
              title={t('label.no-audit-logs-yet')}
              variant="blank"
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="tw:w-full" data-testid="audit-log-list">
      <div>
        {logs.map((log, index) => (
          <AuditLogListItem
            key={log.id?.toString() ?? log.changeEventId ?? index.toString()}
            log={log}
          />
        ))}
      </div>
    </div>
  );
};

export default AuditLogList;
