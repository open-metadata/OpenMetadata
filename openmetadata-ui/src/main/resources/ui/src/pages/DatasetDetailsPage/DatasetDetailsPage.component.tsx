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
import DatasetDetails from 'components/DatasetDetails/DatasetDetails.component';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { compare, Operation } from 'fast-json-patch';
import { isEmpty } from 'lodash';
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
import { getVersionPath, pagingObject } from '../../constants/constants';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { FeedFilter } from '../../enums/mydata.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Table } from '../../generated/entity/data/table';
import { Post, Thread, ThreadType } from '../../generated/entity/feed/thread';
import { Paging } from '../../generated/type/paging';
import { EntityFieldThreadCount } from '../../interface/feed.interface';
import {
  addToRecentViewed,
  getCurrentUserId,
  getEntityMissingError,
  getFeedCounts,
  sortTagsCaseInsensitive,
} from '../../utils/CommonUtils';
import { defaultFields } from '../../utils/DatasetDetailsUtils';
import { getEntityFeedLink, getEntityName } from '../../utils/EntityUtils';
import { deletePost, updateThreadData } from '../../utils/FeedUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const DatasetDetailsPage: FunctionComponent = () => {
  const history = useHistory();
  const { t } = useTranslation();
  const { datasetFQN, tab } =
    useParams<{ datasetFQN: string; tab: EntityTabs }>();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEntityThreadLoading, setIsEntityThreadLoading] =
    useState<boolean>(false);
  const [isTableProfileLoading, setIsTableProfileLoading] =
    useState<boolean>(false);
  const USERId = getCurrentUserId();
  const [tableProfile, setTableProfile] = useState<Table['profile']>();
  const [tableDetails, setTableDetails] = useState<Table>({} as Table);
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

  const getFeedData = async (
    after?: string,
    feedType?: FeedFilter,
    threadType?: ThreadType
  ) => {
    setIsEntityThreadLoading(true);
    try {
      const { data, paging: pagingObj } = await getAllFeeds(
        getEntityFeedLink(EntityType.TABLE, datasetFQN),
        after,
        threadType,
        feedType,
        undefined,
        USERId
      );
      setPaging(pagingObj);
      setEntityThread((prevData) => [...(after ? prevData : []), ...data]);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.entity-feed-plural'),
        })
      );
    } finally {
      setIsEntityThreadLoading(false);
    }
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
      t('server.fetch-entity-permissions-error', {
        entity: entityFqn,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTableDetail = async () => {
    setIsLoading(true);

    try {
      const res = await getTableDetailsByFQN(datasetFQN, defaultFields);

      const { id, fullyQualifiedName, serviceType } = res;
      setTableDetails(res);

      addToRecentViewed({
        displayName: getEntityName(res),
        entityType: EntityType.TABLE,
        fqn: fullyQualifiedName ?? '',
        serviceType: serviceType,
        timestamp: 0,
        id: id,
      });
    } catch (error) {
      if ((error as AxiosError).response?.status === 404) {
        setIsError(true);
      } else {
        showErrorToast(
          error as AxiosError,
          t('server.entity-details-fetch-error', {
            entityType: t('label.pipeline'),
            entityName: datasetFQN,
          })
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTableProfileDetails = async () => {
    if (!isEmpty(tableDetails)) {
      setIsTableProfileLoading(true);
      try {
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

  useEffect(() => {
    if (EntityTabs.ACTIVITY_FEED === tab) {
      getFeedData();
    }
  }, [tab, feedCount]);

  const getEntityFeedCount = () => {
    getFeedCounts(
      EntityType.TABLE,
      datasetFQN,
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

  const onTableUpdate = async (updatedTable: Table, key: keyof Table) => {
    try {
      const res = await saveUpdatedTableData(updatedTable);

      setTableDetails((previous) => {
        if (key === 'tags') {
          return {
            ...previous,
            version: res.version,
            [key]: sortTagsCaseInsensitive(res.tags ?? []),
          };
        }

        return {
          ...previous,
          version: res.version,
          [key]: res[key],
        };
      });
      getEntityFeedCount();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const followTable = async () => {
    try {
      const res = await addFollower(tableId, USERId);
      const { newValue } = res.changeDescription.fieldsAdded[0];
      const newFollowers = [...(followers ?? []), ...newValue];
      setTableDetails((prev) => ({ ...prev, followers: newFollowers }));
      getEntityFeedCount();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-follow-error', {
          entity: getEntityName(tableDetails),
        })
      );
    }
  };

  const unFollowTable = async () => {
    try {
      const res = await removeFollower(tableId, USERId);
      const { oldValue } = res.changeDescription.fieldsDeleted[0];
      setTableDetails((pre) => ({
        ...pre,
        followers: pre.followers?.filter(
          (follower) => follower.id !== oldValue[0].id
        ),
      }));
      getEntityFeedCount();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-unfollow-error', {
          entity: getEntityName(tableDetails),
        })
      );
    }
  };

  const versionHandler = () => {
    history.push(
      getVersionPath(EntityType.TABLE, datasetFQN, currentVersion as string)
    );
  };

  const postFeedHandler = async (value: string, id: string) => {
    const currentUser = AppState.userDetails?.name ?? AppState.users[0]?.name;

    const data = {
      message: value,
      from: currentUser,
    } as Post;

    try {
      const res = await postFeedById(id, data);
      const { id: responseId, posts } = res;
      setEntityThread((pre) => {
        return pre.map((thread) => {
          if (thread.id === responseId) {
            return { ...res, posts: posts?.slice(-3) };
          } else {
            return thread;
          }
        });
      });
      getEntityFeedCount();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.add-entity-error', {
          entity: t('label.feed-plural'),
        })
      );
    }
  };

  const createThread = async (data: CreateThread) => {
    try {
      const res = await postThread(data);
      setEntityThread((pre) => [...pre, res]);
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

  useEffect(() => {
    if (tablePermissions.ViewAll || tablePermissions.ViewBasic) {
      fetchTableDetail();
      getEntityFeedCount();
    }
  }, [tablePermissions]);

  useEffect(() => {
    !tableDetails.deleted && fetchTableProfileDetails();
  }, [tableDetails]);

  useEffect(() => {
    fetchResourcePermission(datasetFQN);
  }, [datasetFQN]);

  if (isLoading) {
    return <Loader />;
  }
  if (isError) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError('table', datasetFQN)}
      </ErrorPlaceHolder>
    );
  }

  if (!tablePermissions.ViewAll && !tablePermissions.ViewBasic) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  return (
    <DatasetDetails
      createThread={createThread}
      dataModel={tableDetails.dataModel}
      deletePostHandler={deletePostHandler}
      entityFieldTaskCount={entityFieldTaskCount}
      entityFieldThreadCount={entityFieldThreadCount}
      entityThread={entityThread}
      feedCount={feedCount}
      fetchFeedHandler={handleFeedFetchFromFeedList}
      followTableHandler={followTable}
      isEntityThreadLoading={isEntityThreadLoading}
      isTableProfileLoading={isTableProfileLoading}
      paging={paging}
      postFeedHandler={postFeedHandler}
      tableDetails={tableDetails}
      tableProfile={tableProfile}
      unfollowTableHandler={unFollowTable}
      updateThreadHandler={updateThreadHandler}
      versionHandler={versionHandler}
      onTableUpdate={onTableUpdate}
    />
  );
};

export default observer(DatasetDetailsPage);
