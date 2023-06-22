/*
 *  Copyright 2022 Collate.
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
  Col,
  Row,
  Skeleton,
  Switch,
  Table as TableAntd,
  Tabs,
  Typography,
} from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import ActivityFeedProvider, {
  useActivityFeedProvider,
} from 'components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { ActivityFeedTab } from 'components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import ActivityThreadPanel from 'components/ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import DescriptionV1 from 'components/common/description/DescriptionV1';
import EntityPageInfo from 'components/common/entityPageInfo/EntityPageInfo';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import FilterTablePlaceHolder from 'components/common/error-with-placeholder/FilterTablePlaceHolder';
import NextPrevious from 'components/common/next-previous/NextPrevious';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import Loader from 'components/Loader/Loader';
import { EntityName } from 'components/Modals/EntityNameModal/EntityNameModal.interface';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import TabsLabel from 'components/TabsLabel/TabsLabel.component';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { compare, Operation } from 'fast-json-patch';
import { TagLabel } from 'generated/type/tagLabel';
import { isEmpty, isUndefined, startCase, toNumber } from 'lodash';
import { observer } from 'mobx-react';
import { EntityTags, ExtraInfo } from 'Models';
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory, useParams } from 'react-router-dom';
import {
  getDatabaseSchemaDetailsByFQN,
  patchDatabaseSchemaDetails,
  restoreDatabaseSchema,
} from 'rest/databaseAPI';
import { getFeedCount, postThread } from 'rest/feedsAPI';
import { searchQuery } from 'rest/searchAPI';
import { default as appState } from '../../AppState';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import {
  getDatabaseDetailsPath,
  getDatabaseSchemaDetailsPath,
  getServiceDetailsPath,
  getTeamAndUserDetailsPath,
  INITIAL_PAGING_VALUE,
  PAGE_SIZE,
} from '../../constants/constants';
import { EntityField } from '../../constants/Feeds.constants';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { OwnerType } from '../../enums/user.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { DatabaseSchema } from '../../generated/entity/data/databaseSchema';
import { Table } from '../../generated/entity/data/table';
import { EntityFieldThreadCount } from '../../interface/feed.interface';
import {
  getQueryStringForSchemaTables,
  getTablesFromSearchResponse,
} from '../../utils/DatabaseSchemaDetailsUtils';
import { getEntityFeedLink, getEntityName } from '../../utils/EntityUtils';
import { getEntityFieldThreadCounts } from '../../utils/FeedUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getSettingPath } from '../../utils/RouterUtils';
import { getServiceRouteFromServiceType } from '../../utils/ServiceUtils';
import { getErrorText } from '../../utils/StringsUtils';
import {
  getEntityLink,
  getTagsWithoutTier,
  getTierTags,
} from '../../utils/TableUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

const DatabaseSchemaPage: FunctionComponent = () => {
  const { postFeed, deleteFeed, updateFeed } = useActivityFeedProvider();

  const [slashedTableName, setSlashedTableName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const { t } = useTranslation();
  const { getEntityPermissionByFqn } = usePermissionProvider();

  const { databaseSchemaFQN, tab: activeTab = EntityTabs.TABLE } =
    useParams<{ databaseSchemaFQN: string; tab: EntityTabs }>();
  const [isLoading, setIsLoading] = useState(true);
  const [databaseSchema, setDatabaseSchema] = useState<DatabaseSchema>();
  const [tableData, setTableData] = useState<Array<Table>>([]);
  const [tableDataLoading, setTableDataLoading] = useState<boolean>(true);

  const [databaseSchemaName, setDatabaseSchemaName] = useState<string>(
    databaseSchemaFQN.split(FQN_SEPARATOR_CHAR).slice(-1).pop() || ''
  );
  const [isSchemaDetailsLoading, setIsSchemaDetailsLoading] =
    useState<boolean>(true);
  const [isEdit, setIsEdit] = useState(false);
  const [description, setDescription] = useState('');

  const [tableInstanceCount, setTableInstanceCount] = useState<number>(0);

  const [error, setError] = useState('');

  const [feedCount, setFeedCount] = useState<number>(0);
  const [entityFieldThreadCount, setEntityFieldThreadCount] = useState<
    EntityFieldThreadCount[]
  >([]);

  const [threadLink, setThreadLink] = useState<string>('');
  const [currentTablesPage, setCurrentTablesPage] =
    useState<number>(INITIAL_PAGING_VALUE);

  const history = useHistory();
  const isMounting = useRef(true);

  const [databaseSchemaPermission, setDatabaseSchemaPermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const [tags, setTags] = useState<Array<EntityTags>>([]);
  const [tier, setTier] = useState<TagLabel>();

  const [showDeletedTables, setShowDeletedTables] = useState<boolean>(false);

  const databaseSchemaId = useMemo(
    () => databaseSchema?.id ?? '',
    [databaseSchema]
  );

  const fetchDatabaseSchemaPermission = async () => {
    setIsLoading(true);
    try {
      const response = await getEntityPermissionByFqn(
        ResourceEntity.DATABASE_SCHEMA,
        databaseSchemaFQN
      );
      setDatabaseSchemaPermission(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    {
      label: (
        <TabsLabel
          count={tableInstanceCount}
          id={EntityTabs.TABLE}
          isActive={activeTab === EntityTabs.TABLE}
          name={t('label.table-plural')}
        />
      ),
      key: EntityTabs.TABLE,
    },
    {
      label: (
        <TabsLabel
          count={feedCount}
          id={EntityTabs.ACTIVITY_FEED}
          isActive={activeTab === EntityTabs.ACTIVITY_FEED}
          name={t('label.activity-feed-plural')}
        />
      ),
      key: EntityTabs.ACTIVITY_FEED,
    },
  ];

  const extraInfo: Array<ExtraInfo> = [
    {
      key: 'Owner',
      value:
        databaseSchema?.owner?.type === 'team'
          ? getTeamAndUserDetailsPath(
              databaseSchema?.owner?.displayName ||
                databaseSchema?.owner?.name ||
                ''
            )
          : databaseSchema?.owner?.displayName ||
            databaseSchema?.owner?.name ||
            '',
      placeholderText:
        databaseSchema?.owner?.displayName || databaseSchema?.owner?.name || '',
      isLink: databaseSchema?.owner?.type === 'team',
      openInNewTab: false,
      profileName:
        databaseSchema?.owner?.type === OwnerType.USER
          ? databaseSchema?.owner?.name
          : undefined,
    },
  ];

  const onThreadLinkSelect = (link: string) => {
    setThreadLink(link);
  };

  const onThreadPanelClose = () => {
    setThreadLink('');
  };

  const getEntityFeedCount = () => {
    getFeedCount(
      getEntityFeedLink(EntityType.DATABASE_SCHEMA, databaseSchemaFQN)
    )
      .then((res) => {
        if (res) {
          setFeedCount(res.totalCount);
          setEntityFieldThreadCount(res.counts);
        } else {
          throw t('server.unexpected-response');
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(err, t('server.entity-feed-fetch-error'));
      });
  };

  const getDetailsByFQN = () => {
    setIsSchemaDetailsLoading(true);
    getDatabaseSchemaDetailsByFQN(
      databaseSchemaFQN,
      ['owner', 'usageSummary', 'tags'],
      'include=all'
    )
      .then((res) => {
        if (res) {
          const {
            description: schemaDescription = '',
            name,
            service,
            database,
            tags,
          } = res;
          setDatabaseSchema(res);
          setDescription(schemaDescription);

          setDatabaseSchemaName(name);
          setTags(getTagsWithoutTier(tags || []));
          setTier(getTierTags(tags ?? []));
          setShowDeletedTables(res.deleted ?? false);
          setSlashedTableName([
            {
              name: startCase(ServiceCategory.DATABASE_SERVICES),
              url: getSettingPath(
                GlobalSettingsMenuCategory.SERVICES,
                getServiceRouteFromServiceType(
                  ServiceCategory.DATABASE_SERVICES
                )
              ),
            },
            {
              name: getEntityName(service),
              url: service.name
                ? getServiceDetailsPath(
                    service.name,
                    ServiceCategory.DATABASE_SERVICES
                  )
                : '',
            },
            {
              name: getEntityName(database),
              url: getDatabaseDetailsPath(database.fullyQualifiedName ?? ''),
            },
          ]);
        } else {
          throw t('server.unexpected-response');
        }
      })
      .catch((err: AxiosError) => {
        const errMsg = getErrorText(
          err,
          t('server.entity-fetch-error', {
            entity: t('label.database-schema'),
          })
        );

        setError(errMsg);
        showErrorToast(errMsg);
      })
      .finally(() => {
        setIsLoading(false);
        setIsSchemaDetailsLoading(false);
      });
  };

  const getSchemaTables = async (
    pageNumber: number,
    databaseSchema: DatabaseSchema
  ) => {
    setTableDataLoading(true);
    try {
      setCurrentTablesPage(pageNumber);
      const res = await searchQuery({
        query: getQueryStringForSchemaTables(
          databaseSchema.service,
          databaseSchema.database,
          databaseSchema
        ),
        pageNumber,
        sortField: 'name.keyword',
        sortOrder: 'asc',
        pageSize: PAGE_SIZE,
        searchIndex: SearchIndex.TABLE,
        includeDeleted: showDeletedTables,
      });
      setTableData(getTablesFromSearchResponse(res));
      setTableInstanceCount(res.hits.total.value);
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setTableDataLoading(false);
    }
  };

  const tablePaginationHandler = (pageNumber: string | number) => {
    if (!isUndefined(databaseSchema)) {
      getSchemaTables(toNumber(pageNumber), databaseSchema);
    }
  };

  const onCancel = () => {
    setIsEdit(false);
  };

  const saveUpdatedDatabaseSchemaData = useCallback(
    async (updatedData: DatabaseSchema): Promise<DatabaseSchema> => {
      let jsonPatch: Operation[] = [];
      if (databaseSchema) {
        jsonPatch = compare(databaseSchema, updatedData);
      }

      return patchDatabaseSchemaDetails(databaseSchemaId, jsonPatch);
    },
    [databaseSchemaId, databaseSchema]
  );

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (description !== updatedHTML && databaseSchema) {
      const updatedDatabaseSchemaDetails = {
        ...databaseSchema,
        description: updatedHTML,
      };

      try {
        const response = await saveUpdatedDatabaseSchemaData(
          updatedDatabaseSchemaDetails
        );
        if (response) {
          setDatabaseSchema(updatedDatabaseSchemaDetails);
          setDescription(updatedHTML);
          getEntityFeedCount();
        } else {
          throw t('server.unexpected-response');
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsEdit(false);
      }
    } else {
      setIsEdit(false);
    }
  };

  const onDescriptionEdit = (): void => {
    setIsEdit(true);
  };

  const activeTabHandler = (activeKey: string) => {
    if (activeKey !== activeTab) {
      history.push({
        pathname: getDatabaseSchemaDetailsPath(databaseSchemaFQN, activeKey),
      });
    }
  };

  const handleUpdateOwner = useCallback(
    (owner: DatabaseSchema['owner']) => {
      const updatedData = {
        ...databaseSchema,
        owner: owner ? { ...databaseSchema?.owner, ...owner } : undefined,
      };

      return new Promise<void>((_, reject) => {
        saveUpdatedDatabaseSchemaData(updatedData as DatabaseSchema)
          .then((res) => {
            if (res) {
              setDatabaseSchema(res);
              reject();
            } else {
              reject();

              throw t('server.unexpected-response');
            }
          })
          .catch((err: AxiosError) => {
            showErrorToast(
              err,
              t('server.entity-updating-error', {
                entity: t('label.database-schema'),
              })
            );
            reject();
          });
      });
    },
    [databaseSchema, databaseSchema?.owner]
  );

  const onTagUpdate = async (selectedTags?: Array<EntityTags>) => {
    if (selectedTags) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedData = { ...databaseSchema, tags: updatedTags };

      try {
        const res = await saveUpdatedDatabaseSchemaData(
          updatedData as DatabaseSchema
        );
        setDatabaseSchema(res);
        setTags(getTagsWithoutTier(res.tags || []));
        setTier(getTierTags(res.tags ?? []));
        getEntityFeedCount();
      } catch (error) {
        showErrorToast(error as AxiosError, t('server.api-error'));
      }
    }
  };

  const handleUpdateDisplayName = async (data: EntityName) => {
    if (isUndefined(databaseSchema)) {
      return;
    }
    const updatedData = { ...databaseSchema, displayName: data.displayName };

    try {
      const res = await saveUpdatedDatabaseSchemaData(updatedData);
      setDatabaseSchema(res);
      getEntityFeedCount();
    } catch (error) {
      showErrorToast(error as AxiosError, t('server.api-error'));
    }
  };

  const createThread = async (data: CreateThread) => {
    try {
      await postThread(data);
      getEntityFeedCount();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.create-entity-error', {
          entity: t('label.conversation'),
        })
      );
    }
  };

  const tableColumn: ColumnsType<Table> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        render: (_, record: Table) => {
          return (
            <Link
              to={getEntityLink(
                EntityType.TABLE,
                record.fullyQualifiedName as string
              )}>
              {getEntityName(record)}
            </Link>
          );
        },
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        render: (text: string) =>
          text?.trim() ? (
            <RichTextEditorPreviewer markdown={text} />
          ) : (
            <span className="text-grey-muted">{t('label.no-description')}</span>
          ),
      },
    ],
    []
  );

  const getSchemaTableList = () => {
    return (
      <Col span={24}>
        {isEmpty(tableData) && !showDeletedTables && !tableDataLoading ? (
          <ErrorPlaceHolder
            className="mt-0-important"
            type={ERROR_PLACEHOLDER_TYPE.NO_DATA}
          />
        ) : (
          <TableAntd
            bordered
            columns={tableColumn}
            data-testid="databaseSchema-tables"
            dataSource={tableData}
            locale={{
              emptyText: <FilterTablePlaceHolder />,
            }}
            pagination={false}
            rowKey="id"
            size="small"
          />
        )}

        {tableInstanceCount > PAGE_SIZE && tableData.length > 0 && (
          <NextPrevious
            isNumberBased
            currentPage={currentTablesPage}
            pageSize={PAGE_SIZE}
            paging={{
              total: tableInstanceCount,
            }}
            pagingHandler={tablePaginationHandler}
            totalCount={tableInstanceCount}
          />
        )}
      </Col>
    );
  };

  const handleRestoreDatabaseSchema = useCallback(async () => {
    try {
      await restoreDatabaseSchema(databaseSchemaId);
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.database-schema'),
        }),
        2000
      );
      getDetailsByFQN();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.database-schema'),
        })
      );
    }
  }, [databaseSchemaId]);

  useEffect(() => {
    if (
      databaseSchemaPermission.ViewAll ||
      databaseSchemaPermission.ViewBasic
    ) {
      getDetailsByFQN();
      getEntityFeedCount();
    }
  }, [databaseSchemaPermission, databaseSchemaFQN]);

  useEffect(() => {
    tablePaginationHandler(INITIAL_PAGING_VALUE);
  }, [showDeletedTables, databaseSchema]);

  useEffect(() => {
    fetchDatabaseSchemaPermission();
  }, [databaseSchemaFQN]);

  // always Keep this useEffect at the end...
  useEffect(() => {
    isMounting.current = false;
    appState.inPageSearchText = '';
  }, []);

  if (isLoading) {
    return <Loader />;
  }

  if (error) {
    return (
      <ErrorPlaceHolder>
        <p data-testid="error-message">{error}</p>
      </ErrorPlaceHolder>
    );
  }

  if (
    !databaseSchemaPermission.ViewAll &&
    !databaseSchemaPermission.ViewBasic
  ) {
    return (
      <ErrorPlaceHolder
        className="mt-24"
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  return (
    <PageLayoutV1
      pageTitle={t('label.entity-detail-plural', {
        entity: getEntityName(databaseSchema),
      })}>
      <Row className="page-container">
        <Col span={24}>
          {isSchemaDetailsLoading ? (
            <Skeleton
              active
              paragraph={{
                rows: 3,
                width: ['20%', '80%', '60%'],
              }}
            />
          ) : (
            <Row>
              <Col span={24}>
                <EntityPageInfo
                  isRecursiveDelete
                  canDelete={databaseSchemaPermission.Delete}
                  currentOwner={databaseSchema?.owner}
                  deleted={databaseSchema?.deleted}
                  displayName={databaseSchema?.displayName}
                  entityFieldThreads={getEntityFieldThreadCounts(
                    EntityField.TAGS,
                    entityFieldThreadCount
                  )}
                  entityFqn={databaseSchemaFQN}
                  entityId={databaseSchemaId}
                  entityName={databaseSchemaName}
                  entityType={EntityType.DATABASE_SCHEMA}
                  extraInfo={extraInfo}
                  followersList={[]}
                  permission={databaseSchemaPermission}
                  serviceType={databaseSchema?.serviceType ?? ''}
                  tags={tags}
                  tagsHandler={onTagUpdate}
                  tier={tier}
                  titleLinks={slashedTableName}
                  updateOwner={
                    databaseSchemaPermission.EditOwner ||
                    databaseSchemaPermission.EditAll
                      ? handleUpdateOwner
                      : undefined
                  }
                  onRestoreEntity={handleRestoreDatabaseSchema}
                  onThreadLinkSelect={onThreadLinkSelect}
                  onUpdateDisplayName={handleUpdateDisplayName}
                />
              </Col>
            </Row>
          )}
        </Col>
        <Col span={24}>
          <Row className="m-t-xss">
            <Col span={24}>
              <Tabs
                activeKey={activeTab}
                data-testid="tabs"
                items={tabs}
                onChange={activeTabHandler}
              />
            </Col>
            <Col className="p-y-md" span={24}>
              {activeTab === EntityTabs.TABLE && (
                <>
                  {tableDataLoading ? (
                    <Loader />
                  ) : (
                    <Row gutter={[16, 16]}>
                      <Col data-testid="description-container" span={24}>
                        <DescriptionV1
                          description={description}
                          entityFieldThreads={getEntityFieldThreadCounts(
                            EntityField.DESCRIPTION,
                            entityFieldThreadCount
                          )}
                          entityFqn={databaseSchemaFQN}
                          entityName={databaseSchemaName}
                          entityType={EntityType.DATABASE_SCHEMA}
                          hasEditAccess={
                            databaseSchemaPermission.EditDescription ||
                            databaseSchemaPermission.EditAll
                          }
                          isEdit={isEdit}
                          onCancel={onCancel}
                          onDescriptionEdit={onDescriptionEdit}
                          onDescriptionUpdate={onDescriptionUpdate}
                          onThreadLinkSelect={onThreadLinkSelect}
                        />
                      </Col>
                      <Col span={24}>
                        <Row justify="end">
                          <Col>
                            <Switch
                              checked={showDeletedTables}
                              data-testid="show-deleted"
                              onClick={setShowDeletedTables}
                            />
                            <Typography.Text className="m-l-xs">
                              {t('label.deleted')}
                            </Typography.Text>{' '}
                          </Col>
                        </Row>
                      </Col>
                      {getSchemaTableList()}
                    </Row>
                  )}
                </>
              )}
              {activeTab === EntityTabs.ACTIVITY_FEED && (
                <ActivityFeedProvider>
                  <ActivityFeedTab
                    entityType={EntityType.DATABASE_SCHEMA}
                    fqn={databaseSchema?.fullyQualifiedName ?? ''}
                    onFeedUpdate={() => Promise.resolve()}
                  />
                </ActivityFeedProvider>
              )}
            </Col>
          </Row>
        </Col>
        <Col span={24}>
          {threadLink ? (
            <ActivityThreadPanel
              createThread={createThread}
              deletePostHandler={deleteFeed}
              open={Boolean(threadLink)}
              postFeedHandler={postFeed}
              threadLink={threadLink}
              updateThreadHandler={updateFeed}
              onCancel={onThreadPanelClose}
            />
          ) : null}
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default observer(DatabaseSchemaPage);
