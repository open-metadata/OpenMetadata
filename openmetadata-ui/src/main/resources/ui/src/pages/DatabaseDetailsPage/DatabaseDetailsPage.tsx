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

import { Col, Row, Space, Switch, Table, Tabs, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import ActivityFeedProvider, {
  useActivityFeedProvider,
} from 'components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { ActivityFeedTab } from 'components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import ActivityThreadPanel from 'components/ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import DescriptionV1 from 'components/common/description/DescriptionV1';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import NextPrevious from 'components/common/next-previous/NextPrevious';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import { DataAssetsHeader } from 'components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import Loader from 'components/Loader/Loader';
import { EntityName } from 'components/Modals/EntityNameModal/EntityNameModal.interface';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import TabsLabel from 'components/TabsLabel/TabsLabel.component';
import TagsContainerV2 from 'components/Tag/TagsContainerV2/TagsContainerV2';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { compare, Operation } from 'fast-json-patch';
import { LabelType } from 'generated/entity/data/table';
import { Include } from 'generated/type/include';
import { State, TagSource } from 'generated/type/tagLabel';
import { isNil, isUndefined } from 'lodash';
import { observer } from 'mobx-react';
import { EntityTags } from 'Models';
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
  restoreDatabase,
} from 'rest/databaseAPI';
import { getFeedCount, postThread } from 'rest/feedsAPI';
import { default as appState } from '../../AppState';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import {
  getDatabaseDetailsPath,
  getDatabaseSchemaDetailsPath,
  getExplorePath,
  PAGE_SIZE,
  pagingObject,
} from '../../constants/constants';
import { EntityField } from '../../constants/Feeds.constants';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Database } from '../../generated/entity/data/database';
import { DatabaseSchema } from '../../generated/entity/data/databaseSchema';
import { EntityReference } from '../../generated/entity/teams/user';
import { UsageDetails } from '../../generated/type/entityUsage';
import { Paging } from '../../generated/type/paging';
import { EntityFieldThreadCount } from '../../interface/feed.interface';
import {
  getEntityFeedLink,
  getEntityName,
  getEntityThreadLink,
} from '../../utils/EntityUtils';
import { getEntityFieldThreadCounts } from '../../utils/FeedUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getErrorText } from '../../utils/StringsUtils';
import {
  getTagsWithoutTier,
  getTierTags,
  getUsagePercentile,
} from '../../utils/TableUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

const DatabaseDetails: FunctionComponent = () => {
  const { t } = useTranslation();
  const { postFeed, deleteFeed, updateFeed } = useActivityFeedProvider();
  const { getEntityPermissionByFqn } = usePermissionProvider();

  const { databaseFQN, tab: activeTab = EntityTabs.SCHEMA } =
    useParams<{ databaseFQN: string; tab: EntityTabs }>();
  const [isLoading, setIsLoading] = useState(true);
  const [showDeletedSchemas, setShowDeletedSchemas] = useState<boolean>(false);
  const [database, setDatabase] = useState<Database>({} as Database);
  const [serviceType, setServiceType] = useState<string>();
  const [schemaData, setSchemaData] = useState<DatabaseSchema[]>([]);
  const [schemaDataLoading, setSchemaDataLoading] = useState<boolean>(true);

  const [databaseName, setDatabaseName] = useState<string>(
    databaseFQN.split(FQN_SEPARATOR_CHAR).slice(-1).pop() ?? ''
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

  const history = useHistory();
  const isMounting = useRef(true);

  const tier = getTierTags(database?.tags ?? []);
  const tags = getTagsWithoutTier(database?.tags ?? []);

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
    getDatabaseDetailsByFQN(databaseFQN, ['owner', 'tags'], Include.All)
      .then((res) => {
        if (res) {
          const { description, id, name, serviceType } = res;
          setDatabase(res);
          setDescription(description ?? '');
          setDatabaseId(id ?? '');
          setDatabaseName(name);
          setServiceType(serviceType);
          setShowDeletedSchemas(res.deleted ?? false);
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
    async (owner: Database['owner']) => {
      const updatedData = {
        ...database,
        owner: owner ? { ...database?.owner, ...owner } : undefined,
      };

      await settingsUpdateHandler(updatedData as Database);
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
          getUsagePercentile(text?.weeklyStats?.percentileRank ?? 0),
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

  /**
   * Formulates updated tags and updates table entity data for API call
   * @param selectedTags
   */
  const onTagUpdate = async (selectedTags?: Array<EntityTags>) => {
    if (selectedTags) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedTable = { ...database, tags: updatedTags };
      await settingsUpdateHandler(updatedTable as Database);
    }
  };

  const handleTagSelection = async (selectedTags: EntityTags[]) => {
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
      await onTagUpdate([...prevTags, ...newTags]);
    }
  };

  const databaseTable = useMemo(() => {
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
          locale={{
            emptyText: <ErrorPlaceHolder className="m-y-md" />,
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
  }, [
    schemaDataLoading,
    schemaData,
    tableColumn,
    databaseSchemaPaging,
    currentPage,
    databaseSchemaPagingHandler,
  ]);

  const handleRestoreDatabase = useCallback(async () => {
    try {
      await restoreDatabase(databaseId);
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.database'),
        }),
        2000
      );
      getDetailsByFQN();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.database'),
        })
      );
    }
  }, [databaseId]);

  const editTagsPermission = useMemo(
    () =>
      (databasePermission.EditTags || databasePermission.EditAll) &&
      !database.deleted,
    [databasePermission, database]
  );

  const editDescriptionPermission = useMemo(
    () =>
      (databasePermission.EditDescription || databasePermission.EditAll) &&
      !database.deleted,
    [databasePermission, database]
  );

  const tabs = useMemo(
    () => [
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
        children: (
          <Row gutter={[0, 16]} wrap={false}>
            <Col className="p-t-sm m-x-lg" flex="auto">
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
                    hasEditAccess={editDescriptionPermission}
                    isEdit={isEdit}
                    isReadOnly={database.deleted}
                    onCancel={onCancel}
                    onDescriptionEdit={onDescriptionEdit}
                    onDescriptionUpdate={onDescriptionUpdate}
                    onThreadLinkSelect={onThreadLinkSelect}
                  />
                </Col>
                <Col span={24}>
                  <Row justify="end">
                    <Col className="p-x-xss">
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
            </Col>
            <Col
              className="entity-tag-right-panel-container"
              data-testid="entity-right-panel"
              flex="320px">
              <Space className="w-full" direction="vertical" size="large">
                <TagsContainerV2
                  entityFqn={databaseFQN}
                  entityThreadLink={getEntityThreadLink(entityFieldThreadCount)}
                  entityType={EntityType.DATABASE}
                  permission={editTagsPermission}
                  selectedTags={tags}
                  tagType={TagSource.Classification}
                  onSelectionChange={handleTagSelection}
                  onThreadLinkSelect={onThreadLinkSelect}
                />
                <TagsContainerV2
                  entityFqn={databaseFQN}
                  entityThreadLink={getEntityThreadLink(entityFieldThreadCount)}
                  entityType={EntityType.DATABASE}
                  permission={editTagsPermission}
                  selectedTags={tags}
                  tagType={TagSource.Glossary}
                  onSelectionChange={handleTagSelection}
                  onThreadLinkSelect={onThreadLinkSelect}
                />
              </Space>
            </Col>
          </Row>
        ),
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
        children: (
          <ActivityFeedProvider>
            <ActivityFeedTab
              entityType={EntityType.DATABASE}
              fqn={database?.fullyQualifiedName ?? ''}
              onFeedUpdate={getEntityFeedCount}
            />
          </ActivityFeedProvider>
        ),
      },
    ],
    [
      tags,
      isEdit,
      database,
      description,
      databaseName,
      entityFieldThreadCount,
      databaseFQN,
      activeTab,
      databaseTable,
      databasePermission,
      databaseSchemaInstanceCount,
      feedCount,
      showDeletedSchemas,
      editTagsPermission,
      editDescriptionPermission,
    ]
  );

  useEffect(() => {
    fetchDatabaseSchemas();
  }, [showDeletedSchemas]);

  if (isLoading || isDatabaseDetailsLoading) {
    return <Loader />;
  }

  if (error) {
    return (
      <ErrorPlaceHolder>
        <p data-testid="error-message">{error}</p>
      </ErrorPlaceHolder>
    );
  }

  if (!(databasePermission.ViewAll || databasePermission.ViewBasic)) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  return (
    <PageLayoutV1
      className="bg-white"
      pageTitle={t('label.entity-detail-plural', {
        entity: getEntityName(database),
      })}>
      <Row gutter={[0, 12]}>
        <Col className="p-x-lg" span={24}>
          <DataAssetsHeader
            allowSoftDelete
            isRecursiveDelete
            dataAsset={database}
            entityType={EntityType.DATABASE}
            permissions={databasePermission}
            onDisplayNameUpdate={handleUpdateDisplayName}
            onOwnerUpdate={handleUpdateOwner}
            onRestoreDataAsset={handleRestoreDatabase}
            onTierUpdate={handleUpdateTier}
          />
        </Col>
        <Col span={24}>
          <Tabs
            activeKey={activeTab ?? EntityTabs.SCHEMA}
            className="entity-details-page-tabs"
            data-testid="tabs"
            items={tabs}
            onChange={activeTabHandler}
          />
        </Col>

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
      </Row>
    </PageLayoutV1>
  );
};

export default observer(DatabaseDetails);
