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

import { Skeleton, Space, Typography } from 'antd';
import { compact, startCase } from 'lodash';
import { FC, ReactNode, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityType } from '../../enums/entity.enum';
import {
  ChangeDescription,
  FieldChange,
} from '../../generated/type/changeEvent';
import { getTextFromHtmlString } from '../../utils/BlockEditorUtils';
import { getRelativeTime } from '../../utils/date-time/DateTimeUtils';
import { getEntityLinkFromType, getEntityName } from '../../utils/EntityUtils';
import Fqn from '../../utils/Fqn';
import {
  getDomainPath,
  getTagPath,
  getTeamsWithFqnPath,
  getUserPath,
} from '../../utils/RouterUtils';
import { isValidJSONString } from '../../utils/StringsUtils';
import ErrorPlaceHolder from '../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import ProfilePicture from '../common/ProfilePicture/ProfilePicture';
import {
  AuditLogListItemProps,
  AuditLogListProps,
} from './AuditLogList.interface';
import './AuditLogList.less';

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
    const maybeEntity = parsed as { displayName?: string; name?: string };
    if (maybeEntity.displayName || maybeEntity.name) {
      return maybeEntity.displayName ?? maybeEntity.name ?? '';
    }

    return JSON.stringify(parsed);
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

const getEntityLinkForField = (
  fieldName: string,
  entityInfo: EntityInfo
): string | null => {
  const field = fieldName.toLowerCase();

  if (field === 'tags' || field.endsWith('.tags')) {
    return getTagPath(entityInfo.fqn);
  }
  if (field === 'dataproducts' || field.endsWith('.dataproducts')) {
    return getEntityLinkFromType(entityInfo.fqn, EntityType.DATA_PRODUCT);
  }
  if (field === 'teams' || field.endsWith('.teams')) {
    return getTeamsWithFqnPath(entityInfo.fqn);
  }
  if (field === 'domain' || field.endsWith('.domain')) {
    return getDomainPath(entityInfo.fqn);
  }
  if (field === 'owner' || field.endsWith('.owner')) {
    return getUserPath(entityInfo.fqn);
  }
  if (field === 'reviewers' || field.endsWith('.reviewers')) {
    return getUserPath(entityInfo.fqn);
  }
  if (field === 'experts' || field.endsWith('.experts')) {
    return getUserPath(entityInfo.fqn);
  }

  return null;
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

  return entities.map((entity, idx) => {
    const link = getEntityLinkForField(fieldName, entity);
    const label = entity.displayName ?? entity.name;

    if (link) {
      return (
        <Link
          className="change-entity-link"
          key={`${keyPrefix}-${idx}`}
          to={link}>
          {label}
        </Link>
      );
    }

    return <span key={`${keyPrefix}-${idx}`}>{label}</span>;
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

const AuditLogListItem: FC<AuditLogListItemProps> = ({ log }) => {
  const { t } = useTranslation();

  const userName = log.userName || t('label.system');
  const eventType = log.eventType ? startCase(log.eventType) : '';
  const entityType = log.entityType ?? log.changeEvent?.entityType;
  const entityFQN =
    log.entityFQN ??
    log.changeEvent?.entityFullyQualifiedName ??
    log.changeEvent?.entity?.fullyQualifiedName;
  const entityLabel =
    getEntityName(log.changeEvent?.entity) ||
    (log.changeEvent?.entity as { name?: string })?.name ||
    (entityFQN ? Fqn.split(entityFQN).pop() : undefined) ||
    log.changeEvent?.entityFullyQualifiedName ||
    log.entityId;
  const normalizedType = resolveEntityType(entityType);
  const timestamp = log.eventTs;

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
            <span className="change-value-links">
              {links.map((link, idx) => {
                const entities = extractEntityInfo(value);
                const entity = entities[idx];

                return (
                  <span
                    className="change-value-item"
                    key={`${keyPrefix}-wrap-${idx}`}>
                    {showProfilePic && entity && (
                      <ProfilePicture
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

      (changeDescription.fieldsAdded ?? []).forEach((change, idx) => {
        const label = getFieldLabel(change.name);
        const valueNode = renderChangeValue(
          change,
          change.newValue,
          `added-${idx}`
        );

        details.push(
          <span className="change-detail" key={`added-${idx}`}>
            <span className="change-action">{addedLabel}</span>{' '}
            <span className="change-field">{label || fallbackField}</span>
            {valueNode && <>: {valueNode}</>}
          </span>
        );
      });

      (changeDescription.fieldsUpdated ?? [])
        .filter((change) => change.name !== 'deleted')
        .forEach((change, idx) => {
          const label = getFieldLabel(change.name);
          const oldValueNode = renderChangeValue(
            change,
            change.oldValue,
            `updated-old-${idx}`
          );
          const newValueNode = renderChangeValue(
            change,
            change.newValue,
            `updated-new-${idx}`
          );

          details.push(
            <span className="change-detail" key={`updated-${idx}`}>
              <span className="change-action">{updatedLabel}</span>{' '}
              <span className="change-field">{label || fallbackField}</span>
              {(oldValueNode || newValueNode) && (
                <>
                  : {oldValueNode}
                  {oldValueNode && newValueNode && ' → '}
                  {newValueNode}
                </>
              )}
            </span>
          );
        });

      (changeDescription.fieldsDeleted ?? []).forEach((change, idx) => {
        const label = getFieldLabel(change.name);
        const valueNode = renderChangeValue(
          change,
          change.oldValue,
          `deleted-${idx}`
        );

        details.push(
          <span className="change-detail" key={`deleted-${idx}`}>
            <span className="change-action">{removedLabel}</span>{' '}
            <span className="change-field">{label || fallbackField}</span>
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
      const userNameForLink =
        log.changeEvent?.entity?.name ??
        log.changeEvent?.entity?.fullyQualifiedName ??
        log.userName ??
        entityLabel;
      if (userNameForLink) {
        return (
          <Link className="entity-link" to={getUserPath(userNameForLink)}>
            {entityLabel ?? userNameForLink}
          </Link>
        );
      }
    }
    if (normalizedType && entityFQN) {
      const link = getEntityLinkFromType(entityFQN, normalizedType);
      if (link) {
        return (
          <Link className="entity-link" to={link}>
            {entityLabel ?? entityFQN}
          </Link>
        );
      }
    }

    return (
      <Typography.Text className="entity-name">
        {entityLabel ?? entityFQN ?? '--'}
      </Typography.Text>
    );
  }, [normalizedType, entityFQN, entityLabel, log]);

  const userLink = useMemo(() => {
    if (log.userName) {
      return (
        <Link className="user-link" to={getUserPath(log.userName)}>
          {userName}
        </Link>
      );
    }

    return <Typography.Text className="user-name">{userName}</Typography.Text>;
  }, [log.userName, userName]);

  return (
    <div className="audit-log-list-item" data-testid="audit-log-list-item">
      <div className="item-avatar" data-testid="item-avatar">
        <ProfilePicture
          displayName={userName}
          height="32"
          name={log.userName || 'system'}
          width="32"
        />
      </div>
      <div className="item-content">
        <div className="item-header" data-testid="item-header">
          <Space size={4}>
            {userLink}
            <Typography.Text className="event-separator">–</Typography.Text>
            <Typography.Text className="event-type" data-testid="event-type">
              {eventType}
            </Typography.Text>
            {log.impersonatedBy && (
              <>
                <Typography.Text className="event-separator">–</Typography.Text>
                <Typography.Text
                  className="impersonated-by"
                  data-testid="impersonated-by">
                  {t('label.impersonated-by-with-colon')}
                </Typography.Text>{' '}
                <Link
                  className="user-link"
                  to={getUserPath(log.impersonatedBy)}>
                  {log.impersonatedBy}
                </Link>
              </>
            )}
          </Space>
        </div>
        <div className="item-description">
          {descriptionNodes.length > 0 ? (
            <div className="description-content">
              {descriptionNodes.map((node, idx) => (
                <span className="description-item" key={idx}>
                  {node}
                  {idx < descriptionNodes.length - 1 && (
                    <span className="description-separator">; </span>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <Space size={4}>
              <Typography.Text className="action-text">
                {eventType}
              </Typography.Text>
              {entityLink}
            </Space>
          )}
        </div>
        <div className="item-meta" data-testid="item-meta">
          <Space size={8} split={<span className="meta-separator">|</span>}>
            {entityType && (
              <Typography.Text
                className="meta-item entity-type-badge"
                data-testid="entity-type-badge">
                {startCase(entityType)}
              </Typography.Text>
            )}
            {timestamp && (
              <Typography.Text
                className="meta-item timestamp"
                data-testid="timestamp">
                {getRelativeTime(timestamp)}
              </Typography.Text>
            )}
          </Space>
        </div>
      </div>
    </div>
  );
};

const AuditLogList: FC<AuditLogListProps> = ({ logs, isLoading }) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="audit-log-list-container" data-testid="audit-log-list">
        <div className="audit-log-list-header">
          <Skeleton.Input active size="small" style={{ width: 200 }} />
        </div>
        <div className="audit-log-list">
          {[1, 2, 3, 4, 5].map((i) => (
            <div className="audit-log-list-item skeleton-item" key={i}>
              <Skeleton active avatar paragraph={{ rows: 2 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="audit-log-list-container" data-testid="audit-log-list">
        <div className="audit-log-list-header">
          <Typography.Text className="header-text">
            {t('label.event-plural')}
          </Typography.Text>
        </div>
        <div className="audit-log-list empty">
          <ErrorPlaceHolder />
        </div>
      </div>
    );
  }

  return (
    <div className="audit-log-list-container" data-testid="audit-log-list">
      <div className="audit-log-list">
        {
          logs.map((log, index) => (
            <AuditLogListItem
              key={log.id?.toString() ?? log.changeEventId ?? index.toString()}
              log={log}
            />
          ))
        }
      </div>
    </div >
  );
};

export default AuditLogList;
