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
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import TopicDetails from 'components/TopicDetails/TopicDetails.component';
import { compare, Operation } from 'fast-json-patch';
import { isUndefined, omitBy, toString } from 'lodash';
import { observer } from 'mobx-react';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { getAllFeeds, postFeedById, postThread } from 'rest/feedsAPI';
import {
  addFollower,
  getTopicByFqn,
  patchTopicDetails,
  removeFollower,
} from 'rest/topicsAPI';
import AppState from '../../AppState';
import {
  getServiceDetailsPath,
  getTopicDetailsPath,
  getVersionPath,
} from '../../constants/constants';
import { NO_PERMISSION_TO_VIEW } from '../../constants/HelperTextUtil';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { FeedFilter } from '../../enums/mydata.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Topic } from '../../generated/entity/data/topic';
import { Post, Thread, ThreadType } from '../../generated/entity/feed/thread';
import { Paging } from '../../generated/type/paging';
import { EntityFieldThreadCount } from '../../interface/feed.interface';
import jsonData from '../../jsons/en';
import {
  addToRecentViewed,
  getCurrentUserId,
  getEntityMissingError,
  getFeedCounts,
} from '../../utils/CommonUtils';
import { getEntityFeedLink, getEntityName } from '../../utils/EntityUtils';
import { deletePost, updateThreadData } from '../../utils/FeedUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import {
  getCurrentTopicTab,
  getFormattedTopicDetails,
  topicDetailsTabs,
} from '../../utils/TopicDetailsUtils';

const TopicDetailsPage: FunctionComponent = () => {
  const USERId = getCurrentUserId();
  const history = useHistory();
  const { getEntityPermissionByFqn } = usePermissionProvider();

  const { topicFQN, tab } = useParams() as Record<string, string>;
  const [topicDetails, setTopicDetails] = useState<Topic>({} as Topic);
  const [isLoading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<number>(getCurrentTopicTab(tab));
  const [isError, setIsError] = useState(false);
  const [slashedTopicName, setSlashedTopicName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);

  const [entityThread, setEntityThread] = useState<Thread[]>([]);
  const [isentityThreadLoading, setIsentityThreadLoading] =
    useState<boolean>(false);
  const [feedCount, setFeedCount] = useState<number>(0);
  const [entityFieldThreadCount, setEntityFieldThreadCount] = useState<
    EntityFieldThreadCount[]
  >([]);
  const [entityFieldTaskCount, setEntityFieldTaskCount] = useState<
    EntityFieldThreadCount[]
  >([]);
  const [paging, setPaging] = useState<Paging>({} as Paging);

  const [topicPermissions, setTopicPermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );

  const activeTabHandler = (tabValue: number) => {
    const currentTabIndex = tabValue - 1;
    if (topicDetailsTabs[currentTabIndex].path !== tab) {
      setActiveTab(getCurrentTopicTab(topicDetailsTabs[currentTabIndex].path));
      history.push({
        pathname: getTopicDetailsPath(
          topicFQN,
          topicDetailsTabs[currentTabIndex].path
        ),
      });
    }
  };

  const getEntityFeedCount = () => {
    getFeedCounts(
      EntityType.TOPIC,
      topicFQN,
      setEntityFieldThreadCount,
      setEntityFieldTaskCount,
      setFeedCount
    );
  };

  const fetchActivityFeed = (
    after?: string,
    feedType?: FeedFilter,
    threadType?: ThreadType
  ) => {
    setIsentityThreadLoading(true);
    getAllFeeds(
      getEntityFeedLink(EntityType.TOPIC, topicFQN),
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
    filterType?: FeedFilter,
    type?: ThreadType
  ) => {
    !after && setEntityThread([]);
    fetchActivityFeed(after, filterType, type);
  };

  const { id: topicId, version: currentVersion } = topicDetails;

  const saveUpdatedTopicData = (updatedData: Topic) => {
    const jsonPatch = compare(omitBy(topicDetails, isUndefined), updatedData);

    return patchTopicDetails(topicId, jsonPatch);
  };

  const fetchResourcePermission = async (entityFqn: string) => {
    setLoading(true);
    try {
      const permissions = await getEntityPermissionByFqn(
        ResourceEntity.TOPIC,
        entityFqn
      );
      setTopicPermissions(permissions);
    } catch (error) {
      showErrorToast(
        jsonData['api-error-messages']['fetch-entity-permissions-error']
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchTopicDetail = (topicFQN: string) => {
    setLoading(true);
    getTopicByFqn(topicFQN, [
      TabSpecificField.OWNER,
      TabSpecificField.FOLLOWERS,
      TabSpecificField.TAGS,
      TabSpecificField.EXTENSION,
    ])
      .then((res) => {
        if (res) {
          const { id, fullyQualifiedName, service, serviceType } = res;

          setTopicDetails(res);

          setSlashedTopicName([
            {
              name: service.name ?? '',
              url: service.name
                ? getServiceDetailsPath(
                    service.name,
                    ServiceCategory.MESSAGING_SERVICES
                  )
                : '',
              imgSrc: serviceType ? serviceTypeLogo(serviceType) : undefined,
            },
            {
              name: getEntityName(res),
              url: '',
              activeTitle: true,
            },
          ]);

          addToRecentViewed({
            displayName: getEntityName(res),
            entityType: EntityType.TOPIC,
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
            jsonData['api-error-messages']['fetch-topic-details-error']
          );
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const followTopic = () => {
    addFollower(topicId, USERId)
      .then((res) => {
        if (res) {
          const { newValue } = res.changeDescription.fieldsAdded[0];
          setTopicDetails((prev) => ({
            ...prev,
            followers: [...(prev?.followers ?? []), ...newValue],
          }));
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

  const unfollowTopic = () => {
    removeFollower(topicId, USERId)
      .then((res) => {
        if (res) {
          const { oldValue } = res.changeDescription.fieldsDeleted[0];
          setTopicDetails((prev) => ({
            ...prev,
            followers: (prev?.followers ?? []).filter(
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

  const descriptionUpdateHandler = async (updatedTopic: Topic) => {
    try {
      const response = await saveUpdatedTopicData(updatedTopic);
      if (response) {
        setTopicDetails(response);

        getEntityFeedCount();
      } else {
        throw jsonData['api-error-messages']['update-description-error'];
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const settingsUpdateHandler = (updatedTopic: Topic): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      saveUpdatedTopicData(updatedTopic)
        .then((res) => {
          if (res) {
            const formattedTopicDetails = getFormattedTopicDetails(res);
            setTopicDetails(formattedTopicDetails);

            getEntityFeedCount();
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

  const onTagUpdate = (updatedTopic: Topic) => {
    saveUpdatedTopicData(updatedTopic)
      .then((res) => {
        if (res) {
          setTopicDetails(res);
          getEntityFeedCount();
        } else {
          showErrorToast(jsonData['api-error-messages']['update-tags-error']);
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['update-tags-error']
        );
      });
  };

  const versionHandler = () => {
    currentVersion &&
      history.push(
        getVersionPath(EntityType.TOPIC, topicFQN, toString(currentVersion))
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

  const handleExtentionUpdate = async (updatedTopic: Topic) => {
    try {
      const data = await saveUpdatedTopicData(updatedTopic);

      if (data) {
        setTopicDetails(data);
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

  useEffect(() => {
    if (topicDetailsTabs[activeTab - 1].path !== tab) {
      setActiveTab(getCurrentTopicTab(tab));
    }
    setEntityThread([]);
  }, [tab]);

  useEffect(() => {
    if (activeTab === 2) {
      fetchActivityFeed();
    }
  }, [activeTab]);

  useEffect(() => {
    fetchResourcePermission(topicFQN);
  }, [topicFQN]);

  useEffect(() => {
    if (topicPermissions.ViewAll || topicPermissions.ViewBasic) {
      fetchTopicDetail(topicFQN);
      getEntityFeedCount();
    }
  }, [topicPermissions, topicFQN]);

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : isError ? (
        <ErrorPlaceHolder>
          {getEntityMissingError('topic', topicFQN)}
        </ErrorPlaceHolder>
      ) : (
        <>
          {topicPermissions.ViewAll || topicPermissions.ViewBasic ? (
            <TopicDetails
              activeTab={activeTab}
              createThread={createThread}
              deletePostHandler={deletePostHandler}
              descriptionUpdateHandler={descriptionUpdateHandler}
              entityFieldTaskCount={entityFieldTaskCount}
              entityFieldThreadCount={entityFieldThreadCount}
              entityThread={entityThread}
              feedCount={feedCount}
              fetchFeedHandler={handleFeedFetchFromFeedList}
              followTopicHandler={followTopic}
              isentityThreadLoading={isentityThreadLoading}
              paging={paging}
              postFeedHandler={postFeedHandler}
              setActiveTabHandler={activeTabHandler}
              settingsUpdateHandler={settingsUpdateHandler}
              slashedTopicName={slashedTopicName}
              tagUpdateHandler={onTagUpdate}
              topicDetails={topicDetails}
              topicFQN={topicFQN}
              unfollowTopicHandler={unfollowTopic}
              updateThreadHandler={updateThreadHandler}
              versionHandler={versionHandler}
              onExtensionUpdate={handleExtentionUpdate}
            />
          ) : (
            <ErrorPlaceHolder>{NO_PERMISSION_TO_VIEW}</ErrorPlaceHolder>
          )}
        </>
      )}
    </>
  );
};

export default observer(TopicDetailsPage);
