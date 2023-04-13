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
import Loader from 'components/Loader/Loader';
import MlModelDetailComponent from 'components/MlModelDetail/MlModelDetail.component';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from 'components/PermissionProvider/PermissionProvider.interface';
import { compare, Operation } from 'fast-json-patch';
import { isEmpty, isNil, isUndefined, omitBy } from 'lodash';
import { observer } from 'mobx-react';
import { getAllFeeds, postFeedById, postThread } from 'rest/feedsAPI';
import {
  addFollower,
  getMlModelByFQN,
  patchMlModelDetails,
  removeFollower,
} from 'rest/mlModelAPI';

import React, { Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import AppState from '../../AppState';
import { getMlModelPath, getVersionPath } from '../../constants/constants';
import { NO_PERMISSION_TO_VIEW } from '../../constants/HelperTextUtil';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { FeedFilter } from '../../enums/mydata.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Mlmodel } from '../../generated/entity/data/mlmodel';
import { Post, Thread, ThreadType } from '../../generated/entity/feed/thread';
import { Paging } from '../../generated/type/paging';
import { EntityFieldThreadCount } from '../../interface/feed.interface';
import {
  getCurrentUserId,
  getEntityMissingError,
  getFeedCounts,
} from '../../utils/CommonUtils';
import { getEntityFeedLink, getEntityName } from '../../utils/EntityUtils';
import { deletePost, updateThreadData } from '../../utils/FeedUtils';
import {
  defaultFields,
  getCurrentMlModelTab,
  mlModelTabs,
} from '../../utils/MlModelDetailsUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const MlModelPage = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { mlModelFqn, tab } = useParams<{ [key: string]: string }>();
  const [mlModelDetail, setMlModelDetail] = useState<Mlmodel>({} as Mlmodel);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<number>(getCurrentMlModelTab(tab));
  const USERId = getCurrentUserId();

  const [mlModelPermissions, setPipelinePermissions] = useState(
    DEFAULT_ENTITY_PERMISSION
  );

  const [entityThread, setEntityThread] = useState<Thread[]>([]);
  const [isEntityThreadLoading, setIsEntityThreadLoading] =
    useState<boolean>(false);
  const [paging, setPaging] = useState<Paging>({} as Paging);

  const [feedCount, setFeedCount] = useState<number>(0);
  const [entityFieldThreadCount, setEntityFieldThreadCount] = useState<
    EntityFieldThreadCount[]
  >([]);
  const [entityFieldTaskCount, setEntityFieldTaskCount] = useState<
    EntityFieldThreadCount[]
  >([]);

  const [currentVersion, setCurrentVersion] = useState<string>();

  // get current user details
  const currentUser = useMemo(
    () => AppState.getCurrentUserDetails(),
    [AppState.userDetails, AppState.nonSecureUserDetails]
  );

  const { getEntityPermissionByFqn } = usePermissionProvider();

  const fetchResourcePermission = async (entityFqn: string) => {
    setIsDetailLoading(true);
    try {
      const entityPermission = await getEntityPermissionByFqn(
        ResourceEntity.ML_MODEL,
        entityFqn
      );
      setPipelinePermissions(entityPermission);
    } catch (error) {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: entityFqn,
        })
      );
    } finally {
      setIsDetailLoading(false);
    }
  };

  const activeTabHandler = (tabValue: number) => {
    const currentTabIndex = tabValue - 1;
    if (mlModelTabs[currentTabIndex].path !== tab) {
      setActiveTab(getCurrentMlModelTab(mlModelTabs[currentTabIndex].path));
      history.push({
        pathname: getMlModelPath(mlModelFqn, mlModelTabs[currentTabIndex].path),
      });
    }
  };

  const fetchEntityFeedCount = () => {
    getFeedCounts(
      EntityType.MLMODEL,
      mlModelFqn,
      setEntityFieldThreadCount,
      setEntityFieldTaskCount,
      setFeedCount
    );
  };

  const fetchFeedData = async (
    after?: string,
    feedType?: FeedFilter,
    threadType?: ThreadType
  ) => {
    setIsEntityThreadLoading(true);
    !after && setEntityThread([]);
    try {
      const response = await getAllFeeds(
        getEntityFeedLink(EntityType.MLMODEL, mlModelFqn),
        after,
        threadType,
        feedType,
        undefined,
        USERId
      );
      const { data, paging: pagingObj } = response;
      setPaging(pagingObj);
      setEntityThread((prevData) => [...prevData, ...data]);
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
    fetchFeedData(after, feedType, threadType);
  };

  const fetchMlModelDetails = async (name: string) => {
    setIsDetailLoading(true);
    try {
      const res = await getMlModelByFQN(name, defaultFields);
      setMlModelDetail(res);
      setCurrentVersion(res.version?.toString());
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const saveUpdatedMlModelData = (updatedData: Mlmodel) => {
    const jsonPatch = compare(omitBy(mlModelDetail, isUndefined), updatedData);

    return patchMlModelDetails(mlModelDetail.id, jsonPatch);
  };

  const descriptionUpdateHandler = async (updatedMlModel: Mlmodel) => {
    try {
      const response = await saveUpdatedMlModelData(updatedMlModel);
      const { description, version } = response;
      setCurrentVersion(version?.toString());
      setMlModelDetail((preVDetail) => ({
        ...preVDetail,
        description: description,
      }));
      fetchEntityFeedCount();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const followMlModel = async () => {
    try {
      const res = await addFollower(mlModelDetail.id, USERId);
      const { newValue } = res.changeDescription.fieldsAdded[0];
      setMlModelDetail((preVDetail) => ({
        ...preVDetail,
        followers: [...(mlModelDetail.followers || []), ...newValue],
      }));
      fetchEntityFeedCount();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-follow-error', {
          entity: getEntityName(mlModelDetail),
        })
      );
    }
  };

  const unFollowMlModel = async () => {
    try {
      const res = await removeFollower(mlModelDetail.id, USERId);
      const { oldValue } = res.changeDescription.fieldsDeleted[0];
      setMlModelDetail((preVDetail) => ({
        ...preVDetail,
        followers: (mlModelDetail.followers || []).filter(
          (follower) => follower.id !== oldValue[0].id
        ),
      }));
      fetchEntityFeedCount();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-unfollow-error', {
          entity: getEntityName(mlModelDetail),
        })
      );
    }
  };

  const onTagUpdate = async (updatedMlModel: Mlmodel) => {
    try {
      const res = await saveUpdatedMlModelData(updatedMlModel);
      setMlModelDetail((preVDetail) => ({
        ...preVDetail,
        tags: res.tags,
      }));
      setCurrentVersion(res.version?.toString());
      fetchEntityFeedCount();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-updating-error', {
          entity: t('label.tag-plural'),
        })
      );
    }
  };

  const settingsUpdateHandler = async (
    updatedMlModel: Mlmodel
  ): Promise<void> => {
    try {
      const res = await saveUpdatedMlModelData(updatedMlModel);
      setMlModelDetail((preVDetail) => ({
        ...preVDetail,
        owner: res.owner,
        tags: res.tags,
      }));
      setCurrentVersion(res.version?.toString());
      fetchEntityFeedCount();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-updating-error', {
          entity: getEntityName(mlModelDetail),
        })
      );
    }
  };

  const updateMlModelFeatures = async (updatedMlModel: Mlmodel) => {
    try {
      const response = await saveUpdatedMlModelData(updatedMlModel);
      setMlModelDetail((preVDetail) => ({
        ...preVDetail,
        mlFeatures: response.mlFeatures,
      }));
      setCurrentVersion(response.version?.toString());
      fetchEntityFeedCount();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleExtensionUpdate = async (updatedMlModel: Mlmodel) => {
    try {
      const data = await saveUpdatedMlModelData(updatedMlModel);
      setMlModelDetail(data);
      setCurrentVersion(data.version?.toString());
      fetchEntityFeedCount();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-updating-error', {
          entity: getEntityName(mlModelDetail),
        })
      );
    }
  };

  const postFeedHandler = async (value: string, threadId: string) => {
    const data = {
      message: value,
      from: currentUser?.name,
    } as Post;
    try {
      const response = await postFeedById(threadId, data);
      const { id, posts } = response;
      setEntityThread((pre) => {
        return pre.map((thread) => {
          if (thread.id === id) {
            return { ...response, posts: posts?.slice(-3) };
          } else {
            return thread;
          }
        });
      });
      fetchEntityFeedCount();
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
      const response = await postThread(data);
      setEntityThread((pre) => [...pre, response]);
      fetchEntityFeedCount();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.create-entity-error', {
          entity: t('label.conversation'),
        })
      );
    }
  };

  const versionHandler = () => {
    history.push(
      getVersionPath(EntityType.MLMODEL, mlModelFqn, currentVersion as string)
    );
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

  const getMlModelDetail = () => {
    if (!isNil(mlModelDetail) && !isEmpty(mlModelDetail)) {
      return (
        <MlModelDetailComponent
          activeTab={activeTab}
          createThread={createThread}
          deletePostHandler={deletePostHandler}
          descriptionUpdateHandler={descriptionUpdateHandler}
          entityFieldTaskCount={entityFieldTaskCount}
          entityFieldThreadCount={entityFieldThreadCount}
          entityThread={entityThread}
          feedCount={feedCount}
          fetchFeedHandler={handleFeedFetchFromFeedList}
          followMlModelHandler={followMlModel}
          isEntityThreadLoading={isEntityThreadLoading}
          mlModelDetail={mlModelDetail}
          paging={paging}
          postFeedHandler={postFeedHandler}
          setActiveTabHandler={activeTabHandler}
          settingsUpdateHandler={settingsUpdateHandler}
          tagUpdateHandler={onTagUpdate}
          unfollowMlModelHandler={unFollowMlModel}
          updateMlModelFeatures={updateMlModelFeatures}
          updateThreadHandler={updateThreadHandler}
          version={currentVersion}
          versionHandler={versionHandler}
          onExtensionUpdate={handleExtensionUpdate}
        />
      );
    } else {
      return (
        <ErrorPlaceHolder>
          {getEntityMissingError('mlModel', mlModelFqn)}
        </ErrorPlaceHolder>
      );
    }
  };

  useEffect(() => {
    setEntityThread([]);
  }, [tab]);

  useEffect(() => {
    if (mlModelTabs[activeTab - 1].field === TabSpecificField.ACTIVITY_FEED) {
      fetchFeedData();
    }
  }, [activeTab, feedCount]);

  useEffect(() => {
    if (mlModelPermissions.ViewAll || mlModelPermissions.ViewBasic) {
      fetchMlModelDetails(mlModelFqn);
      fetchEntityFeedCount();
    }
  }, [mlModelPermissions, mlModelFqn]);

  useEffect(() => {
    fetchResourcePermission(mlModelFqn);
  }, [mlModelFqn]);

  return (
    <Fragment>
      {isDetailLoading ? (
        <Loader />
      ) : (
        <>
          {mlModelPermissions.ViewAll || mlModelPermissions.ViewBasic ? (
            getMlModelDetail()
          ) : (
            <ErrorPlaceHolder>{NO_PERMISSION_TO_VIEW}</ErrorPlaceHolder>
          )}
        </>
      )}
    </Fragment>
  );
};

export default observer(MlModelPage);
