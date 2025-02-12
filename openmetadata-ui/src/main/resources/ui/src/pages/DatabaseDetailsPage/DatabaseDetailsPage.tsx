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

import { Col, Row, Tabs } from 'antd';
import { AxiosError } from 'axios';
import { compare, Operation } from 'fast-json-patch';
import { isEmpty, isUndefined, toString } from 'lodash';
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
import { useHistory, useParams } from 'react-router-dom';
import { useActivityFeedProvider } from '../../components/ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import ActivityThreadPanel from '../../components/ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import { withActivityFeed } from '../../components/AppRouter/withActivityFeed';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import { DataAssetsHeader } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import ProfilerSettings from '../../components/Database/Profiler/ProfilerSettings/ProfilerSettings';
import { QueryVote } from '../../components/Database/TableQueries/TableQueries.interface';
import { EntityName } from '../../components/Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import {
  getEntityDetailsPath,
  getExplorePath,
  getVersionPath,
  ROUTES,
} from '../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../constants/entity.constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../enums/Axios.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import {
  EntityTabs,
  EntityType,
  TabSpecificField,
} from '../../enums/entity.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Tag } from '../../generated/entity/classification/tag';
import { Database } from '../../generated/entity/data/database';
import { Page } from '../../generated/system/ui/page';
import { PageType } from '../../generated/system/ui/uiCustomization';
import { Include } from '../../generated/type/include';
import { useLocationSearch } from '../../hooks/LocationSearch/useLocationSearch';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useFqn } from '../../hooks/useFqn';
import { FeedCounts } from '../../interface/feed.interface';
import {
  getDatabaseDetailsByFQN,
  getDatabaseSchemas,
  patchDatabaseDetails,
  restoreDatabase,
  updateDatabaseVotes,
} from '../../rest/databaseAPI';
import { getDocumentByFQN } from '../../rest/DocStoreAPI';
import { postThread } from '../../rest/feedsAPI';
import {
  getEntityMissingError,
  getFeedCounts,
  sortTagsCaseInsensitive,
} from '../../utils/CommonUtils';
import { getQueryFilterForDatabase } from '../../utils/Database/Database.util';
import databaseClassBase from '../../utils/Database/DatabaseClassBase';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';
import { getEntityName } from '../../utils/EntityUtils';
import {
  getGlossaryTermDetailTabs,
  getTabLabelMap,
} from '../../utils/GlossaryTerm/GlossaryTermUtil';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getTagsWithoutTier, getTierTags } from '../../utils/TableUtils';
import { createTagObject, updateTierTag } from '../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

const DatabaseDetails: FunctionComponent = () => {
  const { t } = useTranslation();
  const { postFeed, deleteFeed, updateFeed } = useActivityFeedProvider();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { withinPageSearch } =
    useLocationSearch<{ withinPageSearch: string }>();
  const { selectedPersona } = useApplicationStore();

  const { tab: activeTab = EntityTabs.SCHEMA } =
    useParams<{ tab: EntityTabs }>();
  const { fqn: decodedDatabaseFQN } = useFqn();
  const [isLoading, setIsLoading] = useState(true);
  const [customizedPage, setCustomizedPage] = useState<Page | null>(null);

  const [database, setDatabase] = useState<Database>({} as Database);
  const [serviceType, setServiceType] = useState<string>();

  const [databaseName, setDatabaseName] = useState<string>(
    decodedDatabaseFQN.split(FQN_SEPARATOR_CHAR).slice(-1).pop() ?? ''
  );
  const [isDatabaseDetailsLoading, setIsDatabaseDetailsLoading] =
    useState<boolean>(true);
  const [description, setDescription] = useState('');
  const [databaseId, setDatabaseId] = useState('');

  const [schemaInstanceCount, setSchemaInstanceCount] = useState<number>(0);

  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );

  const [threadLink, setThreadLink] = useState<string>('');

  const [updateProfilerSetting, setUpdateProfilerSetting] =
    useState<boolean>(false);

  const history = useHistory();
  const isMounting = useRef(true);

  const { version: currentVersion, deleted } = useMemo(
    () => database,
    [database]
  );

  const tier = getTierTags(database?.tags ?? []);
  const tags = getTagsWithoutTier(database?.tags ?? []);

  const [databasePermission, setDatabasePermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const extraDropdownContent = useMemo(
    () =>
      entityUtilClassBase.getManageExtraOptions(
        EntityType.DATABASE,
        decodedDatabaseFQN,
        databasePermission
      ),
    [decodedDatabaseFQN, databasePermission]
  );
  const fetchDatabasePermission = async () => {
    setIsLoading(true);
    try {
      const response = await getEntityPermissionByFqn(
        ResourceEntity.DATABASE,
        decodedDatabaseFQN
      );
      setDatabasePermission(response);
    } catch (error) {
      // Error
    } finally {
      setIsLoading(false);
    }
  };

  const onThreadLinkSelect = (link: string) => {
    setThreadLink(link);
  };

  const onThreadPanelClose = () => {
    setThreadLink('');
  };

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = () => {
    getFeedCounts(EntityType.DATABASE, decodedDatabaseFQN, handleFeedCount);
  };

  const fetchDatabaseSchemaCount = useCallback(async () => {
    if (isEmpty(decodedDatabaseFQN)) {
      return;
    }

    try {
      setIsLoading(true);
      const { paging } = await getDatabaseSchemas({
        databaseName: decodedDatabaseFQN,
        limit: 0,
      });

      setSchemaInstanceCount(paging.total);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, [decodedDatabaseFQN]);

  const getDetailsByFQN = () => {
    setIsDatabaseDetailsLoading(true);
    getDatabaseDetailsByFQN(decodedDatabaseFQN, {
      fields: `${TabSpecificField.OWNERS},${TabSpecificField.TAGS},${TabSpecificField.DOMAIN},${TabSpecificField.VOTES},${TabSpecificField.EXTENSION},${TabSpecificField.DATA_PRODUCTS}`,
      include: Include.All,
    })
      .then((res) => {
        if (res) {
          const { description, id, name, serviceType } = res;
          setDatabase(res);
          setDescription(description ?? '');
          setDatabaseId(id ?? '');
          setDatabaseName(name);
          setServiceType(serviceType);
        }
      })
      .catch((error) => {
        // Error
        if (
          (error as AxiosError)?.response?.status === ClientErrors.FORBIDDEN
        ) {
          history.replace(ROUTES.FORBIDDEN);
        }
      })
      .finally(() => {
        setIsLoading(false);
        setIsDatabaseDetailsLoading(false);
      });
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
        } else {
          throw t('server.unexpected-response');
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    }
  };

  const activeTabHandler = (key: string) => {
    if (key !== activeTab) {
      history.push({
        pathname: getEntityDetailsPath(
          EntityType.DATABASE,
          decodedDatabaseFQN,
          key
        ),
      });
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
    async (owners: Database['owners']) => {
      const updatedData = {
        ...database,
        owners,
      };

      await settingsUpdateHandler(updatedData as Database);
    },
    [database, database?.owners, settingsUpdateHandler]
  );

  const createThread = async (data: CreateThread) => {
    try {
      await postThread(data);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.create-entity-error', {
          entity: t('label.conversation-lowercase'),
        })
      );
    }
  };

  useEffect(() => {
    getEntityFeedCount();
  }, []);

  useEffect(() => {
    if (withinPageSearch && serviceType) {
      history.push(
        getExplorePath({
          search: withinPageSearch,
          isPersistFilters: false,
          extraParameters: {
            quickFilter: getQueryFilterForDatabase(serviceType, databaseName),
          },
        })
      );
    }
  }, [withinPageSearch]);

  useEffect(() => {
    if (databasePermission.ViewAll || databasePermission.ViewBasic) {
      getDetailsByFQN();
      fetchDatabaseSchemaCount();
    } else {
      setIsDatabaseDetailsLoading(false);
    }
  }, [databasePermission, decodedDatabaseFQN]);

  useEffect(() => {
    fetchDatabasePermission();
  }, [decodedDatabaseFQN]);

  // always Keep this useEffect at the end...
  useEffect(() => {
    isMounting.current = false;
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

  const handleToggleDelete = (version?: number) => {
    setDatabase((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        deleted: !prev?.deleted,
        ...(version ? { version } : {}),
      };
    });
  };

  const handleRestoreDatabase = useCallback(async () => {
    try {
      const { version: newVersion } = await restoreDatabase(databaseId);
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.database'),
        }),
        2000
      );
      handleToggleDelete(newVersion);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.database'),
        })
      );
    }
  }, [databaseId]);

  const versionHandler = useCallback(() => {
    currentVersion &&
      history.push(
        getVersionPath(
          EntityType.DATABASE,
          decodedDatabaseFQN,
          toString(currentVersion),
          EntityTabs.SCHEMA
        )
      );
  }, [currentVersion, decodedDatabaseFQN]);

  const {
    editTagsPermission,
    editGlossaryTermsPermission,
    editDescriptionPermission,
    editCustomAttributePermission,
    viewAllPermission,
  } = useMemo(
    () => ({
      editTagsPermission:
        (databasePermission.EditTags || databasePermission.EditAll) &&
        !database.deleted,
      editGlossaryTermsPermission:
        (databasePermission.EditGlossaryTerms || databasePermission.EditAll) &&
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
    (isSoftDelete?: boolean, version?: number) =>
      isSoftDelete ? handleToggleDelete(version) : history.push('/'),
    []
  );

  const afterDomainUpdateAction = useCallback((data) => {
    const updatedData = data as Database;

    setDatabase((data) => ({
      ...(data ?? updatedData),
      version: updatedData.version,
    }));
  }, []);

  const tabs = useMemo(() => {
    const tabLabelMap = getTabLabelMap(customizedPage?.tabs);

    const tabs = databaseClassBase.getDatabaseDetailPageTabs({
      activeTab,
      database,
      description,
      editDescriptionPermission,
      editGlossaryTermsPermission,
      editTagsPermission,
      viewAllPermission,
      tags,
      schemaInstanceCount,
      feedCount,
      handleFeedCount,
      getEntityFeedCount,
      onDescriptionUpdate,
      onThreadLinkSelect,
      handleTagSelection,
      settingsUpdateHandler,
      deleted: database.deleted ?? false,
      editCustomAttributePermission,
      getDetailsByFQN,
      labelMap: tabLabelMap,
    });

    return getGlossaryTermDetailTabs(
      tabs,
      customizedPage?.tabs,
      EntityTabs.CHILDREN
    );
  }, [
    tags,
    database,
    description,
    databaseName,
    decodedDatabaseFQN,
    activeTab,
    databasePermission,
    schemaInstanceCount,
    feedCount.totalCount,
    editTagsPermission,
    editGlossaryTermsPermission,
    editDescriptionPermission,
    editCustomAttributePermission,
    viewAllPermission,
    deleted,
    handleFeedCount,
    customizedPage?.tabs,
  ]);

  const updateVote = async (data: QueryVote, id: string) => {
    try {
      await updateDatabaseVotes(id, data);
      const details = await getDatabaseDetailsByFQN(decodedDatabaseFQN, {
        fields: [
          TabSpecificField.OWNERS,
          TabSpecificField.TAGS,
          TabSpecificField.VOTES,
        ],
        include: Include.All,
      });
      setDatabase(details);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchDocument = useCallback(async () => {
    const pageFQN = `${EntityType.PERSONA}${FQN_SEPARATOR_CHAR}${selectedPersona.fullyQualifiedName}`;
    try {
      const doc = await getDocumentByFQN(pageFQN);
      setCustomizedPage(
        doc.data?.pages?.find((p: Page) => p.pageType === PageType.Database)
      );
    } catch (error) {
      // fail silent
    }
  }, [selectedPersona.fullyQualifiedName]);

  useEffect(() => {
    if (selectedPersona?.fullyQualifiedName) {
      fetchDocument();
    }
  }, [selectedPersona]);

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
              extraDropdownContent={extraDropdownContent}
              openTaskCount={feedCount.openTaskCount}
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

export default withActivityFeed(DatabaseDetails);
