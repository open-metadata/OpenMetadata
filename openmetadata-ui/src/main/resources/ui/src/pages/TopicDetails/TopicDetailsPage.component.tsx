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
import {
  Edge,
  EdgeData,
  LeafNodes,
  LineagePos,
  LoadingNodeState,
} from 'components/EntityLineage/EntityLineage.interface';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import TopicDetails from 'components/TopicDetails/TopicDetails.component';
import { compare, Operation } from 'fast-json-patch';
import { isEmpty, isUndefined, omitBy } from 'lodash';
import { observer } from 'mobx-react';
import { EntityTags } from 'Models';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { getAllFeeds, postFeedById, postThread } from 'rest/feedsAPI';
import { getLineageByFQN } from 'rest/lineageAPI';
import { addLineage, deleteLineageEdge } from 'rest/miscAPI';
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
import { Topic, TopicSampleData } from '../../generated/entity/data/topic';
import { Post, Thread, ThreadType } from '../../generated/entity/feed/thread';
import { EntityLineage } from '../../generated/type/entityLineage';
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import { TagLabel } from '../../generated/type/tagLabel';
import { EntityFieldThreadCount } from '../../interface/feed.interface';
import jsonData from '../../jsons/en';
import {
  addToRecentViewed,
  getCurrentUserId,
  getEntityMissingError,
  getFeedCounts,
} from '../../utils/CommonUtils';
import {
  getEntityFeedLink,
  getEntityLineage,
  getEntityName,
} from '../../utils/EntityUtils';
import { deletePost, updateThreadData } from '../../utils/FeedUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import { getTagsWithoutTier, getTierTags } from '../../utils/TableUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import {
  getCurrentTopicTab,
  topicDetailsTabs,
} from '../../utils/TopicDetailsUtils';

const TopicDetailsPage: FunctionComponent = () => {
  const USERId = getCurrentUserId();
  const history = useHistory();
  const { getEntityPermissionByFqn } = usePermissionProvider();

  const { topicFQN, tab } = useParams() as Record<string, string>;
  const [topicDetails, setTopicDetails] = useState<Topic>({} as Topic);
  const [topicId, setTopicId] = useState<string>('');
  const [isLoading, setLoading] = useState<boolean>(true);
  const [description, setDescription] = useState<string>('');
  const [followers, setFollowers] = useState<Array<EntityReference>>([]);
  const [owner, setOwner] = useState<EntityReference>();
  const [tier, setTier] = useState<TagLabel>();
  const [tags, setTags] = useState<Array<EntityTags>>([]);
  const [activeTab, setActiveTab] = useState<number>(getCurrentTopicTab(tab));
  const [partitions, setPartitions] = useState<number>(0);
  const [cleanupPolicies, setCleanupPolicies] = useState<Array<string>>([]);
  const [maximumMessageSize, setMaximumMessageSize] = useState<number>(0);
  const [replicationFactor, setReplicationFactor] = useState<number>(0);
  const [retentionSize, setRetentionSize] = useState<number>(0);
  const [name, setName] = useState<string>('');
  const [deleted, setDeleted] = useState<boolean>(false);
  const [isError, setIsError] = useState(false);
  const [slashedTopicName, setSlashedTopicName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [currentVersion, setCurrentVersion] = useState<string>();
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

  const [sampleData, setSampleData] = useState<TopicSampleData>();
  const [isSampleDataLoading, setIsSampleDataLoading] =
    useState<boolean>(false);
  const [entityLineage, setEntityLineage] = useState<EntityLineage>(
    {} as EntityLineage
  );
  const [leafNodes, setLeafNodes] = useState<LeafNodes>({} as LeafNodes);
  const [isNodeLoading, setNodeLoading] = useState<LoadingNodeState>({
    id: undefined,
    state: false,
  });
  const [isLineageLoading, setIsLineageLoading] = useState<boolean>(false);

  const [topicPermissions, setTopicPermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );

  const getLineageData = () => {
    setIsLineageLoading(true);
    getLineageByFQN(topicFQN, EntityType.TOPIC)
      .then((res) => {
        if (res) {
          setEntityLineage(res);
        } else {
          showErrorToast(jsonData['api-error-messages']['fetch-lineage-error']);
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-lineage-error']
        );
      })
      .finally(() => {
        setIsLineageLoading(false);
      });
  };

  const setLeafNode = (val: EntityLineage, pos: LineagePos) => {
    if (pos === 'to' && val.downstreamEdges?.length === 0) {
      setLeafNodes((prev) => ({
        ...prev,
        downStreamNode: [...(prev.downStreamNode ?? []), val.entity.id],
      }));
    }
    if (pos === 'from' && val.upstreamEdges?.length === 0) {
      setLeafNodes((prev) => ({
        ...prev,
        upStreamNode: [...(prev.upStreamNode ?? []), val.entity.id],
      }));
    }
  };

  const entityLineageHandler = (lineage: EntityLineage) => {
    setEntityLineage(lineage);
  };

  const loadNodeHandler = (node: EntityReference, pos: LineagePos) => {
    setNodeLoading({ id: node.id, state: true });
    getLineageByFQN(node.fullyQualifiedName ?? '', node.type)
      .then((res) => {
        if (res) {
          setLeafNode(res, pos);
          setEntityLineage(getEntityLineage(entityLineage, res, pos));
        } else {
          showErrorToast(
            jsonData['api-error-messages']['fetch-lineage-node-error']
          );
        }
        setTimeout(() => {
          setNodeLoading((prev) => ({ ...prev, state: false }));
        }, 500);
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-lineage-node-error']
        );
      });
  };

  const addLineageHandler = (edge: Edge): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      addLineage(edge)
        .then(() => {
          resolve();
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            jsonData['api-error-messages']['add-lineage-error']
          );
          reject();
        });
    });
  };

  const removeLineageHandler = (data: EdgeData) => {
    deleteLineageEdge(
      data.fromEntity,
      data.fromId,
      data.toEntity,
      data.toId
    ).catch((err: AxiosError) => {
      showErrorToast(
        err,
        jsonData['api-error-messages']['delete-lineage-error']
      );
    });
  };

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

  const fetchTabSpecificData = (tabField = '') => {
    switch (tabField) {
      case TabSpecificField.ACTIVITY_FEED: {
        fetchActivityFeed();

        break;
      }

      case TabSpecificField.SAMPLE_DATA: {
        if (!isUndefined(sampleData)) {
          break;
        } else {
          setIsSampleDataLoading(true);
          getTopicByFqn(topicFQN, tabField)
            .then((res) => {
              if (res) {
                const { sampleData } = res;
                setSampleData(sampleData);
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
        if (!deleted) {
          if (isEmpty(entityLineage)) {
            getLineageData();
          }

          break;
        }

        break;
      }

      default:
        break;
    }
  };

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
          const {
            id,
            deleted,
            description,
            followers,
            fullyQualifiedName,
            name,
            service,
            tags,
            owner,
            partitions,
            cleanupPolicies,
            maximumMessageSize,
            replicationFactor,
            retentionSize,
            serviceType,
            version,
          } = res;
          setName(name);
          setTopicDetails(res);
          setTopicId(id);
          setCurrentVersion(version?.toString());
          setDescription(description ?? '');
          setFollowers(followers ?? []);
          setOwner(owner);
          setTier(getTierTags(tags ?? []));
          setTags(getTagsWithoutTier(tags ?? []));
          setPartitions(partitions);
          setCleanupPolicies(cleanupPolicies ?? []);
          setMaximumMessageSize(maximumMessageSize ?? 0);
          setReplicationFactor(replicationFactor ?? 0);
          setRetentionSize(retentionSize ?? 0);
          setDeleted(deleted ?? false);
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

          setFollowers([...followers, ...newValue]);
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

          setFollowers(
            followers.filter((follower) => follower.id !== oldValue[0].id)
          );
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
        const { description = '', version } = response;
        setCurrentVersion(version + '');
        setTopicDetails(response);
        setDescription(description);
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
            setTopicDetails({ ...res, tags: res.tags ?? [] });
            setCurrentVersion(res.version?.toString());
            setOwner(res.owner);
            setTier(getTierTags((res.tags ?? []) as EntityTags[]));
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
          setTier(getTierTags(res.tags as TagLabel[]));
          setCurrentVersion(res.version?.toString());
          setTags(getTagsWithoutTier(res.tags as EntityTags[]));
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
    history.push(
      getVersionPath(EntityType.TOPIC, topicFQN, currentVersion as string)
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
        const { version, owner: ownerValue, tags } = data;
        setCurrentVersion(version?.toString());
        setTopicDetails(data);
        setOwner(ownerValue);
        setTier(getTierTags(tags ?? []));
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
    fetchTabSpecificData(topicDetailsTabs[activeTab - 1].field);
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
              cleanupPolicies={cleanupPolicies}
              createThread={createThread}
              deletePostHandler={deletePostHandler}
              deleted={deleted}
              description={description}
              descriptionUpdateHandler={descriptionUpdateHandler}
              entityFieldTaskCount={entityFieldTaskCount}
              entityFieldThreadCount={entityFieldThreadCount}
              entityName={name}
              entityThread={entityThread}
              feedCount={feedCount}
              fetchFeedHandler={handleFeedFetchFromFeedList}
              followTopicHandler={followTopic}
              followers={followers}
              isSampleDataLoading={isSampleDataLoading}
              isentityThreadLoading={isentityThreadLoading}
              lineageTabData={{
                loadNodeHandler,
                addLineageHandler,
                removeLineageHandler,
                entityLineageHandler,
                isLineageLoading,
                entityLineage,
                lineageLeafNodes: leafNodes,
                isNodeLoading,
              }}
              maximumMessageSize={maximumMessageSize}
              owner={owner as EntityReference}
              paging={paging}
              partitions={partitions}
              postFeedHandler={postFeedHandler}
              replicationFactor={replicationFactor}
              retentionSize={retentionSize}
              sampleData={sampleData}
              setActiveTabHandler={activeTabHandler}
              settingsUpdateHandler={settingsUpdateHandler}
              slashedTopicName={slashedTopicName}
              tagUpdateHandler={onTagUpdate}
              tier={tier as TagLabel}
              topicDetails={topicDetails}
              topicFQN={topicFQN}
              topicTags={tags}
              unfollowTopicHandler={unfollowTopic}
              updateThreadHandler={updateThreadHandler}
              version={currentVersion}
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
