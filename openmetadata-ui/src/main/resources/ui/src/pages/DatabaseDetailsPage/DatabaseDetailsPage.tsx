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

import { Col, Row, Space, Switch, Tabs, Typography } from 'antd';
import { AxiosError } from 'axios';
import { compare, Operation } from 'fast-json-patch';
import { isEmpty, isString, isUndefined, toString } from 'lodash';
import { observer } from 'mobx-react';
import { EntityTags } from 'Models';
import QueryString from 'qs';
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { default as appState } from '../../AppState';
import { useActivityFeedProvider } from '../../components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { ActivityFeedTab } from '../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.component';
import ActivityThreadPanel from '../../components/ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import { withActivityFeed } from '../../components/AppRouter/withActivityFeed';
import { CustomPropertyTable } from '../../components/common/CustomPropertyTable/CustomPropertyTable';
import DescriptionV1 from '../../components/common/EntityDescription/DescriptionV1';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import Searchbar from '../../components/common/SearchBarComponent/SearchBar.component';
import { DataAssetsHeader } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import DataProductsContainer from '../../components/DataProductsContainer/DataProductsContainer.component';
import Loader from '../../components/Loader/Loader';
import { EntityName } from '../../components/Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { usePermissionProvider } from '../../components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../components/PermissionProvider/PermissionProvider.interface';
import ProfilerSettings from '../../components/ProfilerSettings/ProfilerSettings';
import { QueryVote } from '../../components/TableQueries/TableQueries.interface';
import TabsLabel from '../../components/TabsLabel/TabsLabel.component';
import TagsContainerV2 from '../../components/Tag/TagsContainerV2/TagsContainerV2';
import { DisplayType } from '../../components/Tag/TagsViewer/TagsViewer.interface';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import {
  getDatabaseDetailsPath,
  getExplorePath,
  getVersionPathWithTab,
  INITIAL_PAGING_VALUE,
  PAGE_SIZE,
  pagingObject,
} from '../../constants/constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Tag } from '../../generated/entity/classification/tag';
import { Database } from '../../generated/entity/data/database';
import { DatabaseSchema } from '../../generated/entity/data/databaseSchema';
import { Include } from '../../generated/type/include';
import { Paging } from '../../generated/type/paging';
import { TagSource } from '../../generated/type/tagLabel';
import { EntityFieldThreadCount } from '../../interface/feed.interface';
import {
  getDatabaseDetailsByFQN,
  getDatabaseSchemas,
  patchDatabaseDetails,
  restoreDatabase,
  updateDatabaseVotes,
} from '../../rest/databaseAPI';
import { getFeedCount, postThread } from '../../rest/feedsAPI';
import { searchQuery } from '../../rest/searchAPI';
import {
  getEntityMissingError,
  sortTagsCaseInsensitive,
} from '../../utils/CommonUtils';
import { getDatabaseSchemaTable } from '../../utils/DatabaseDetails.utils';
import { getEntityFeedLink, getEntityName } from '../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getDecodedFqn } from '../../utils/StringsUtils';
import { getTagsWithoutTier, getTierTags } from '../../utils/TableUtils';
import { createTagObject, updateTierTag } from '../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

const DatabaseDetails: FunctionComponent = () => {
  const { t } = useTranslation();
  const { postFeed, deleteFeed, updateFeed } = useActivityFeedProvider();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const searchValue = useMemo(() => {
    const param = location.search;
    const searchData = QueryString.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    return searchData.schema as string | undefined;
  }, [location.search]);

  const { fqn: databaseFQN, tab: activeTab = EntityTabs.SCHEMA } =
    useParams<{ fqn: string; tab: EntityTabs }>();
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

  const [feedCount, setFeedCount] = useState<number>(0);
  const [entityFieldThreadCount, setEntityFieldThreadCount] = useState<
    EntityFieldThreadCount[]
  >([]);

  const [threadLink, setThreadLink] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(INITIAL_PAGING_VALUE);

  const [updateProfilerSetting, setUpdateProfilerSetting] =
    useState<boolean>(false);

  const history = useHistory();
  const isMounting = useRef(true);

  const { version: currentVersion } = useMemo(() => database, [database]);

  const tier = getTierTags(database?.tags ?? []);
  const tags = getTagsWithoutTier(database?.tags ?? []);

  const [databasePermission, setDatabasePermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const decodedDatabaseFQN = useMemo(
    () => getDecodedFqn(databaseFQN),
    [databaseFQN]
  );

  const fetchDatabasePermission = async () => {
    setIsLoading(true);
    try {
      const response = await getEntityPermissionByFqn(
        ResourceEntity.DATABASE,
        databaseFQN
      );
      setDatabasePermission(response);
    } catch (error) {
      // Error
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDatabaseSchemas = async (pagingObj?: string) => {
    try {
      const response = await getDatabaseSchemas(
        databaseFQN,
        pagingObj,
        ['owner', 'usageSummary'],
        showDeletedSchemas ? Include.Deleted : Include.NonDeleted
      );
      if (response.data) {
        setSchemaData(response.data);
        setSchemaPaging(response.paging);
        setSchemaInstanceCount(response.paging.total);
      } else {
        setSchemaData([]);
        setSchemaPaging(pagingObject);

        throw t('server.unexpected-response');
      }
    } finally {
      setSchemaDataLoading(false);
    }
  };

  const searchSchema = async (
    searchValue: string,
    pageNumber = INITIAL_PAGING_VALUE
  ) => {
    setSchemaDataLoading(true);
    try {
      const response = await searchQuery({
        query: `*${searchValue}*`,
        pageNumber,
        pageSize: PAGE_SIZE,
        queryFilter: {
          query: {
            bool: {
              must: [{ term: { 'database.fullyQualifiedName': databaseFQN } }],
            },
          },
        },
        searchIndex: SearchIndex.DATABASE_SCHEMA,
        includeDeleted: showDeletedSchemas,
        trackTotalHits: true,
      });
      const data = response.hits.hits.map((schema) => schema._source);
      const total = response.hits.total.value;
      setSchemaData(data);
      setSchemaPaging({ total });
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setSchemaDataLoading(false);
    }
  };

  const fetchDatabaseSchemasAndDBTModels = () => {
    setIsLoading(true);
    Promise.allSettled([
      searchValue ? searchSchema(searchValue) : fetchDatabaseSchemas(),
    ]).finally(() => {
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
    getFeedCount(getEntityFeedLink(EntityType.DATABASE, decodedDatabaseFQN))
      .then((res) => {
        if (res) {
          setFeedCount(res.totalCount);
          setEntityFieldThreadCount(res.counts);
        } else {
          throw t('server.unexpected-response');
        }
      })
      .catch(() => {
        // Error
      });
  };

  const getDetailsByFQN = () => {
    setIsDatabaseDetailsLoading(true);
    getDatabaseDetailsByFQN(
      databaseFQN,
      ['owner', 'tags', 'domain', 'votes'],
      Include.All
    )
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
        }
      })
      .catch(() => {
        // Error
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
          setDatabase(response);
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
        pathname: getDatabaseDetailsPath(decodedDatabaseFQN, key),
      });
    }
  };

  const databaseSchemaPagingHandler = ({
    cursorType,
    currentPage,
  }: PagingHandlerParams) => {
    if (cursorType) {
      if (isString(cursorType)) {
        const pagingString = `&${cursorType}=${
          databaseSchemaPaging[cursorType as keyof typeof databaseSchemaPaging]
        }`;
        setSchemaDataLoading(true);
        fetchDatabaseSchemas(pagingString).finally(() => {
          setSchemaDataLoading(false);
        });
        setCurrentPage(currentPage);
      } else {
        setCurrentPage(cursorType);
        searchValue && searchSchema(searchValue, cursorType);
      }
    }
  };

  const settingsUpdateHandler = async (
    data: Database,
    key?: keyof Database
  ) => {
    try {
      const res = await saveUpdatedDatabaseData(data);

      setDatabase(() => {
        if (key === 'tags') {
          return { ...res, tags: sortTagsCaseInsensitive(res.tags ?? []) };
        }

        return res;
      });
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

  const handleUpdateTier = useCallback(
    (newTier?: Tag) => {
      const tierTag = updateTierTag(database?.tags ?? [], newTier);
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
      await settingsUpdateHandler(updatedTable as Database, 'tags');
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
      const newTags = createTagObject(
        selectedTags.filter((tag) => {
          return !prevTags
            ?.map((prevTag) => prevTag.tagFQN)
            .includes(tag.tagFQN);
        })
      );
      await onTagUpdate([...prevTags, ...newTags]);
    }
  };

  const databaseTable = useMemo(
    () =>
      getDatabaseSchemaTable(
        schemaData,
        schemaDataLoading,
        databaseSchemaPaging,
        currentPage,
        databaseSchemaPagingHandler,
        Boolean(searchSchema)
      ),
    [
      schemaData,
      schemaDataLoading,
      databaseSchemaPaging,
      currentPage,
      databaseSchemaPagingHandler,
      searchSchema,
    ]
  );

  const handleToggleDelete = () => {
    setDatabase((prev) => {
      if (!prev) {
        return prev;
      }

      return { ...prev, deleted: !prev?.deleted };
    });
  };

  const handleRestoreDatabase = useCallback(async () => {
    try {
      await restoreDatabase(databaseId);
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.database'),
        }),
        2000
      );
      handleToggleDelete();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.database'),
        })
      );
    }
  }, [databaseId]);

  const handleShowDeletedSchemas = useCallback((value: boolean) => {
    setShowDeletedSchemas(value);
    setCurrentPage(INITIAL_PAGING_VALUE);
  }, []);

  const versionHandler = useCallback(() => {
    currentVersion &&
      history.push(
        getVersionPathWithTab(
          EntityType.DATABASE,
          databaseFQN,
          toString(currentVersion),
          EntityTabs.SCHEMA
        )
      );
  }, [currentVersion, databaseFQN]);

  const {
    editTagsPermission,
    editDescriptionPermission,
    editCustomAttributePermission,
    viewAllPermission,
  } = useMemo(
    () => ({
      editTagsPermission:
        (databasePermission.EditTags || databasePermission.EditAll) &&
        !database.deleted,
      editDescriptionPermission:
        (databasePermission.EditDescription || databasePermission.EditAll) &&
        !database.deleted,
      editCustomAttributePermission:
        (databasePermission.EditAll || databasePermission.EditCustomFields) &&
        !database.deleted,
      viewAllPermission: databasePermission.ViewAll,
    }),
    [databasePermission, database]
  );

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean) =>
      isSoftDelete ? handleToggleDelete() : history.push('/'),
    []
  );

  const afterDomainUpdateAction = useCallback((data) => {
    const updatedData = data as Database;

    setDatabase((data) => ({
      ...(data ?? updatedData),
      version: updatedData.version,
    }));
  }, []);

  const onSchemaSearch = (value: string) => {
    history.push({
      search: QueryString.stringify({
        schema: isEmpty(value) ? undefined : value,
      }),
    });
    if (value) {
      searchSchema(value);
    } else {
      fetchDatabaseSchemas();
    }
  };

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
                    entityFqn={decodedDatabaseFQN}
                    entityName={databaseName}
                    entityType={EntityType.DATABASE}
                    hasEditAccess={editDescriptionPermission}
                    isEdit={isEdit}
                    showActions={!database.deleted}
                    onCancel={onCancel}
                    onDescriptionEdit={onDescriptionEdit}
                    onDescriptionUpdate={onDescriptionUpdate}
                    onThreadLinkSelect={onThreadLinkSelect}
                  />
                </Col>
                <Col span={24}>
                  <Row>
                    <Col span={12}>
                      <Searchbar
                        removeMargin
                        placeholder={t('label.search-for-type', {
                          type: t('label.schema'),
                        })}
                        searchValue={searchValue}
                        typingInterval={500}
                        onSearch={onSchemaSearch}
                      />
                    </Col>
                    <Col className="flex items-center justify-end" span={12}>
                      <Switch
                        checked={showDeletedSchemas}
                        data-testid="show-deleted"
                        onClick={handleShowDeletedSchemas}
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
                <DataProductsContainer
                  activeDomain={database?.domain}
                  dataProducts={database?.dataProducts ?? []}
                  hasPermission={false}
                />
                <TagsContainerV2
                  displayType={DisplayType.READ_MORE}
                  entityFqn={decodedDatabaseFQN}
                  entityType={EntityType.DATABASE}
                  permission={editTagsPermission}
                  selectedTags={tags}
                  tagType={TagSource.Classification}
                  onSelectionChange={handleTagSelection}
                  onThreadLinkSelect={onThreadLinkSelect}
                />
                <TagsContainerV2
                  displayType={DisplayType.READ_MORE}
                  entityFqn={decodedDatabaseFQN}
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
          <ActivityFeedTab
            entityType={EntityType.DATABASE}
            fqn={database?.fullyQualifiedName ?? ''}
            onFeedUpdate={getEntityFeedCount}
            onUpdateEntityDetails={getDetailsByFQN}
          />
        ),
      },

      {
        label: (
          <TabsLabel
            id={EntityTabs.CUSTOM_PROPERTIES}
            name={t('label.custom-property-plural')}
          />
        ),
        key: EntityTabs.CUSTOM_PROPERTIES,
        children: (
          <CustomPropertyTable
            entityType={EntityType.DATABASE}
            handleExtensionUpdate={settingsUpdateHandler}
            hasEditAccess={editCustomAttributePermission}
            hasPermission={viewAllPermission}
            isVersionView={false}
          />
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
      decodedDatabaseFQN,
      activeTab,
      databaseTable,
      databasePermission,
      databaseSchemaInstanceCount,
      feedCount,
      showDeletedSchemas,
      editTagsPermission,
      editDescriptionPermission,
      editCustomAttributePermission,
      viewAllPermission,
      handleShowDeletedSchemas,
    ]
  );

  const updateVote = async (data: QueryVote, id: string) => {
    try {
      await updateDatabaseVotes(id, data);
      const details = await getDatabaseDetailsByFQN(
        databaseFQN,
        ['owner', 'tags', 'votes'],
        Include.All
      );
      setDatabase(details);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  useEffect(() => {
    fetchDatabaseSchemas();
  }, [showDeletedSchemas]);

  if (isLoading || isDatabaseDetailsLoading) {
    return <Loader />;
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
      {isEmpty(database) ? (
        <ErrorPlaceHolder className="m-0">
          {getEntityMissingError(EntityType.DATABASE, decodedDatabaseFQN)}
        </ErrorPlaceHolder>
      ) : (
        <Row gutter={[0, 12]}>
          <Col className="p-x-lg" span={24}>
            <DataAssetsHeader
              isRecursiveDelete
              afterDeleteAction={afterDeleteAction}
              afterDomainUpdateAction={afterDomainUpdateAction}
              dataAsset={database}
              entityType={EntityType.DATABASE}
              permissions={databasePermission}
              onDisplayNameUpdate={handleUpdateDisplayName}
              onOwnerUpdate={handleUpdateOwner}
              onProfilerSettingUpdate={() => setUpdateProfilerSetting(true)}
              onRestoreDataAsset={handleRestoreDatabase}
              onTierUpdate={handleUpdateTier}
              onUpdateVote={updateVote}
              onVersionClick={versionHandler}
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
          {updateProfilerSetting && (
            <ProfilerSettings
              entityId={database.id ?? ''}
              entityType={EntityType.DATABASE}
              visible={updateProfilerSetting}
              onVisibilityChange={(value) => setUpdateProfilerSetting(value)}
            />
          )}
        </Row>
      )}
    </PageLayoutV1>
  );
};

export default observer(withActivityFeed(DatabaseDetails));
