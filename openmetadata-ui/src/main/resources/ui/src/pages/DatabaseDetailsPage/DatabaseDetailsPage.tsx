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
import {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { withActivityFeed } from '../../components/AppRouter/withActivityFeed';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { AlignRightIconButton } from '../../components/common/IconButtons/EditIconButton';
import Loader from '../../components/common/Loader/Loader';
import { GenericProvider } from '../../components/Customization/GenericProvider/GenericProvider';
import { DataAssetsHeader } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import { DataAssetWithDomains } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import ProfilerSettings from '../../components/Database/Profiler/ProfilerSettings/ProfilerSettings';
import { QueryVote } from '../../components/Database/TableQueries/TableQueries.interface';
import { EntityName } from '../../components/Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { ROUTES } from '../../constants/constants';
import { FEED_COUNT_INITIAL_DATA } from '../../constants/entity.constants';
import { GlobalSettingOptions } from '../../constants/GlobalSettings.constants';
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
import { Tag } from '../../generated/entity/classification/tag';
import { Database } from '../../generated/entity/data/database';
import { Operation as PermissionOperation } from '../../generated/entity/policies/accessControl/resourcePermission';
import { PageType } from '../../generated/system/ui/uiCustomization';
import { Include } from '../../generated/type/include';
import { useLocationSearch } from '../../hooks/LocationSearch/useLocationSearch';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useCustomPages } from '../../hooks/useCustomPages';
import { useFqn } from '../../hooks/useFqn';
import { FeedCounts } from '../../interface/feed.interface';
import {
  addFollowers,
  getDatabaseDetailsByFQN,
  getDatabaseSchemas,
  patchDatabaseDetails,
  removeFollowers,
  restoreDatabase,
  updateDatabaseVotes,
} from '../../rest/databaseAPI';
import { getEntityMissingError, getFeedCounts } from '../../utils/CommonUtils';
import {
  checkIfExpandViewSupported,
  getDetailsTabWithNewLabel,
  getTabLabelMapFromTabs,
} from '../../utils/CustomizePage/CustomizePageUtils';
import { getQueryFilterForDatabase } from '../../utils/Database/Database.util';
import databaseClassBase from '../../utils/Database/DatabaseClassBase';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';
import { getEntityName } from '../../utils/EntityUtils';
import {
  DEFAULT_ENTITY_PERMISSION,
  getPrioritizedEditPermission,
  getPrioritizedViewPermission,
} from '../../utils/PermissionsUtils';
import {
  getEntityDetailsPath,
  getExplorePath,
  getVersionPath,
} from '../../utils/RouterUtils';
import { getTierTags } from '../../utils/TableUtils';
import { updateCertificationTag, updateTierTag } from '../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';

const DatabaseDetails: FunctionComponent = () => {
  const { t } = useTranslation();

  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { withinPageSearch } =
    useLocationSearch<{ withinPageSearch: string }>();
  const { tab: activeTab } = useRequiredParams<{ tab: EntityTabs }>();
  const { fqn: decodedDatabaseFQN } = useFqn();
  const [isLoading, setIsLoading] = useState(true);
  const { customizedPage, isLoading: loading } = useCustomPages(
    PageType.Database
  );
  const [database, setDatabase] = useState<Database>({} as Database);
  const [serviceType, setServiceType] = useState<string>();
  const [isDatabaseDetailsLoading, setIsDatabaseDetailsLoading] =
    useState<boolean>(true);
  const [schemaInstanceCount, setSchemaInstanceCount] = useState<number>(0);
  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA
  );
  const [updateProfilerSetting, setUpdateProfilerSetting] =
    useState<boolean>(false);

  const navigate = useNavigate();
  const isMounting = useRef(true);
  const [isTabExpanded, setIsTabExpanded] = useState(false);

  const {
    version: currentVersion,
    deleted,
    id: databaseId,
  } = useMemo(() => database, [database]);

  const { currentUser } = useApplicationStore();
  const USERId = currentUser?.id ?? '';
  const tier = getTierTags(database?.tags ?? []);

  const [databasePermission, setDatabasePermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const extraDropdownContent = useMemo(
    () =>
      entityUtilClassBase.getManageExtraOptions(
        EntityType.DATABASE,
        decodedDatabaseFQN,
        databasePermission,
        database,
        navigate
      ),
    [decodedDatabaseFQN, databasePermission, database]
  );
  const fetchDatabasePermission = async () => {
    setIsLoading(true);
    try {
      const response = await getEntityPermissionByFqn(
        ResourceEntity.DATABASE,
        decodedDatabaseFQN
      );
      setDatabasePermission(response);
    } catch {
      // Error
    } finally {
      setIsLoading(false);
    }
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
      fields: [
        TabSpecificField.OWNERS,
        TabSpecificField.TAGS,
        TabSpecificField.DOMAIN,
        TabSpecificField.VOTES,
        TabSpecificField.EXTENSION,
        TabSpecificField.DATA_PRODUCTS,
        TabSpecificField.FOLLOWERS,
      ].join(','),
      include: Include.All,
    })
      .then((res) => {
        if (res) {
          const { serviceType } = res;
          setDatabase(res);
          setServiceType(serviceType);
        }
      })
      .catch((error) => {
        // Error
        if (
          (error as AxiosError)?.response?.status === ClientErrors.FORBIDDEN
        ) {
          navigate(ROUTES.FORBIDDEN, { replace: true });
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

    return patchDatabaseDetails(database.id ?? '', jsonPatch);
  };

  const activeTabHandler = (key: string) => {
    if (key !== activeTab) {
      navigate(
        {
          pathname: getEntityDetailsPath(
            EntityType.DATABASE,
            decodedDatabaseFQN,
            key
          ),
        },
        { replace: true }
      );
    }
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
    async (owners: Database['owners']) => {
      const updatedData = {
        ...database,
        owners,
      };

      await settingsUpdateHandler(updatedData as Database);
    },
    [database, database?.owners, settingsUpdateHandler]
  );

  useEffect(() => {
    getEntityFeedCount();
  }, []);

  useEffect(() => {
    if (withinPageSearch && serviceType) {
      navigate(
        getExplorePath({
          search: withinPageSearch,
          isPersistFilters: false,
          extraParameters: {
            quickFilter: getQueryFilterForDatabase(serviceType, database.name),
          },
        }),
        { replace: true }
      );
    }
  }, [withinPageSearch]);

  useEffect(() => {
    if (
      getPrioritizedViewPermission(
        databasePermission,
        PermissionOperation.ViewBasic
      )
    ) {
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

  const { isFollowing, followers = [] } = useMemo(
    () => ({
      isFollowing: database?.followers?.some(
        ({ id }) => id === currentUser?.id
      ),
      followers: database?.followers ?? [],
    }),
    [database, currentUser]
  );
  const handleRestoreDatabase = useCallback(async () => {
    try {
      const { version: newVersion } = await restoreDatabase(database.id ?? '');
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.database'),
        })
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
  }, [database.id]);

  const versionHandler = useCallback(() => {
    currentVersion &&
      navigate(
        getVersionPath(
          EntityType.DATABASE,
          decodedDatabaseFQN,
          toString(currentVersion),
          EntityTabs.SCHEMA
        )
      );
  }, [currentVersion, decodedDatabaseFQN]);

  const { editCustomAttributePermission, viewAllPermission } = useMemo(
    () => ({
      editCustomAttributePermission:
        getPrioritizedEditPermission(
          databasePermission,
          PermissionOperation.EditCustomFields
        ) && !database.deleted,
      viewAllPermission: databasePermission.ViewAll,
    }),
    [databasePermission, database, getPrioritizedEditPermission]
  );

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean) => !isSoftDelete && navigate('/'),
    []
  );

  const afterDomainUpdateAction = useCallback((data: DataAssetWithDomains) => {
    const updatedData = data as Database;

    setDatabase((data) => ({
      ...(updatedData ?? data),
      version: updatedData.version,
    }));
  }, []);

  const tabs = useMemo(() => {
    const tabLabelMap = getTabLabelMapFromTabs(customizedPage?.tabs);

    const tabs = databaseClassBase.getDatabaseDetailPageTabs({
      activeTab: activeTab as EntityTabs,
      database,
      viewAllPermission,
      schemaInstanceCount,
      feedCount,
      handleFeedCount,
      getEntityFeedCount,
      deleted: database.deleted ?? false,
      editCustomAttributePermission,
      getDetailsByFQN,
      labelMap: tabLabelMap,
    });

    return getDetailsTabWithNewLabel(
      tabs,
      customizedPage?.tabs,
      EntityTabs.SCHEMAS
    );
  }, [
    activeTab,
    database,
    schemaInstanceCount,
    feedCount.totalCount,
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
  const followDatabase = useCallback(async () => {
    try {
      const res = await addFollowers(
        databaseId,
        USERId ?? '',
        GlobalSettingOptions.DATABASES
      );
      const { newValue } = res.changeDescription.fieldsAdded[0];
      const newFollowers = [...(followers ?? []), ...newValue];
      setDatabase((prev) => {
        if (!prev) {
          return prev;
        }

        return { ...prev, followers: newFollowers };
      });
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-follow-error', {
          entity: getEntityName(database),
        })
      );
    }
  }, [USERId, databaseId]);
  const unfollowDatabase = useCallback(async () => {
    try {
      const res = await removeFollowers(
        databaseId,
        USERId,
        GlobalSettingOptions.DATABASES
      );
      const { oldValue } = res.changeDescription.fieldsDeleted[0];
      setDatabase((pre) => {
        if (!pre) {
          return pre;
        }

        return {
          ...pre,
          followers: pre.followers?.filter(
            (follower) => follower.id !== oldValue[0].id
          ),
        };
      });
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-unfollow-error', {
          entity: getEntityName(database),
        })
      );
    }
  }, [USERId, database]);

  const handleFollowClick = useCallback(async () => {
    isFollowing ? await unfollowDatabase() : await followDatabase();
  }, [isFollowing, unfollowDatabase, followDatabase]);

  const toggleTabExpanded = () => {
    setIsTabExpanded(!isTabExpanded);
  };
  const onCertificationUpdate = useCallback(
    async (newCertification?: Tag) => {
      if (database) {
        const certificationTag: Database['certification'] =
          updateCertificationTag(newCertification);
        const updatedTableDetails = {
          ...database,
          certification: certificationTag,
        };

        await settingsUpdateHandler(updatedTableDetails as Database);
      }
    },
    [settingsUpdateHandler, database]
  );

  const isExpandViewSupported = useMemo(
    () =>
      checkIfExpandViewSupported(
        tabs[0],
        activeTab as EntityTabs,
        PageType.Database
      ),
    [tabs[0], activeTab]
  );

  if (isLoading || isDatabaseDetailsLoading || loading) {
    return <Loader />;
  }

  if (
    !getPrioritizedViewPermission(
      databasePermission,
      PermissionOperation.ViewBasic
    )
  ) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.database'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  return (
    <PageLayoutV1
      pageTitle={t('label.entity-detail-plural', {
        entity: getEntityName(database),
      })}>
      {isEmpty(database) ? (
        <ErrorPlaceHolder className="m-0">
          {getEntityMissingError(EntityType.DATABASE, decodedDatabaseFQN)}
        </ErrorPlaceHolder>
      ) : (
        <Row gutter={[0, 12]}>
          <Col span={24}>
            <DataAssetsHeader
              isRecursiveDelete
              afterDeleteAction={afterDeleteAction}
              afterDomainUpdateAction={afterDomainUpdateAction}
              dataAsset={database}
              entityType={EntityType.DATABASE}
              extraDropdownContent={extraDropdownContent}
              openTaskCount={feedCount.openTaskCount}
              permissions={databasePermission}
              onCertificationUpdate={onCertificationUpdate}
              onDisplayNameUpdate={handleUpdateDisplayName}
              onFollowClick={handleFollowClick}
              onOwnerUpdate={handleUpdateOwner}
              onProfilerSettingUpdate={() => setUpdateProfilerSetting(true)}
              onRestoreDataAsset={handleRestoreDatabase}
              onTierUpdate={handleUpdateTier}
              onUpdateVote={updateVote}
              onVersionClick={versionHandler}
            />
          </Col>
          <GenericProvider<Database>
            customizedPage={customizedPage}
            data={database}
            isTabExpanded={isTabExpanded}
            permissions={databasePermission}
            type={EntityType.DATABASE}
            onUpdate={settingsUpdateHandler}>
            <Col className="entity-details-page-tabs" span={24}>
              <Tabs
                activeKey={activeTab}
                className="tabs-new"
                data-testid="tabs"
                items={tabs}
                tabBarExtraContent={
                  isExpandViewSupported && (
                    <AlignRightIconButton
                      className={isTabExpanded ? 'rotate-180' : ''}
                      title={
                        isTabExpanded ? t('label.collapse') : t('label.expand')
                      }
                      onClick={toggleTabExpanded}
                    />
                  )
                }
                onChange={activeTabHandler}
              />
            </Col>
          </GenericProvider>

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
