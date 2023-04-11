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

import { AxiosError } from 'axios';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import DatasetDetails from 'components/DatasetDetails/DatasetDetails.component';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import { compare, Operation } from 'fast-json-patch';
import { isEmpty, isUndefined } from 'lodash';
import { observer } from 'mobx-react';
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { getAllFeeds, postFeedById, postThread } from 'rest/feedsAPI';
import {
  addFollower,
  getLatestTableProfileByFqn,
  getTableDetailsByFQN,
  patchTableDetails,
  removeFollower,
} from 'rest/tableAPI';
import AppState from '../../AppState';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import {
  getDatabaseDetailsPath,
  getDatabaseSchemaDetailsPath,
  getServiceDetailsPath,
  getTableTabPath,
  getVersionPath,
  pagingObject,
} from '../../constants/constants';
import { NO_PERMISSION_TO_VIEW } from '../../constants/HelperTextUtil';
import { EntityType, FqnPart, TabSpecificField } from '../../enums/entity.enum';
import { FeedFilter } from '../../enums/mydata.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Table, TableData } from '../../generated/entity/data/table';
import { Post, Thread, ThreadType } from '../../generated/entity/feed/thread';
import { Paging } from '../../generated/type/paging';
import { EntityFieldThreadCount } from '../../interface/feed.interface';
import jsonData from '../../jsons/en';
import {
  addToRecentViewed,
  getCurrentUserId,
  getEntityMissingError,
  getFeedCounts,
  getFields,
  getPartialNameFromTableFQN,
} from '../../utils/CommonUtils';
import {
  datasetTableTabs,
  defaultFields,
  getCurrentDatasetTab,
} from '../../utils/DatasetDetailsUtils';
import { getEntityFeedLink, getEntityName } from '../../utils/EntityUtils';
import { deletePost, updateThreadData } from '../../utils/FeedUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const DatasetDetailsPage: FunctionComponent = () => {
  const history = useHistory();
  const { t } = useTranslation();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSampleDataLoading, setIsSampleDataLoading] =
    useState<boolean>(false);
  const [isentityThreadLoading, setIsentityThreadLoading] =
    useState<boolean>(false);
  const [isTableProfileLoading, setIsTableProfileLoading] =
    useState<boolean>(false);
  const USERId = getCurrentUserId();
  const [slashedTableName, setSlashedTableName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [sampleData, setSampleData] = useState<TableData>({
    columns: [],
    rows: [],
  });
  const [tableProfile, setTableProfile] = useState<Table['profile']>();
  const [tableDetails, setTableDetails] = useState<Table>({} as Table);
  const { datasetFQN, tab } = useParams() as Record<string, string>;
  const [activeTab, setActiveTab] = useState<number>(getCurrentDatasetTab(tab));
  const [tableFQN, setTableFQN] = useState<string>(
    getPartialNameFromTableFQN(
      datasetFQN,
      [FqnPart.Service, FqnPart.Database, FqnPart.Schema, FqnPart.Table],
      FQN_SEPARATOR_CHAR
    )
  );
  const [isError, setIsError] = useState(false);
  const [entityThread, setEntityThread] = useState<Thread[]>([]);

  const [feedCount, setFeedCount] = useState<number>(0);
  const [entityFieldThreadCount, setEntityFieldThreadCount] = useState<
    EntityFieldThreadCount[]
  >([]);
  const [entityFieldTaskCount, setEntityFieldTaskCount] = useState<
    EntityFieldThreadCount[]
  >([]);

  const [tablePermissions, setTablePermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );

  const [paging, setPaging] = useState<Paging>(pagingObject);

  const { id: tableId, followers, version: currentVersion = '' } = tableDetails;

  const activeTabHandler = (tabValue: number) => {
    const currentTabIndex = tabValue - 1;
    if (datasetTableTabs[currentTabIndex].path !== tab) {
      setActiveTab(
        getCurrentDatasetTab(datasetTableTabs[currentTabIndex].path)
      );
      history.push({
        pathname: getTableTabPath(
          tableFQN,
          datasetTableTabs[currentTabIndex].path
        ),
      });
    }
  };

  const getFeedData = (
    after?: string,
    feedType?: FeedFilter,
    threadType?: ThreadType
  ) => {
    setIsentityThreadLoading(true);
    getAllFeeds(
      getEntityFeedLink(EntityType.TABLE, tableFQN),
      after,
      threadType,
      feedType,
      undefined,
      USERId
    )
      .then((res) => {
        const { data, paging: pagingObj } = res;
        if (data) {
          setPaging(pagingObj);
          setEntityThread((prevData) => [...prevData, ...data]);
        } else {
          showErrorToast(
            jsonData['api-error-messages']['fetch-entity-feed-error']
          );
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-entity-feed-error']
        );
      })
      .finally(() => setIsentityThreadLoading(false));
  };

  const handleFeedFetchFromFeedList = (
    after?: string,
    feedType?: FeedFilter,
    threadType?: ThreadType
  ) => {
    !after && setEntityThread([]);
    getFeedData(after, feedType, threadType);
  };

  const fetchResourcePermission = async (entityFqn: string) => {
    setIsLoading(true);
    try {
      const tablePermission = await getEntityPermissionByFqn(
        ResourceEntity.TABLE,
        entityFqn
      );

      setTablePermissions(tablePermission);
    } catch (error) {
      showErrorToast(
        jsonData['api-error-messages']['fetch-entity-permissions-error']
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTableDetail = () => {
    setIsLoading(true);
    getTableDetailsByFQN(
      tableFQN,
      getFields(defaultFields, datasetTableTabs[activeTab - 1].field ?? '')
    )
      .then((res) => {
        if (res) {
          const {
            id,
            database,
            fullyQualifiedName,
            service,
            serviceType,
            databaseSchema,
          } = res;
          const serviceName = service?.name ?? '';
          const databaseFullyQualifiedName = database?.fullyQualifiedName ?? '';
          const databaseSchemaFullyQualifiedName =
            databaseSchema?.fullyQualifiedName ?? '';
          setTableDetails(res);
          setSlashedTableName([
            {
              name: serviceName,
              url: serviceName
                ? getServiceDetailsPath(
                    serviceName,
                    ServiceCategory.DATABASE_SERVICES
                  )
                : '',
              imgSrc: serviceType ? serviceTypeLogo(serviceType) : undefined,
            },
            {
              name: getPartialNameFromTableFQN(databaseFullyQualifiedName, [
                FqnPart.Database,
              ]),
              url: getDatabaseDetailsPath(databaseFullyQualifiedName),
            },
            {
              name: getPartialNameFromTableFQN(
                databaseSchemaFullyQualifiedName,
                [FqnPart.Schema]
              ),
              url: getDatabaseSchemaDetailsPath(
                databaseSchemaFullyQualifiedName
              ),
            },
            {
              name: getEntityName(res),
              url: '',
              activeTitle: true,
            },
          ]);

          addToRecentViewed({
            displayName: getEntityName(res),
            entityType: EntityType.TABLE,
            fqn: fullyQualifiedName ?? '',
            serviceType: serviceType,
            timestamp: 0,
            id: id,
          });
        } else {
          showErrorToast(
            jsonData['api-error-messages']['fetch-table-details-error']
          );
          setIsError(true);
        }
      })
      .catch((err: AxiosError) => {
        if (err.response?.status === 404) {
          setIsError(true);
        } else {
          showErrorToast(
            err,
            jsonData['api-error-messages']['fetch-table-details-error']
          );
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const fetchTableProfileDetails = async () => {
    if (!isEmpty(tableDetails)) {
      setIsTableProfileLoading(true);
      try {
        console.log('count');

        const { profile } = await getLatestTableProfileByFqn(
          tableDetails.fullyQualifiedName ?? ''
        );

        setTableProfile(profile);
      } catch (err) {
        showErrorToast(
          err as AxiosError,
          t('server.entity-details-fetch-error', {
            entityType: t('label.table'),
            entityName: tableDetails.displayName ?? tableDetails.name,
          })
        );
      } finally {
        setIsTableProfileLoading(false);
      }
    }
  };

  const fetchTabSpecificData = (tabField = '') => {
    switch (tabField) {
      case TabSpecificField.SAMPLE_DATA: {
        if (!isUndefined(sampleData)) {
          break;
        } else {
          setIsSampleDataLoading(true);
          getTableDetailsByFQN(tableFQN, tabField)
            .then((res) => {
              if (res) {
                const { sampleData } = res;
                setSampleData(sampleData as TableData);
              } else {
                showErrorToast(
                  jsonData['api-error-messages']['fetch-sample-data-error']
                );
              }
            })
            .catch((err: AxiosError) => {
              showErrorToast(
                err,
                jsonData['api-error-messages']['fetch-sample-data-error']
              );
            })
            .finally(() => setIsSampleDataLoading(false));

          break;
        }
      }

      case TabSpecificField.LINEAGE: {
        break;
      }

      case TabSpecificField.ACTIVITY_FEED: {
        getFeedData();

        break;
      }

      default:
        break;
    }
  };

  useEffect(() => {
    if (datasetTableTabs[activeTab - 1].path !== tab) {
      setActiveTab(getCurrentDatasetTab(tab));
    }
    setEntityThread([]);
  }, [tab]);

  useEffect(() => {
    fetchTabSpecificData(datasetTableTabs[activeTab - 1].field);
  }, [activeTab]);

  const getEntityFeedCount = () => {
    getFeedCounts(
      EntityType.TABLE,
      tableFQN,
      setEntityFieldThreadCount,
      setEntityFieldTaskCount,
      setFeedCount
    );
  };

  const saveUpdatedTableData = useCallback(
    (updatedData: Table) => {
      const jsonPatch = compare(tableDetails, updatedData);

      return patchTableDetails(tableId, jsonPatch);
    },
    [tableDetails, tableId]
  );

  const descriptionUpdateHandler = async (updatedTable: Table) => {
    try {
      const response = await saveUpdatedTableData(updatedTable);
      if (response) {
        const { description, version } = response;
        setTableDetails((previous) => ({ ...previous, description, version }));
        getEntityFeedCount();
      } else {
        throw jsonData['api-error-messages']['update-description-error'];
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const columnsUpdateHandler = async (updatedTable: Table) => {
    try {
      const response = await saveUpdatedTableData(updatedTable);
      if (response) {
        setTableDetails(response);
        getEntityFeedCount();
      } else {
        showErrorToast(
          t('server.entity-updating-error', {
            entity: getEntityName(updatedTable),
          })
        );
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const onTagUpdate = async (updatedTable: Table) => {
    try {
      const res = await saveUpdatedTableData(updatedTable);
      setTableDetails((previous) => ({ ...previous, tags: res.tags }));
      getEntityFeedCount();
    } catch (err) {
      showErrorToast(
        err as AxiosError,
        jsonData['api-error-messages']['update-tags-error']
      );
    }
  };

  const settingsUpdateHandler = async (updatedTable: Table): Promise<void> => {
    try {
      const tableData = await saveUpdatedTableData(updatedTable);
      setTableDetails(tableData);

      getEntityFeedCount();
    } catch (error) {
      showErrorToast(
        t('server.entity-updating-error', {
          entity: getEntityName(updatedTable),
        })
      );
    }
  };

  const followTable = () => {
    addFollower(tableId, USERId)
      .then((res) => {
        if (res) {
          const { newValue } = res.changeDescription.fieldsAdded[0];
          const newFollowers = [...(followers ?? []), ...newValue];
          setTableDetails((prev) => ({ ...prev, followers: newFollowers }));
        } else {
          showErrorToast(
            jsonData['api-error-messages']['update-entity-follow-error']
          );
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['update-entity-follow-error']
        );
      });
  };

  const unfollowTable = () => {
    removeFollower(tableId, USERId)
      .then((res) => {
        const { oldValue } = res.changeDescription.fieldsDeleted[0];

        setTableDetails((pre) => ({
          ...pre,
          followers: pre.followers?.filter(
            (follower) => follower.id !== oldValue[0].id
          ),
        }));
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          t('server.entity-unfollow-error', {
            entity: getEntityName(tableDetails),
          })
        );
      });
  };

  const versionHandler = () => {
    history.push(
      getVersionPath(EntityType.TABLE, tableFQN, currentVersion as string)
    );
  };

  const postFeedHandler = (value: string, id: string) => {
    const currentUser = AppState.userDetails?.name ?? AppState.users[0]?.name;

    const data = {
      message: value,
      from: currentUser,
    } as Post;
    postFeedById(id, data)
      .then((res) => {
        if (res) {
          const { id, posts } = res;
          setEntityThread((pre) => {
            return pre.map((thread) => {
              if (thread.id === id) {
                return { ...res, posts: posts?.slice(-3) };
              } else {
                return thread;
              }
            });
          });
          getEntityFeedCount();
        } else {
          showErrorToast(jsonData['api-error-messages']['add-feed-error']);
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(err, jsonData['api-error-messages']['add-feed-error']);
      });
  };

  const createThread = (data: CreateThread) => {
    postThread(data)
      .then((res) => {
        if (res) {
          setEntityThread((pre) => [...pre, res]);
          getEntityFeedCount();
        } else {
          showErrorToast(
            jsonData['api-error-messages']['create-conversation-error']
          );
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['create-conversation-error']
        );
      });
  };

  const deletePostHandler = (
    threadId: string,
    postId: string,
    isThread: boolean
  ) => {
    deletePost(threadId, postId, isThread, setEntityThread);
  };

  const updateThreadHandler = (
    threadId: string,
    postId: string,
    isThread: boolean,
    data: Operation[]
  ) => {
    updateThreadData(threadId, postId, isThread, data, setEntityThread);
  };

  const handleExtentionUpdate = async (updatedTable: Table) => {
    try {
      const response = await saveUpdatedTableData(updatedTable);
      if (response) {
        const { version, owner: ownerValue, tags, extension } = response;
        setTableDetails((previous) => ({
          ...previous,
          version,
          owner: ownerValue,
          tags,
          extension,
        }));
      } else {
        throw jsonData['api-error-messages']['update-entity-error'];
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  useEffect(() => {
    if (tablePermissions.ViewAll || tablePermissions.ViewBasic) {
      fetchTableDetail();
      setActiveTab(getCurrentDatasetTab(tab));
      getEntityFeedCount();
    }
  }, [tablePermissions]);

  useEffect(() => {
    !tableDetails.deleted && fetchTableProfileDetails();
  }, [tableDetails]);

  useEffect(() => {
    fetchResourcePermission(tableFQN);
  }, [tableFQN]);

  useEffect(() => {
    setTableFQN(
      getPartialNameFromTableFQN(
        datasetFQN,
        [FqnPart.Service, FqnPart.Database, FqnPart.Schema, FqnPart.Table],
        FQN_SEPARATOR_CHAR
      )
    );
  }, [datasetFQN]);

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : isError ? (
        <ErrorPlaceHolder>
          {getEntityMissingError('table', tableFQN)}
        </ErrorPlaceHolder>
      ) : (
        <>
          {tablePermissions.ViewAll || tablePermissions.ViewBasic ? (
            <DatasetDetails
              activeTab={activeTab}
              columnsUpdateHandler={columnsUpdateHandler}
              createThread={createThread}
              dataModel={tableDetails.dataModel}
              datasetFQN={tableFQN}
              deletePostHandler={deletePostHandler}
              descriptionUpdateHandler={descriptionUpdateHandler}
              entityFieldTaskCount={entityFieldTaskCount}
              entityFieldThreadCount={entityFieldThreadCount}
              entityThread={entityThread}
              feedCount={feedCount}
              fetchFeedHandler={handleFeedFetchFromFeedList}
              followTableHandler={followTable}
              handleExtensionUpdate={handleExtentionUpdate}
              isSampleDataLoading={isSampleDataLoading}
              isTableProfileLoading={isTableProfileLoading}
              isentityThreadLoading={isentityThreadLoading}
              paging={paging}
              postFeedHandler={postFeedHandler}
              sampleData={sampleData}
              setActiveTabHandler={activeTabHandler}
              settingsUpdateHandler={settingsUpdateHandler}
              slashedTableName={slashedTableName}
              tableDetails={tableDetails}
              tableProfile={tableProfile}
              tagUpdateHandler={onTagUpdate}
              unfollowTableHandler={unfollowTable}
              updateThreadHandler={updateThreadHandler}
              versionHandler={versionHandler}
            />
          ) : (
            <ErrorPlaceHolder>{NO_PERMISSION_TO_VIEW}</ErrorPlaceHolder>
          )}
        </>
      )}
    </>
  );
};

export default observer(DatasetDetailsPage);
