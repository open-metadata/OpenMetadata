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
import jsonData from '../../jsons/en';
import {
  getCurrentUserId,
  getEntityMissingError,
  getFeedCounts,
  sortTagsCaseInsensitive,
} from '../../utils/CommonUtils';
import { getEntityFeedLink } from '../../utils/EntityUtils';
import { deletePost, updateThreadData } from '../../utils/FeedUtils';
import {
  defaultFields,
  getCurrentMlModelTab,
  mlModelTabs,
} from '../../utils/MlModelDetailsUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const MlModelPage = () => {
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
        jsonData['api-error-messages']['fetch-entity-permissions-error']
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
    try {
      setIsEntityThreadLoading(true);
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
        jsonData['api-error-messages']['fetch-entity-feed-error']
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

  const fetchTabSpecificData = (tabField = '') => {
    switch (tabField) {
      case TabSpecificField.LINEAGE: {
        break;
      }
      case TabSpecificField.ACTIVITY_FEED: {
        fetchFeedData();

        break;
      }

      default:
        break;
    }
  };

  const fetchMlModelDetails = (name: string) => {
    setIsDetailLoading(true);
    getMlModelByFQN(name, defaultFields)
      .then((response) => {
        const mlModelData = response;
        if (mlModelData) {
          setMlModelDetail(mlModelData);
          setCurrentVersion(mlModelData.version?.toString());
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(err);
      })
      .finally(() => {
        setIsDetailLoading(false);
      });
  };

  const saveUpdatedMlModelData = (updatedData: Mlmodel) => {
    const jsonPatch = compare(omitBy(mlModelDetail, isUndefined), updatedData);

    return patchMlModelDetails(mlModelDetail.id, jsonPatch);
  };

  const descriptionUpdateHandler = async (updatedMlModel: Mlmodel) => {
    try {
      const response = await saveUpdatedMlModelData(updatedMlModel);
      if (response) {
        const { description, version } = response;
        setCurrentVersion(version?.toString());
        setMlModelDetail((preVDetail) => ({
          ...preVDetail,
          description: description,
        }));
      } else {
        throw jsonData['api-error-messages']['update-description-error'];
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const followMlModel = () => {
    addFollower(mlModelDetail.id, USERId)
      .then((res) => {
        if (res) {
          const { newValue } = res.changeDescription.fieldsAdded[0];

          setMlModelDetail((preVDetail) => ({
            ...preVDetail,
            followers: [...(mlModelDetail.followers || []), ...newValue],
          }));
        } else {
          throw jsonData['api-error-messages']['update-entity-follow-error'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['update-entity-follow-error']
        );
      });
  };

  const unfollowMlModel = () => {
    removeFollower(mlModelDetail.id, USERId)
      .then((res) => {
        if (res) {
          const { oldValue } = res.changeDescription.fieldsDeleted[0];
          setMlModelDetail((preVDetail) => ({
            ...preVDetail,
            followers: (mlModelDetail.followers || []).filter(
              (follower) => follower.id !== oldValue[0].id
            ),
          }));
        } else {
          showErrorToast(
            jsonData['api-error-messages']['update-entity-unfollow-error']
          );
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['update-entity-unfollow-error']
        );
      });
  };

  const onTagUpdate = async (updatedMlModel: Mlmodel) => {
    try {
      const res = await saveUpdatedMlModelData(updatedMlModel);

      setMlModelDetail((preVDetail) => ({
        ...preVDetail,
        tags: sortTagsCaseInsensitive(res.tags || []),
      }));

      setCurrentVersion(res.version?.toString());
    } catch (err) {
      showErrorToast(
        err as AxiosError,
        jsonData['api-error-messages']['update-tags-error']
      );
    }
  };

  const settingsUpdateHandler = (updatedMlModel: Mlmodel): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      saveUpdatedMlModelData(updatedMlModel)
        .then((res) => {
          if (res) {
            setMlModelDetail((preVDetail) => ({
              ...preVDetail,
              owner: res.owner,
              tags: res.tags,
            }));
            setCurrentVersion(res.version?.toString());
            resolve();
          } else {
            showErrorToast(
              jsonData['api-error-messages']['update-entity-error']
            );
          }
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            jsonData['api-error-messages']['update-entity-error']
          );
          reject();
        });
    });
  };

  const updateMlModelFeatures = async (updatedMlModel: Mlmodel) => {
    try {
      const response = await saveUpdatedMlModelData(updatedMlModel);

      if (response) {
        setMlModelDetail((preVDetail) => ({
          ...preVDetail,
          mlFeatures: response.mlFeatures,
        }));
        setCurrentVersion(response.version?.toString());
      } else {
        throw jsonData['api-error-messages']['unexpected-error'];
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleExtentionUpdate = async (updatedMlModel: Mlmodel) => {
    try {
      const data = await saveUpdatedMlModelData(updatedMlModel);

      if (data) {
        setMlModelDetail(data);
        setCurrentVersion(data.version?.toString());
      } else {
        throw jsonData['api-error-messages']['update-entity-error'];
      }
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        jsonData['api-error-messages']['update-entity-error']
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
        jsonData['api-error-messages']['add-feed-error']
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
        jsonData['api-error-messages']['create-conversation-error']
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
          unfollowMlModelHandler={unfollowMlModel}
          updateMlModelFeatures={updateMlModelFeatures}
          updateThreadHandler={updateThreadHandler}
          version={currentVersion}
          versionHandler={versionHandler}
          onExtensionUpdate={handleExtentionUpdate}
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
    fetchTabSpecificData(mlModelTabs[activeTab - 1].field);
  }, [activeTab]);

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
