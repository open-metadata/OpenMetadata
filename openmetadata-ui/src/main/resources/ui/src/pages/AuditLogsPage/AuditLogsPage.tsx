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

import { Button, Col, Popover, Row, Space, Table, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { compact, startCase } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import NextPrevious from '../../components/common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import { SelectableList } from '../../components/common/SelectableList/SelectableList.component';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { PAGE_SIZE_MEDIUM } from '../../constants/constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { EntityType } from '../../enums/entity.enum';
import { CursorType } from '../../enums/pagination.enum';
import { SearchIndex } from '../../enums/search.enum';
import { EntityReference } from '../../generated/entity/data/table';
import { ChangeDescription } from '../../generated/type/changeEvent';
import { Paging } from '../../generated/type/paging';
import { getAuditLogs } from '../../rest/auditLogAPI';
import { searchData } from '../../rest/miscAPI';
import { getUsers } from '../../rest/userAPI';
import {
  AuditLogEntry,
  AuditLogListResponse,
} from '../../types/auditLogs.interface';
import { formatUsersResponse } from '../../utils/APIUtils';
import { getTextFromHtmlString } from '../../utils/BlockEditorUtils';
import {
  formatDateTime,
  getRelativeTime,
} from '../../utils/date-time/DateTimeUtils';
import {
  getEntityLinkFromType,
  getEntityName,
  getEntityReferenceFromEntity,
  getEntityReferenceListFromEntities,
} from '../../utils/EntityUtils';
import Fqn from '../../utils/Fqn';
import { getUserPath } from '../../utils/RouterUtils';
import { isValidJSONString } from '../../utils/StringsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './AuditLogsPage.less';

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

const INITIAL_PAGING: Paging = {
  total: 0,
};

type FilterType = 'user' | 'bot' | 'service' | 'asset';

type FiltersState = {
  userName: string;
  entityFQN: string;
  entityType?: string;
  activeFilter?: FilterType;
};

const INITIAL_FILTERS: FiltersState = {
  userName: '',
  entityFQN: '',
  entityType: '',
  activeFilter: undefined,
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

const AuditLogsPage = () => {
  const { t } = useTranslation();

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [paging, setPaging] = useState<Paging>(INITIAL_PAGING);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<FiltersState>({ ...INITIAL_FILTERS });
  const [selectedUser, setSelectedUser] = useState<EntityReference>();
  const [selectedBot, setSelectedBot] = useState<EntityReference>();
  const [selectedService, setSelectedService] = useState<EntityReference>();
  const [selectedAsset, setSelectedAsset] = useState<EntityReference>();
  const [isUserFilterOpen, setIsUserFilterOpen] = useState(false);
  const [isBotFilterOpen, setIsBotFilterOpen] = useState(false);
  const [isServiceFilterOpen, setIsServiceFilterOpen] = useState(false);
  const [isAssetFilterOpen, setIsAssetFilterOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAuditLogs = useCallback(
    async (params?: { after?: string }) => {
      setIsLoading(true);
      try {
        const response: AuditLogListResponse = await getAuditLogs({
          limit: PAGE_SIZE_MEDIUM,
          after: params?.after,
          userName: filters.userName ? filters.userName.trim() : undefined,
          entityFQN: filters.entityFQN ? filters.entityFQN.trim() : undefined,
          entityType: filters.entityType
            ? filters.entityType.trim()
            : undefined,
        });
        setLogs(response.data);
        setPaging(response.paging ?? INITIAL_PAGING);
      } catch (error) {
        showErrorToast(error as Error);
      } finally {
        setIsLoading(false);
      }
    },
    [filters.entityFQN, filters.entityType, filters.userName]
  );

  useEffect(() => {
    setCurrentPage(1);
    fetchAuditLogs({ after: undefined });
  }, [fetchAuditLogs]);

  const handlePaging = useCallback(
    ({ cursorType, currentPage: requestedPage }: PagingHandlerParams) => {
      if (cursorType === CursorType.AFTER && paging?.after) {
        setCurrentPage(requestedPage);
        fetchAuditLogs({ after: paging.after });
      }

      if (cursorType === CursorType.BEFORE) {
        // Cursor based previous navigation is not supported yet.
        return;
      }
    },
    [fetchAuditLogs, paging]
  );

  const fetchUserOptions = useCallback(
    async (searchText: string, after?: string) => {
      if (searchText) {
        try {
          const response = await searchData(
            searchText,
            1,
            PAGE_SIZE_MEDIUM,
            'isBot:false',
            '',
            '',
            SearchIndex.USER
          );

          const total = response.data.hits.total?.value ?? 0;
          const users = getEntityReferenceListFromEntities(
            formatUsersResponse(response.data.hits.hits),
            EntityType.USER
          );

          return {
            data: users,
            paging: {
              total,
            },
          };
        } catch (error) {
          showErrorToast(error as AxiosError);

          return {
            data: [],
            paging: { total: 0 },
          };
        }
      }

      try {
        const { data, paging: pagingResponse } = await getUsers({
          limit: PAGE_SIZE_MEDIUM,
          after: after ?? undefined,
          isBot: false,
        });

        return {
          data: getEntityReferenceListFromEntities(data, EntityType.USER),
          paging: pagingResponse,
        };
      } catch (error) {
        showErrorToast(error as AxiosError);

        return {
          data: [],
          paging: { total: 0 },
        };
      }
    },
    []
  );

  const fetchBotOptions = useCallback(
    async (searchText: string, after?: string) => {
      if (searchText) {
        try {
          const response = await searchData(
            searchText,
            1,
            PAGE_SIZE_MEDIUM,
            'isBot:true',
            '',
            '',
            SearchIndex.USER
          );

          const total = response.data.hits.total?.value ?? 0;
          const users = getEntityReferenceListFromEntities(
            formatUsersResponse(response.data.hits.hits),
            EntityType.USER
          );

          return {
            data: users,
            paging: {
              total,
            },
          };
        } catch (error) {
          showErrorToast(error as AxiosError);

          return {
            data: [],
            paging: { total: 0 },
          };
        }
      }

      try {
        const { data, paging: pagingResponse } = await getUsers({
          limit: PAGE_SIZE_MEDIUM,
          after: after ?? undefined,
          isBot: true,
        });

        return {
          data: getEntityReferenceListFromEntities(data, EntityType.USER),
          paging: pagingResponse,
        };
      } catch (error) {
        showErrorToast(error as AxiosError);

        return {
          data: [],
          paging: { total: 0 },
        };
      }
    },
    []
  );

  const fetchServiceOptions = useCallback(async (searchText: string) => {
    try {
      const response = await searchData(
        searchText || '*',
        1,
        PAGE_SIZE_MEDIUM,
        '',
        '',
        '',
        SearchIndex.SERVICE
      );

      const hits = response.data.hits?.hits ?? [];
      const total = response.data.hits.total?.value ?? 0;

      const services: EntityReference[] = hits
        .map(({ _source }) => {
          const source = _source as EntityReference & {
            entityType?: string;
            type?: string;
          };
          const entityType = resolveEntityType(
            source?.entityType ?? source?.type
          );

          if (!entityType || !source?.fullyQualifiedName) {
            return undefined;
          }

          return getEntityReferenceFromEntity(source, entityType);
        })
        .filter(Boolean) as EntityReference[];

      return {
        data: services,
        paging: {
          total,
        },
      };
    } catch (error) {
      showErrorToast(error as AxiosError);

      return {
        data: [],
        paging: { total: 0 },
      };
    }
  }, []);

  const fetchAssetOptions = useCallback(async (searchText: string) => {
    try {
      const response = await searchData(
        searchText || '*',
        1,
        PAGE_SIZE_MEDIUM,
        '',
        '',
        '',
        SearchIndex.DATA_ASSET
      );

      const hits = response.data.hits?.hits ?? [];
      const total = response.data.hits.total?.value ?? 0;

      const entities: EntityReference[] = hits
        .map(({ _source }) => {
          const source = _source as EntityReference & {
            entityType?: string;
            type?: string;
          };
          const entityType = resolveEntityType(
            source?.entityType ?? source?.type
          );

          if (!entityType || !source?.fullyQualifiedName) {
            return undefined;
          }

          return getEntityReferenceFromEntity(source, entityType);
        })
        .filter(Boolean) as EntityReference[];

      return {
        data: entities,
        paging: {
          total,
        },
      };
    } catch (error) {
      showErrorToast(error as AxiosError);

      return {
        data: [],
        paging: { total: 0 },
      };
    }
  }, []);

  const clearAllSelections = useCallback(() => {
    setSelectedUser(undefined);
    setSelectedBot(undefined);
    setSelectedService(undefined);
    setSelectedAsset(undefined);
  }, []);

  const handleUserFilterUpdate = useCallback(
    async (items: EntityReference[]) => {
      const user = items[0];

      clearAllSelections();
      setSelectedUser(user);
      setFilters({
        userName: user?.name ?? '',
        entityFQN: '',
        entityType: '',
        activeFilter: user ? 'user' : undefined,
      });
      setIsUserFilterOpen(false);
    },
    [clearAllSelections]
  );

  const handleBotFilterUpdate = useCallback(
    async (items: EntityReference[]) => {
      const bot = items[0];

      clearAllSelections();
      setSelectedBot(bot);
      setFilters({
        userName: bot?.name ?? '',
        entityFQN: '',
        entityType: '',
        activeFilter: bot ? 'bot' : undefined,
      });
      setIsBotFilterOpen(false);
    },
    [clearAllSelections]
  );

  const handleServiceFilterUpdate = useCallback(
    async (items: EntityReference[]) => {
      const service = items[0];

      clearAllSelections();
      setSelectedService(service);
      setFilters({
        userName: '',
        entityFQN: service?.fullyQualifiedName ?? '',
        entityType: service?.type ?? '',
        activeFilter: service ? 'service' : undefined,
      });
      setIsServiceFilterOpen(false);
    },
    [clearAllSelections]
  );

  const handleAssetFilterUpdate = useCallback(
    async (items: EntityReference[]) => {
      const asset = items[0];

      clearAllSelections();
      setSelectedAsset(asset);
      setFilters({
        userName: '',
        entityFQN: asset?.fullyQualifiedName ?? '',
        entityType: asset?.type ?? '',
        activeFilter: asset ? 'asset' : undefined,
      });
      setIsAssetFilterOpen(false);
    },
    [clearAllSelections]
  );

  const handleFilterReset = () => {
    clearAllSelections();
    setFilters({ ...INITIAL_FILTERS });
  };

  const hasActiveFilters = Boolean(filters.userName || filters.entityFQN);

  const userFilterLabel = selectedUser
    ? getEntityName(selectedUser)
    : t('label.user');
  const botFilterLabel = selectedBot
    ? getEntityName(selectedBot)
    : t('label.bot');
  const serviceFilterLabel = selectedService
    ? getEntityName(selectedService)
    : t('label.service');
  const assetFilterLabel = selectedAsset
    ? getEntityName(selectedAsset)
    : t('label.asset');

  const getChangeDetails = useCallback(
    (changeDescription?: ChangeDescription) => {
      if (!changeDescription) {
        return [] as string[];
      }

      const details: string[] = [];
      const addedLabel = startCase(t('label.added-lowercase'));
      const updatedLabel = startCase(t('label.updated-lowercase'));
      const removedLabel = startCase(t('label.removed-lowercase'));
      const fallbackField = t('label.field', { defaultValue: 'field' });

      (changeDescription.fieldsAdded ?? []).forEach((change) => {
        const label = getFieldLabel(change.name);
        const value = formatChangeValue(change.newValue);

        details.push(
          value
            ? `${addedLabel} ${label || fallbackField}: ${value}`
            : `${addedLabel} ${label || fallbackField}`
        );
      });

      (changeDescription.fieldsUpdated ?? [])
        .filter((change) => change.name !== 'deleted')
        .forEach((change) => {
          const label = getFieldLabel(change.name);
          const oldValue = formatChangeValue(change.oldValue);
          const newValue = formatChangeValue(change.newValue);

          let entry = `${updatedLabel} ${label || fallbackField}`;

          if (oldValue || newValue) {
            const oldPart = oldValue ? oldValue : '';
            const arrow = oldValue && newValue ? ' → ' : '';
            const newPart = newValue ? newValue : '';

            entry = `${entry}: ${oldPart}${arrow}${newPart}`.trim();
          }

          details.push(entry.trim());
        });

      (changeDescription.fieldsDeleted ?? []).forEach((change) => {
        const label = getFieldLabel(change.name);
        const value = formatChangeValue(change.oldValue);

        details.push(
          value
            ? `${removedLabel} ${label || fallbackField}: ${value}`
            : `${removedLabel} ${label || fallbackField}`
        );
      });

      return details.filter(Boolean);
    },
    [t]
  );

  const columns: ColumnsType<AuditLogEntry> = useMemo(
    () => [
      {
        title: t('label.timestamp'),
        dataIndex: 'eventTs',
        key: 'eventTs',
        render: (value: number | undefined) => {
          if (!value) {
            return '--';
          }

          return (
            <Space direction="vertical" size={0}>
              <Typography.Text>{getRelativeTime(value)}</Typography.Text>
              <Typography.Text className="text-xs text-grey-muted">
                {formatDateTime(value)}
              </Typography.Text>
            </Space>
          );
        },
        width: 160,
      },
      {
        title: t('label.user'),
        dataIndex: 'userName',
        key: 'userName',
        render: (value: string | undefined) => {
          if (!value) {
            return t('label.system');
          }

          return <Link to={getUserPath(value)}>{value}</Link>;
        },
        width: 160,
      },
      {
        title: t('label.event'),
        dataIndex: 'eventType',
        key: 'eventType',
        render: (value: string | undefined) =>
          value ? startCase(value) : '--',
        width: 160,
      },
      {
        title: t('label.entity'),
        dataIndex: 'entityFQN',
        key: 'entity',
        render: (_: string, record: AuditLogEntry) => {
          const entityType =
            record.entityType ?? record.changeEvent?.entityType;
          const entityFQN =
            record.entityFQN ??
            record.changeEvent?.entityFullyQualifiedName ??
            record.changeEvent?.entity?.fullyQualifiedName;
          const entityLabel =
            getEntityName(record.changeEvent?.entity) ||
            (record.changeEvent?.entity as { name?: string })?.name ||
            (entityFQN ? Fqn.split(entityFQN).pop() : undefined) ||
            record.changeEvent?.entityFullyQualifiedName ||
            record.entityId;
          const normalizedType = resolveEntityType(entityType);

          if (normalizedType === EntityType.USER) {
            const userName =
              record.changeEvent?.entity?.name ??
              record.changeEvent?.entity?.fullyQualifiedName ??
              record.userName ??
              entityLabel;

            if (userName) {
              return (
                <Link to={getUserPath(userName)}>
                  {entityLabel ?? userName}
                </Link>
              );
            }
          }

          if (normalizedType && entityFQN) {
            const link = getEntityLinkFromType(entityFQN, normalizedType);

            if (link) {
              return <Link to={link}>{entityLabel ?? entityFQN}</Link>;
            }
          }

          return entityLabel ?? entityFQN ?? '--';
        },
      },
      {
        title: t('label.details'),
        dataIndex: 'changeEvent',
        key: 'changeEvent',
        render: (value: AuditLogEntry['changeEvent']) => {
          if (!value?.changeDescription) {
            return '--';
          }

          const detailLines = getChangeDetails(value.changeDescription);

          if (detailLines.length === 0) {
            return '--';
          }

          return (
            <Space className="w-full" direction="vertical" size={0}>
              {detailLines.map((line, index) => (
                <Typography.Paragraph
                  className="m-b-0"
                  ellipsis={{
                    rows: 3,
                    expandable: true,
                    symbol: t('label.more'),
                  }}
                  key={`${line}-${index}`}>
                  {line}
                </Typography.Paragraph>
              ))}
            </Space>
          );
        },
      },
    ],
    [getChangeDetails, t]
  );

  return (
    <PageLayoutV1 pageTitle={t('label.audit-log-plural')}>
      <Row gutter={[0, 16]}>
        <Col span={24}>
          <PageHeader
            data={{
              header: t(PAGE_HEADERS.AUDIT_LOGS.header),
              subHeader: t(PAGE_HEADERS.AUDIT_LOGS.subHeader),
            }}
          />
        </Col>

        <Col span={24}>
          <Row align="middle" gutter={[16, 16]} justify="space-between">
            <Col>
              <Space className="audit-log-filters" size={8}>
                <Popover
                  destroyTooltipOnHide
                  content={
                    <div data-testid="user-filter-popover">
                      <SelectableList
                        fetchOptions={fetchUserOptions}
                        multiSelect={false}
                        searchPlaceholder={t('label.search-for-type', {
                          type: t('label.user'),
                        })}
                        selectedItems={selectedUser ? [selectedUser] : []}
                        onCancel={() => setIsUserFilterOpen(false)}
                        onUpdate={handleUserFilterUpdate}
                      />
                    </div>
                  }
                  open={isUserFilterOpen}
                  overlayClassName="user-select-popover p-0"
                  placement="bottomLeft"
                  showArrow={false}
                  trigger="click"
                  onOpenChange={setIsUserFilterOpen}>
                  <Button
                    className={classNames('audit-log-filter-trigger', {
                      active: filters.activeFilter === 'user',
                    })}
                    data-testid="user-filter"
                    type="default">
                    {userFilterLabel}
                  </Button>
                </Popover>
                <Popover
                  destroyTooltipOnHide
                  content={
                    <div data-testid="bot-filter-popover">
                      <SelectableList
                        fetchOptions={fetchBotOptions}
                        multiSelect={false}
                        searchPlaceholder={t('label.search-for-type', {
                          type: t('label.bot').toString().toLowerCase(),
                        })}
                        selectedItems={selectedBot ? [selectedBot] : []}
                        onCancel={() => setIsBotFilterOpen(false)}
                        onUpdate={handleBotFilterUpdate}
                      />
                    </div>
                  }
                  open={isBotFilterOpen}
                  overlayClassName="user-select-popover p-0"
                  placement="bottomLeft"
                  showArrow={false}
                  trigger="click"
                  onOpenChange={setIsBotFilterOpen}>
                  <Button
                    className={classNames('audit-log-filter-trigger', {
                      active: filters.activeFilter === 'bot',
                    })}
                    data-testid="bot-filter"
                    type="default">
                    {botFilterLabel}
                  </Button>
                </Popover>
                <Popover
                  destroyTooltipOnHide
                  content={
                    <div data-testid="service-filter-popover">
                      <SelectableList
                        fetchOptions={fetchServiceOptions}
                        multiSelect={false}
                        searchPlaceholder={t('label.search-for-type', {
                          type: t('label.service').toString().toLowerCase(),
                        })}
                        selectedItems={selectedService ? [selectedService] : []}
                        onCancel={() => setIsServiceFilterOpen(false)}
                        onUpdate={handleServiceFilterUpdate}
                      />
                    </div>
                  }
                  open={isServiceFilterOpen}
                  overlayClassName="user-select-popover p-0"
                  placement="bottomLeft"
                  showArrow={false}
                  trigger="click"
                  onOpenChange={setIsServiceFilterOpen}>
                  <Button
                    className={classNames('audit-log-filter-trigger', {
                      active: filters.activeFilter === 'service',
                    })}
                    data-testid="service-filter"
                    type="default">
                    {serviceFilterLabel}
                  </Button>
                </Popover>
                <Popover
                  destroyTooltipOnHide
                  content={
                    <div data-testid="asset-filter-popover">
                      <SelectableList
                        fetchOptions={fetchAssetOptions}
                        multiSelect={false}
                        searchPlaceholder={t('label.search-for-type', {
                          type: t('label.asset').toString().toLowerCase(),
                        })}
                        selectedItems={selectedAsset ? [selectedAsset] : []}
                        onCancel={() => setIsAssetFilterOpen(false)}
                        onUpdate={handleAssetFilterUpdate}
                      />
                    </div>
                  }
                  open={isAssetFilterOpen}
                  overlayClassName="user-select-popover p-0"
                  placement="bottomLeft"
                  showArrow={false}
                  trigger="click"
                  onOpenChange={setIsAssetFilterOpen}>
                  <Button
                    className={classNames('audit-log-filter-trigger', {
                      active: filters.activeFilter === 'asset',
                    })}
                    data-testid="asset-filter"
                    type="default">
                    {assetFilterLabel}
                  </Button>
                </Popover>
                {hasActiveFilters && (
                  <Button
                    data-testid="clear-filters"
                    type="link"
                    onClick={handleFilterReset}>
                    {t('label.clear')}
                  </Button>
                )}
              </Space>
            </Col>
          </Row>
        </Col>

        <Col span={24}>
          <Table<AuditLogEntry>
            bordered={false}
            columns={columns}
            data-testid="audit-logs-table"
            dataSource={logs}
            loading={isLoading}
            locale={{
              emptyText: isLoading ? (
                t('message.loading')
              ) : (
                <ErrorPlaceHolder />
              ),
            }}
            pagination={false}
            rowKey={(record, index) =>
              record.id?.toString() ?? record.changeEventId ?? index.toString()
            }
            size="middle"
          />
        </Col>

        {logs.length > 0 && (
          <Col span={24}>
            <NextPrevious
              currentPage={currentPage}
              isLoading={isLoading}
              pageSize={PAGE_SIZE_MEDIUM}
              paging={paging}
              pagingHandler={handlePaging}
            />
          </Col>
        )}
      </Row>
    </PageLayoutV1>
  );
};

export default AuditLogsPage;
