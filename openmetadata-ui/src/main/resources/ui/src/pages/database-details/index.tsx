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
  Space,
  Switch,
  Table,
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
import ManageButton from 'components/common/entityPageInfo/ManageButton/ManageButton';
import EntitySummaryDetails from 'components/common/EntitySummaryDetails/EntitySummaryDetails';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import NextPrevious from 'components/common/next-previous/NextPrevious';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import { EntityHeader } from 'components/Entity/EntityHeader/EntityHeader.component';
import Loader from 'components/Loader/Loader';
import { EntityName } from 'components/Modals/EntityNameModal/EntityNameModal.interface';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import TabsLabel from 'components/TabsLabel/TabsLabel.component';
import TagsContainer from 'components/Tag/TagsContainer/tags-container';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { compare, Operation } from 'fast-json-patch';
import { LabelType } from 'generated/entity/data/table';
import { Include } from 'generated/type/include';
import { State } from 'generated/type/tagLabel';
import { isEmpty, isNil, isUndefined, startCase } from 'lodash';
import { observer } from 'mobx-react';
import { EntityTags, ExtraInfo, TagOption } from 'Models';
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
  getDatabaseDetailsByFQN,
  getDatabaseSchemas,
  patchDatabaseDetails,
} from 'rest/databaseAPI';
import { getFeedCount, postThread } from 'rest/feedsAPI';
import { fetchTagsAndGlossaryTerms } from 'utils/TagsUtils';
import { default as appState } from '../../AppState';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import {
  getDatabaseDetailsPath,
  getDatabaseSchemaDetailsPath,
  getExplorePath,
  getServiceDetailsPath,
  getTeamAndUserDetailsPath,
  PAGE_SIZE,
  pagingObject,
} from '../../constants/constants';
import { EntityField } from '../../constants/Feeds.constants';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { EntityInfo, EntityTabs, EntityType } from '../../enums/entity.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { OwnerType } from '../../enums/user.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Database } from '../../generated/entity/data/database';
import { DatabaseSchema } from '../../generated/entity/data/databaseSchema';
import { EntityReference } from '../../generated/entity/teams/user';
import { UsageDetails } from '../../generated/type/entityUsage';
import { Paging } from '../../generated/type/paging';
import { EntityFieldThreadCount } from '../../interface/feed.interface';
import { getEntityFeedLink, getEntityName } from '../../utils/EntityUtils';
import { getEntityFieldThreadCounts } from '../../utils/FeedUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getSettingPath } from '../../utils/RouterUtils';
import {
  getServiceRouteFromServiceType,
  serviceTypeLogo,
} from '../../utils/ServiceUtils';
import { getErrorText } from '../../utils/StringsUtils';
import {
  getTagsWithoutTier,
  getTierTags,
  getUsagePercentile,
} from '../../utils/TableUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const DatabaseDetails: FunctionComponent = () => {
  const { t } = useTranslation();
  const { postFeed, deleteFeed, updateFeed } = useActivityFeedProvider();
  const [slashedDatabaseName, setSlashedDatabaseName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const { getEntityPermissionByFqn } = usePermissionProvider();

  const { databaseFQN, tab: activeTab = EntityTabs.SCHEMA } =
    useParams<{ databaseFQN: string; tab: EntityTabs }>();
  const [isLoading, setIsLoading] = useState(true);
  const [showDeletedSchemas, setShowDeletedSchemas] = useState<boolean>(false);
  const [database, setDatabase] = useState<Database>();
  const [serviceType, setServiceType] = useState<string>();
  const [schemaData, setSchemaData] = useState<DatabaseSchema[]>([]);
  const [schemaDataLoading, setSchemaDataLoading] = useState<boolean>(true);

  const [databaseName, setDatabaseName] = useState<string>(
    databaseFQN.split(FQN_SEPARATOR_CHAR).slice(-1).pop() || ''
  );
  const [isDatabaseDetailsLoading, setIsDatabaseDetailsLoading] =
    useState<boolean>(true);
  const [isEdit, setIsEdit] = useState(false);
  const [description, setDescription] = useState('');
  const [databaseId, setDatabaseId] = useState('');
  const [databaseSchemaPaging, setSchemaPaging] =
    useState<Paging>(pagingObject);
  const [databaseSchemaInstanceCount, setSchemaInstanceCount] =
    useState<number>(0);

  const [error, setError] = useState('');
  const [feedCount, setFeedCount] = useState<number>(0);
  const [entityFieldThreadCount, setEntityFieldThreadCount] = useState<
    EntityFieldThreadCount[]
  >([]);

  const [threadLink, setThreadLink] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isEditable, setIsEditable] = useState<boolean>(false);
  const [tagList, setTagList] = useState<Array<TagOption>>([]);
  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);

  const history = useHistory();
  const isMounting = useRef(true);

  const tier = getTierTags(database?.tags ?? []);
  const tags = getTagsWithoutTier(database?.tags ?? []);

  const deleted = database?.deleted;

  const [databasePermission, setDatabasePermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const fetchDatabasePermission = async () => {
    setIsLoading(true);
    try {
      const response = await getEntityPermissionByFqn(
        ResourceEntity.DATABASE,
        databaseFQN
      );
      setDatabasePermission(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = useMemo(() => {
    return [
      {
        label: (
          <TabsLabel
            count={databaseSchemaInstanceCount}
            id={EntityTabs.SCHEMA}
            isActive={activeTab === EntityTabs.SCHEMA}
            name={t('label.schema-plural')}
          />
        ),
        key: EntityTabs.SCHEMA,
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
  }, [activeTab, databaseSchemaInstanceCount, feedCount]);

  const extraInfo: Array<ExtraInfo> = [
    {
      key: EntityInfo.OWNER,
      value:
        database?.owner?.type === 'team'
          ? getTeamAndUserDetailsPath(
              database?.owner?.displayName || database?.owner?.name || ''
            )
          : database?.owner?.displayName || database?.owner?.name || '',
      placeholderText:
        database?.owner?.displayName || database?.owner?.name || '',
      isLink: database?.owner?.type === 'team',
      openInNewTab: false,
      profileName:
        database?.owner?.type === OwnerType.USER
          ? database?.owner?.name
          : undefined,
    },
    {
      key: EntityInfo.TIER,
      value: tier?.tagFQN ? tier.tagFQN.split(FQN_SEPARATOR_CHAR)[1] : '',
    },
  ];

  const fetchDatabaseSchemas = (pagingObj?: string) => {
    return new Promise<void>((resolve, reject) => {
      setSchemaDataLoading(true);
      getDatabaseSchemas(
        databaseFQN,
        pagingObj,
        ['owner', 'usageSummary'],
        showDeletedSchemas ? Include.Deleted : Include.NonDeleted
      )
        .then((res) => {
          if (res.data) {
            setSchemaData(res.data);
            setSchemaPaging(res.paging);
            setSchemaInstanceCount(res.paging.total);
          } else {
            setSchemaData([]);
            setSchemaPaging(pagingObject);

            throw t('server.unexpected-response');
          }
          resolve();
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            t('server.entity-fetch-error', {
              entity: t('label.database schema'),
            })
          );

          reject();
        })
        .finally(() => {
          setSchemaDataLoading(false);
        });
    });
  };

  const fetchDatabaseSchemasAndDBTModels = () => {
    setIsLoading(true);
    Promise.allSettled([fetchDatabaseSchemas()]).finally(() => {
      setIsLoading(false);
    });
  };

  const onThreadLinkSelect = (link: string) => {
    setThreadLink(link);
  };

  const onThreadPanelClose = () => {
    setThreadLink('');
  };

  const getEntityFeedCount = () => {
    getFeedCount(getEntityFeedLink(EntityType.DATABASE, databaseFQN))
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
    setIsDatabaseDetailsLoading(true);
    getDatabaseDetailsByFQN(databaseFQN, ['owner', 'tags'])
      .then((res) => {
        if (res) {
          const { description, id, name, service, serviceType } = res;
          setDatabase(res);
          setDescription(description ?? '');
          setDatabaseId(id ?? '');
          setDatabaseName(name);

          setServiceType(serviceType);

          setSlashedDatabaseName([
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
          ]);
          fetchDatabaseSchemasAndDBTModels();
        } else {
          throw t('server.unexpected-response');
        }
      })
      .catch((err: AxiosError) => {
        const errMsg = getErrorText(
          err,
          t('server.entity-fetch-error', {
            entity: t('label.database'),
          })
        );
        setError(errMsg);
        showErrorToast(errMsg);
      })
      .finally(() => {
        setIsLoading(false);
        setIsDatabaseDetailsLoading(false);
      });
  };

  const onCancel = () => {
    setIsEdit(false);
  };

  const saveUpdatedDatabaseData = (updatedData: Database) => {
    let jsonPatch: Operation[] = [];
    if (database) {
      jsonPatch = compare(database, updatedData);
    }

    return patchDatabaseDetails(databaseId, jsonPatch);
  };

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (description !== updatedHTML && database) {
      const updatedDatabaseDetails = {
        ...database,
        description: updatedHTML,
      };
      try {
        const response = await saveUpdatedDatabaseData(updatedDatabaseDetails);
        if (response) {
          setDatabase(updatedDatabaseDetails);
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

  const activeTabHandler = (key: string) => {
    if (key !== activeTab) {
      history.push({
        pathname: getDatabaseDetailsPath(databaseFQN, key),
      });
    }
  };

  const databaseSchemaPagingHandler = (
    cursorType: string | number,
    activePage?: number
  ) => {
    const pagingString = `&${cursorType}=${
      databaseSchemaPaging[cursorType as keyof typeof databaseSchemaPaging]
    }`;
    setIsLoading(true);
    fetchDatabaseSchemas(pagingString).finally(() => {
      setIsLoading(false);
    });
    setCurrentPage(activePage ?? 1);
  };

  const settingsUpdateHandler = async (data: Database) => {
    try {
      const res = await saveUpdatedDatabaseData(data);

      setDatabase(res);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-updating-error', {
          entity: t('label.database'),
        })
      );
    }
  };

  const handleUpdateOwner = useCallback(
    (owner: Database['owner']) => {
      const updatedData = {
        ...database,
        owner: owner ? { ...database?.owner, ...owner } : undefined,
      };

      settingsUpdateHandler(updatedData as Database);
    },
    [database, database?.owner, settingsUpdateHandler]
  );

  const createThread = (data: CreateThread) => {
    postThread(data)
      .then((res) => {
        if (res) {
          getEntityFeedCount();
        } else {
          showErrorToast(t('server.unexpected-response'));
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          t('server.create-entity-error', {
            entity: t('label.conversation-lowercase'),
          })
        );
      });
  };

  useEffect(() => {
    getEntityFeedCount();
  }, []);

  useEffect(() => {
    if (!isMounting.current && appState.inPageSearchText) {
      history.push(
        getExplorePath({
          search: appState.inPageSearchText,
          extraParameters: {
            facetFilter: {
              serviceType: [serviceType],
              'database.name.keyword': [databaseName],
            },
          },
        })
      );
    }
  }, [appState.inPageSearchText]);

  useEffect(() => {
    if (databasePermission.ViewAll || databasePermission.ViewBasic) {
      getDetailsByFQN();
    }
  }, [databasePermission, databaseFQN]);

  useEffect(() => {
    fetchDatabasePermission();
  }, [databaseFQN]);

  // always Keep this useEffect at the end...
  useEffect(() => {
    isMounting.current = false;
    appState.inPageSearchText = '';
  }, []);

  const tableColumn: ColumnsType<DatabaseSchema> = useMemo(
    () => [
      {
        title: t('label.schema-name'),
        dataIndex: 'name',
        key: 'name',
        render: (_, record: DatabaseSchema) => (
          <Link
            to={
              record.fullyQualifiedName
                ? getDatabaseSchemaDetailsPath(record.fullyQualifiedName)
                : ''
            }>
            {getEntityName(record)}
          </Link>
        ),
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        render: (text: string) =>
          text?.trim() ? (
            <RichTextEditorPreviewer markdown={text} />
          ) : (
            <span className="text-grey-muted">
              {t('label.no-entity', { entity: t('label.description') })}
            </span>
          ),
      },
      {
        title: t('label.owner'),
        dataIndex: 'owner',
        key: 'owner',
        render: (text: EntityReference) => getEntityName(text) || '--',
      },
      {
        title: t('label.usage'),
        dataIndex: 'usageSummary',
        key: 'usageSummary',
        render: (text: UsageDetails) =>
          getUsagePercentile(text?.weeklyStats?.percentileRank || 0),
      },
    ],
    []
  );

  const handleUpdateTier = useCallback(
    (newTier?: string) => {
      const tierTag = newTier
        ? [
            ...getTagsWithoutTier(database?.tags ?? []),
            {
              tagFQN: newTier,
              labelType: LabelType.Manual,
              state: State.Confirmed,
            },
          ]
        : getTagsWithoutTier(database?.tags ?? []);
      const updatedTableDetails = {
        ...database,
        tags: tierTag,
      };

      return settingsUpdateHandler(updatedTableDetails as Database);
    },
    [settingsUpdateHandler, database, tier]
  );

  const handleUpdateDisplayName = async (data: EntityName) => {
    if (isUndefined(database)) {
      return;
    }

    const updatedTableDetails = {
      ...database,
      displayName: data.displayName,
    };

    return settingsUpdateHandler(updatedTableDetails);
  };

  const fetchTags = async () => {
    setIsTagLoading(true);
    try {
      const tags = await fetchTagsAndGlossaryTerms();
      setTagList(tags);
    } catch (error) {
      setTagList([]);
    } finally {
      setIsTagLoading(false);
    }
  };

  const isTagEditable =
    databasePermission.EditTags || databasePermission.EditAll;

  const selectedTags = useMemo(() => {
    return tier?.tagFQN
      ? [
          ...tags.map((tag) => ({
            ...tag,
            isRemovable: true,
          })),
          { tagFQN: tier.tagFQN, isRemovable: false },
        ]
      : [
          ...tags.map((tag) => ({
            ...tag,
            isRemovable: true,
          })),
        ] ?? [];
  }, [tier, tags]);

  /**
   * Formulates updated tags and updates table entity data for API call
   * @param selectedTags
   */
  const onTagUpdate = (selectedTags?: Array<EntityTags>) => {
    if (selectedTags) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedTable = { ...database, tags: updatedTags };
      settingsUpdateHandler(updatedTable as Database);
    }
  };

  const handleTagSelection = (selectedTags?: Array<EntityTags>) => {
    if (selectedTags) {
      const prevTags =
        tags?.filter((tag) =>
          selectedTags
            .map((selTag) => selTag.tagFQN)
            .includes(tag?.tagFQN as string)
        ) || [];
      const newTags = selectedTags
        .filter((tag) => {
          return !prevTags
            ?.map((prevTag) => prevTag.tagFQN)
            .includes(tag.tagFQN);
        })
        .map((tag) => ({
          labelType: LabelType.Manual,
          state: State.Confirmed,
          source: tag.source,
          tagFQN: tag.tagFQN,
        }));
      onTagUpdate([...prevTags, ...newTags]);
    }
    setIsEditable(false);
  };

  const databaseTable = useMemo(() => {
    if (schemaDataLoading) {
      return <Loader />;
    } else if (!isEmpty(schemaData)) {
      return (
        <Col span={24}>
          <Table
            bordered
            columns={tableColumn}
            data-testid="database-databaseSchemas"
            dataSource={schemaData}
            loading={{
              spinning: schemaDataLoading,
              indicator: <Loader size="small" />,
            }}
            pagination={false}
            rowKey="id"
            size="small"
          />
          {Boolean(
            !isNil(databaseSchemaPaging.after) ||
              !isNil(databaseSchemaPaging.before)
          ) && (
            <NextPrevious
              currentPage={currentPage}
              pageSize={PAGE_SIZE}
              paging={databaseSchemaPaging}
              pagingHandler={databaseSchemaPagingHandler}
              totalCount={databaseSchemaPaging.total}
            />
          )}
        </Col>
      );
    } else {
      return <ErrorPlaceHolder />;
    }
  }, [
    schemaDataLoading,
    schemaData,
    tableColumn,
    databaseSchemaPaging,
    currentPage,
    databaseSchemaPagingHandler,
  ]);

  useEffect(() => {
    fetchDatabaseSchemas();
  }, [showDeletedSchemas]);

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

  return (
    <>
      {databasePermission.ViewAll || databasePermission.ViewBasic ? (
        <PageLayoutV1
          pageTitle={t('label.entity-detail-plural', {
            entity: getEntityName(database),
          })}>
          <Row className="page-container">
            {isDatabaseDetailsLoading ? (
              <Skeleton
                active
                paragraph={{
                  rows: 3,
                  width: ['20%', '80%', '60%'],
                }}
              />
            ) : (
              <Col span={24}>
                {database && (
                  <Row wrap={false}>
                    <Col flex="auto">
                      <EntityHeader
                        breadcrumb={slashedDatabaseName}
                        entityData={database}
                        entityType={EntityType.DATABASE}
                        icon={
                          <img
                            className="h-8"
                            src={serviceTypeLogo(serviceType ?? '')}
                          />
                        }
                        serviceName={database.service.name ?? ''}
                      />
                    </Col>
                    <Col flex="30px">
                      <ManageButton
                        isRecursiveDelete
                        allowSoftDelete={false}
                        canDelete={databasePermission.Delete}
                        displayName={database.displayName}
                        editDisplayNamePermission={
                          databasePermission.EditAll ||
                          databasePermission.EditDisplayName
                        }
                        entityFQN={databaseFQN}
                        entityId={databaseId}
                        entityName={databaseName}
                        entityType={EntityType.DATABASE}
                        onEditDisplayName={handleUpdateDisplayName}
                      />
                    </Col>
                  </Row>
                )}
                <Col className="m-t-xs" span={24}>
                  <Space wrap align="center" data-testid="extrainfo" size={4}>
                    {extraInfo.map((info, index) => (
                      <span
                        className="d-flex tw-items-center"
                        data-testid={info.key || `info${index}`}
                        key={index}>
                        <EntitySummaryDetails
                          currentOwner={database?.owner}
                          data={info}
                          tier={getTierTags(database?.tags ?? [])}
                          updateOwner={
                            databasePermission.EditOwner ||
                            databasePermission.EditAll
                              ? handleUpdateOwner
                              : undefined
                          }
                          updateTier={
                            databasePermission.EditTags ||
                            databasePermission.EditAll
                              ? handleUpdateTier
                              : undefined
                          }
                        />
                        {extraInfo.length !== 1 &&
                        index < extraInfo.length - 1 ? (
                          <span className="tw-mx-1.5 tw-inline-block tw-text-gray-400">
                            {t('label.pipe-symbol')}
                          </span>
                        ) : null}
                      </span>
                    ))}
                  </Space>
                </Col>
                <Col className="m-t-xs" span={24}>
                  <Space
                    wrap
                    align="center"
                    data-testid="entity-tags"
                    size={6}
                    onClick={() => {
                      if (isTagEditable) {
                        // Fetch tags and terms only once
                        if (tagList.length === 0) {
                          fetchTags();
                        }
                        setIsEditable(true);
                      }
                    }}>
                    {!deleted && (
                      <TagsContainer
                        className="w-min-20"
                        dropDownHorzPosRight={false}
                        editable={isEditable}
                        isLoading={isTagLoading}
                        selectedTags={selectedTags}
                        showAddTagButton={
                          isTagEditable && isEmpty(selectedTags)
                        }
                        showEditTagButton={isTagEditable}
                        size="small"
                        tagList={tagList}
                        onCancel={() => {
                          handleTagSelection();
                        }}
                        onSelectionChange={(tags) => {
                          handleTagSelection(tags);
                        }}
                      />
                    )}
                  </Space>
                </Col>
              </Col>
            )}

            <Col span={24}>
              <Row className="m-t-md">
                <Col span={24}>
                  <Tabs
                    activeKey={activeTab ?? EntityTabs.SCHEMA}
                    items={tabs}
                    onChange={activeTabHandler}
                  />
                </Col>
                <Col className="p-y-md" span={24}>
                  {activeTab === EntityTabs.SCHEMA && (
                    <>
                      <Row gutter={[16, 16]}>
                        <Col data-testid="description-container" span={24}>
                          <DescriptionV1
                            description={description}
                            entityFieldThreads={getEntityFieldThreadCounts(
                              EntityField.DESCRIPTION,
                              entityFieldThreadCount
                            )}
                            entityFqn={databaseFQN}
                            entityName={databaseName}
                            entityType={EntityType.DATABASE}
                            hasEditAccess={
                              databasePermission.EditDescription ||
                              databasePermission.EditAll
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
                                checked={showDeletedSchemas}
                                data-testid="show-deleted"
                                onClick={setShowDeletedSchemas}
                              />
                              <Typography.Text className="m-l-xs">
                                {t('label.deleted')}
                              </Typography.Text>{' '}
                            </Col>
                          </Row>
                        </Col>
                        {databaseTable}
                      </Row>
                    </>
                  )}
                  {activeTab === EntityTabs.ACTIVITY_FEED && (
                    <ActivityFeedProvider>
                      <ActivityFeedTab
                        entityType={EntityType.DATABASE}
                        fqn={database?.fullyQualifiedName ?? ''}
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
      ) : (
        <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />
      )}
    </>
  );
};

export default observer(DatabaseDetails);
