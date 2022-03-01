/*
 *  Copyright 2021 Collate
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

import { AxiosError, AxiosResponse } from 'axios';
import { compare, Operation } from 'fast-json-patch';
import { isEmpty } from 'lodash';
import { observer } from 'mobx-react';
import {
  EntityTags,
  EntityThread,
  LeafNodes,
  LineagePos,
  LoadingNodeState,
  TableDetail,
} from 'Models';
import React, { useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import AppState from '../../AppState';
import {
  getAllFeeds,
  getFeedCount,
  postFeedById,
} from '../../axiosAPIs/feedsAPI';
import { getLineageByFQN } from '../../axiosAPIs/lineageAPI';
import { addLineage, deleteLineageEdge } from '../../axiosAPIs/miscAPI';
import {
  addFollower,
  getPipelineByFqn,
  patchPipelineDetails,
  removeFollower,
} from '../../axiosAPIs/pipelineAPI';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import { TitleBreadcrumbProps } from '../../components/common/title-breadcrumb/title-breadcrumb.interface';
import {
  Edge,
  EdgeData,
} from '../../components/EntityLineage/EntityLineage.interface';
import Loader from '../../components/Loader/Loader';
import PipelineDetails from '../../components/PipelineDetails/PipelineDetails.component';
import {
  getPipelineDetailsPath,
  getServiceDetailsPath,
  getVersionPath,
} from '../../constants/constants';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { ServiceCategory } from '../../enums/service.enum';
import {
  EntityReference,
  Pipeline,
  Task,
} from '../../generated/entity/data/pipeline';
import { User } from '../../generated/entity/teams/user';
import { EntityLineage } from '../../generated/type/entityLineage';
import { TagLabel } from '../../generated/type/tagLabel';
import useToastContext from '../../hooks/useToastContext';
import {
  addToRecentViewed,
  getCurrentUserId,
  getEntityMissingError,
} from '../../utils/CommonUtils';
import { getEntityFeedLink, getEntityLineage } from '../../utils/EntityUtils';
import {
  defaultFields,
  getCurrentPipelineTab,
  pipelineDetailsTabs,
} from '../../utils/PipelineDetailsUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import { getTagsWithoutTier, getTierTags } from '../../utils/TableUtils';

const PipelineDetailsPage = () => {
  const USERId = getCurrentUserId();
  const history = useHistory();
  const showToast = useToastContext();

  const { pipelineFQN, tab } = useParams() as Record<string, string>;
  const [pipelineDetails, setPipelineDetails] = useState<Pipeline>(
    {} as Pipeline
  );
  const [pipelineId, setPipelineId] = useState<string>('');
  const [isLoading, setLoading] = useState<boolean>(true);
  const [isLineageLoading, setIsLineageLoading] = useState<boolean>(false);
  const [description, setDescription] = useState<string>('');
  const [followers, setFollowers] = useState<Array<User>>([]);
  const [owner, setOwner] = useState<TableDetail['owner']>();
  const [tier, setTier] = useState<TagLabel>();
  const [tags, setTags] = useState<Array<EntityTags>>([]);
  const [activeTab, setActiveTab] = useState<number>(
    getCurrentPipelineTab(tab)
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pipelineUrl, setPipelineUrl] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [serviceType, setServiceType] = useState<string>('');
  const [slashedPipelineName, setSlashedPipelineName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [isNodeLoading, setNodeLoading] = useState<LoadingNodeState>({
    id: undefined,
    state: false,
  });

  const [entityLineage, setEntityLineage] = useState<EntityLineage>(
    {} as EntityLineage
  );
  const [leafNodes, setLeafNodes] = useState<LeafNodes>({} as LeafNodes);

  const [currentVersion, setCurrentVersion] = useState<string>();
  const [deleted, setDeleted] = useState<boolean>(false);
  const [isError, setIsError] = useState(false);

  const [entityThread, setEntityThread] = useState<EntityThread[]>([]);
  const [isentityThreadLoading, setIsentityThreadLoading] =
    useState<boolean>(false);
  const [feedCount, setFeedCount] = useState<number>(0);

  const activeTabHandler = (tabValue: number) => {
    const currentTabIndex = tabValue - 1;
    if (pipelineDetailsTabs[currentTabIndex].path !== tab) {
      setActiveTab(
        getCurrentPipelineTab(pipelineDetailsTabs[currentTabIndex].path)
      );
      history.push({
        pathname: getPipelineDetailsPath(
          pipelineFQN,
          pipelineDetailsTabs[currentTabIndex].path
        ),
      });
    }
  };

  useEffect(() => {
    if (pipelineDetailsTabs[activeTab - 1].path !== tab) {
      setActiveTab(getCurrentPipelineTab(tab));
    }
  }, [tab]);

  const saveUpdatedPipelineData = (
    updatedData: Pipeline
  ): Promise<AxiosResponse> => {
    const jsonPatch = compare(pipelineDetails, updatedData);

    return patchPipelineDetails(
      pipelineId,
      jsonPatch
    ) as unknown as Promise<AxiosResponse>;
  };

  const getLineageData = () => {
    setIsLineageLoading(true);
    getLineageByFQN(pipelineFQN, EntityType.PIPELINE)
      .then((res: AxiosResponse) => {
        setEntityLineage(res.data);
      })
      .catch((err: AxiosError) => {
        showToast({
          variant: 'error',
          body: err.message ?? 'Error while fetching lineage data',
        });
      })
      .finally(() => {
        setIsLineageLoading(false);
      });
  };

  const fetchPipelineDetail = (pipelineFQN: string) => {
    setLoading(true);
    getPipelineByFqn(pipelineFQN, defaultFields)
      .then((res: AxiosResponse) => {
        const {
          id,
          deleted,
          description,
          followers,
          fullyQualifiedName,
          service,
          serviceType,
          tags,
          owner,
          displayName,
          tasks,
          pipelineUrl,
          version,
        } = res.data;
        setDisplayName(displayName);
        setPipelineDetails(res.data);
        setCurrentVersion(version);
        setPipelineId(id);
        setDescription(description ?? '');
        setFollowers(followers);
        setOwner(owner);
        setTier(getTierTags(tags));
        setTags(getTagsWithoutTier(tags));
        setServiceType(serviceType);
        setDeleted(deleted);
        setSlashedPipelineName([
          {
            name: service.name,
            url: service.name
              ? getServiceDetailsPath(
                  service.name,
                  ServiceCategory.PIPELINE_SERVICES
                )
              : '',
            imgSrc: serviceType ? serviceTypeLogo(serviceType) : undefined,
          },
          {
            name: displayName,
            url: '',
            activeTitle: true,
          },
        ]);

        addToRecentViewed({
          displayName,
          entityType: EntityType.PIPELINE,
          fqn: fullyQualifiedName,
          serviceType: serviceType,
          timestamp: 0,
        });

        setPipelineUrl(pipelineUrl);
        setTasks(tasks);
      })
      .catch((err: AxiosError) => {
        if (err.response?.status === 404) {
          setIsError(true);
        } else {
          const errMsg = err.message || 'Error while fetching pipeline details';
          showToast({
            variant: 'error',
            body: errMsg,
          });
        }
      })
      .finally(() => setLoading(false));
  };

  const fetchTabSpecificData = (tabField = '') => {
    switch (tabField) {
      case TabSpecificField.LINEAGE: {
        if (!deleted) {
          if (isEmpty(entityLineage)) {
            getLineageData();
          }

          break;
        }

        break;
      }
      case TabSpecificField.ACTIVITY_FEED: {
        setIsentityThreadLoading(true);
        getAllFeeds(getEntityFeedLink(EntityType.PIPELINE, pipelineFQN))
          .then((res: AxiosResponse) => {
            const { data } = res.data;
            setEntityThread(data);
          })
          .catch(() => {
            showToast({
              variant: 'error',
              body: 'Error while fetching entity feeds',
            });
          })
          .finally(() => setIsentityThreadLoading(false));

        break;
      }

      default:
        break;
    }
  };

  const followPipeline = () => {
    addFollower(pipelineId, USERId)
      .then((res: AxiosResponse) => {
        const { newValue } = res.data.changeDescription.fieldsAdded[0];

        setFollowers([...followers, ...newValue]);
      })
      .catch((err: AxiosError) => {
        const errMsg =
          err.response?.data.message ||
          'Error while following pipeline entity.';
        showToast({
          variant: 'error',
          body: errMsg,
        });
      });
  };
  const unfollowPipeline = () => {
    removeFollower(pipelineId, USERId)
      .then((res: AxiosResponse) => {
        const { oldValue } = res.data.changeDescription.fieldsDeleted[0];

        setFollowers(
          followers.filter((follower) => follower.id !== oldValue[0].id)
        );
      })
      .catch((err: AxiosError) => {
        const errMsg =
          err.response?.data.message ||
          'Error while unfollowing pipeline entity.';
        showToast({
          variant: 'error',
          body: errMsg,
        });
      });
  };

  const descriptionUpdateHandler = (updatedPipeline: Pipeline) => {
    saveUpdatedPipelineData(updatedPipeline)
      .then((res: AxiosResponse) => {
        const { description, version } = res.data;
        setCurrentVersion(version);
        setPipelineDetails(res.data);
        setDescription(description);
      })
      .catch((err: AxiosError) => {
        const errMsg =
          err.response?.data.message || 'Error while updating description.';
        showToast({
          variant: 'error',
          body: errMsg,
        });
      });
  };

  const settingsUpdateHandler = (updatedPipeline: Pipeline): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      saveUpdatedPipelineData(updatedPipeline)
        .then((res) => {
          setPipelineDetails(res.data);
          setCurrentVersion(res.data.version);
          setOwner(res.data.owner);
          setTier(getTierTags(res.data.tags));
          resolve();
        })
        .catch((err: AxiosError) => {
          const errMsg =
            err.response?.data.message || 'Error while updating entity.';
          reject();
          showToast({
            variant: 'error',
            body: errMsg,
          });
        });
    });
  };

  const onTagUpdate = (updatedPipeline: Pipeline) => {
    saveUpdatedPipelineData(updatedPipeline)
      .then((res: AxiosResponse) => {
        setTier(getTierTags(res.data.tags));
        setCurrentVersion(res.data.version);
        setTags(getTagsWithoutTier(res.data.tags));
      })
      .catch((err: AxiosError) => {
        const errMsg =
          err.response?.data.message || 'Error while updating tags.';
        showToast({
          variant: 'error',
          body: errMsg,
        });
      });
  };

  const onTaskUpdate = (jsonPatch: Array<Operation>) => {
    patchPipelineDetails(pipelineId, jsonPatch).then((res: AxiosResponse) => {
      setTasks(res.data.tasks || []);
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
    getLineageByFQN(node.name, node.type).then((res: AxiosResponse) => {
      setLeafNode(res.data, pos);
      setEntityLineage(getEntityLineage(entityLineage, res.data, pos));
      setTimeout(() => {
        setNodeLoading((prev) => ({ ...prev, state: false }));
      }, 500);
    });
  };

  const versionHandler = () => {
    history.push(
      getVersionPath(EntityType.PIPELINE, pipelineFQN, currentVersion as string)
    );
  };

  const addLineageHandler = (edge: Edge): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      addLineage(edge)
        .then(() => {
          resolve();
        })
        .catch(() => {
          showToast({
            variant: 'error',
            body: `Error while adding adding new edge`,
          });
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
    ).catch(() => {
      showToast({
        variant: 'error',
        body: `Error while removing edge`,
      });
    });
  };

  const postFeedHandler = (value: string, id: string) => {
    const currentUser = AppState.userDetails?.name ?? AppState.users[0]?.name;

    const data = {
      message: value,
      from: currentUser,
    };
    postFeedById(id, data)
      .then((res: AxiosResponse) => {
        if (res.data) {
          const { id, posts } = res.data;
          setEntityThread((pre) => {
            return pre.map((thread) => {
              if (thread.id === id) {
                return { ...res.data, posts: posts.slice(-3) };
              } else {
                return thread;
              }
            });
          });
        }
      })
      .catch(() => {
        showToast({
          variant: 'error',
          body: 'Error while posting feed',
        });
      });
  };

  const getEntityFeedCount = () => {
    getFeedCount(getEntityFeedLink(EntityType.PIPELINE, pipelineFQN)).then(
      (res: AxiosResponse) => {
        setFeedCount(res.data.totalCount);
      }
    );
  };

  useEffect(() => {
    getEntityFeedCount();
  }, []);

  useEffect(() => {
    fetchTabSpecificData(pipelineDetailsTabs[activeTab - 1].field);
  }, [activeTab]);

  useEffect(() => {
    fetchPipelineDetail(pipelineFQN);
    setEntityLineage({} as EntityLineage);
  }, [pipelineFQN]);

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : isError ? (
        <ErrorPlaceHolder>
          {getEntityMissingError('pipeline', pipelineFQN)}
        </ErrorPlaceHolder>
      ) : (
        <PipelineDetails
          activeTab={activeTab}
          addLineageHandler={addLineageHandler}
          deleted={deleted}
          description={description}
          descriptionUpdateHandler={descriptionUpdateHandler}
          entityLineage={entityLineage}
          entityLineageHandler={entityLineageHandler}
          entityName={displayName}
          entityThread={entityThread}
          feedCount={feedCount}
          followPipelineHandler={followPipeline}
          followers={followers}
          isLineageLoading={isLineageLoading}
          isNodeLoading={isNodeLoading}
          isentityThreadLoading={isentityThreadLoading}
          lineageLeafNodes={leafNodes}
          loadNodeHandler={loadNodeHandler}
          owner={owner}
          pipelineDetails={pipelineDetails}
          pipelineTags={tags}
          pipelineUrl={pipelineUrl}
          postFeedHandler={postFeedHandler}
          removeLineageHandler={removeLineageHandler}
          serviceType={serviceType}
          setActiveTabHandler={activeTabHandler}
          settingsUpdateHandler={settingsUpdateHandler}
          slashedPipelineName={slashedPipelineName}
          tagUpdateHandler={onTagUpdate}
          taskUpdateHandler={onTaskUpdate}
          tasks={tasks}
          tier={tier as TagLabel}
          unfollowPipelineHandler={unfollowPipeline}
          users={AppState.users}
          version={currentVersion as string}
          versionHandler={versionHandler}
        />
      )}
    </>
  );
};

export default observer(PipelineDetailsPage);
