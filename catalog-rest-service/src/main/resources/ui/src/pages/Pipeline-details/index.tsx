import { AxiosPromise, AxiosResponse } from 'axios';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { EntityTags, TableDetail } from 'Models';
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AppState from '../../AppState';
import { getLineageByFQN } from '../../axiosAPIs/lineageAPI';
import {
  addFollower,
  getPipelineByFqn,
  patchPipelineDetails,
  removeFollower,
} from '../../axiosAPIs/pipelineAPI';
import { getServiceById } from '../../axiosAPIs/serviceAPI';
import { getTaskById, updateTask } from '../../axiosAPIs/taskAPI';
import Description from '../../components/common/description/Description';
import EntityPageInfo from '../../components/common/entityPageInfo/EntityPageInfo';
import NonAdminAction from '../../components/common/non-admin-action/NonAdminAction';
import RichTextEditorPreviewer from '../../components/common/rich-text-editor/RichTextEditorPreviewer';
import TabsPane from '../../components/common/TabsPane/TabsPane';
import { TitleBreadcrumbProps } from '../../components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainer from '../../components/containers/PageContainer';
import Entitylineage from '../../components/EntityLineage/EntityLineage.component';
import Loader from '../../components/Loader/Loader';
import ManageTab from '../../components/ManageTab/ManageTab.component';
import { ModalWithMarkdownEditor } from '../../components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import TagsContainer from '../../components/tags-container/tags-container';
import Tags from '../../components/tags/tags';
import {
  getServiceDetailsPath,
  getTeamDetailsPath,
} from '../../constants/constants';
import { EntityType } from '../../enums/entity.enum';
import { Pipeline, Task } from '../../generated/entity/data/pipeline';
import { User } from '../../generated/entity/teams/user';
import { EntityLineage } from '../../generated/type/entityLineage';
import { TagLabel } from '../../generated/type/tagLabel';
import { useAuth } from '../../hooks/authHooks';
import {
  addToRecentViewed,
  getCurrentUserId,
  getHtmlForNonAdminAction,
  getUserTeams,
  isEven,
} from '../../utils/CommonUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import SVGIcons from '../../utils/SvgUtils';
import {
  getOwnerFromId,
  getTagsWithoutTier,
  getTierFromTableTags,
} from '../../utils/TableUtils';
import { getTagCategories, getTaglist } from '../../utils/TagsUtils';

const MyPipelinePage = () => {
  const USERId = getCurrentUserId();

  const { isAuthDisabled } = useAuth();

  const [tagList, setTagList] = useState<Array<string>>([]);
  const { pipelineFQN } = useParams() as Record<string, string>;
  const [pipelineDetails, setPipelineDetails] = useState<Pipeline>(
    {} as Pipeline
  );
  const [pipelineId, setPipelineId] = useState<string>('');
  const [isLoading, setLoading] = useState<boolean>(false);
  const [description, setDescription] = useState<string>('');
  const [followers, setFollowers] = useState<Array<User>>([]);
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [owner, setOwner] = useState<TableDetail['owner']>();
  const [tier, setTier] = useState<string>();
  const [tags, setTags] = useState<Array<EntityTags>>([]);
  const [activeTab, setActiveTab] = useState<number>(1);
  const [isEdit, setIsEdit] = useState<boolean>(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pipelineUrl, setPipelineUrl] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [serviceType, setServiceType] = useState<string>('');
  // const [usage, setUsage] = useState('');
  // const [weeklyUsageCount, setWeeklyUsageCount] = useState('');
  const [slashedPipelineName, setSlashedPipelineName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);

  const [editTask, setEditTask] = useState<{
    task: Task;
    index: number;
  }>();
  const [editTaskTags, setEditTaskTags] = useState<{
    task: Task;
    index: number;
  }>();
  const [entityLineage, setEntityLineage] = useState<EntityLineage>(
    {} as EntityLineage
  );
  const hasEditAccess = () => {
    if (owner?.type === 'user') {
      return owner.id === getCurrentUserId();
    } else {
      return getUserTeams().some((team) => team.id === owner?.id);
    }
  };
  const tabs = [
    {
      name: 'Details',
      icon: {
        alt: 'schema',
        name: 'icon-schema',
        title: 'Details',
      },
      isProtected: false,
      position: 1,
    },
    {
      name: 'Lineage',
      icon: {
        alt: 'lineage',
        name: 'icon-lineage',
        title: 'Lineage',
      },
      isProtected: false,
      position: 2,
    },
    {
      name: 'Manage',
      icon: {
        alt: 'manage',
        name: 'icon-manage',
        title: 'Manage',
      },
      isProtected: true,
      protectedState: !owner || hasEditAccess(),
      position: 3,
    },
  ];

  const extraInfo = [
    {
      key: 'Owner',
      value:
        owner?.type === 'team'
          ? getTeamDetailsPath(owner?.name || '')
          : owner?.name || '',
      placeholderText: owner?.displayName || '',
      isLink: owner?.type === 'team',
      openInNewTab: false,
    },
    { key: 'Tier', value: tier ? tier.split('.')[1] : '' },
    {
      key: `${serviceType} Url`,
      value: pipelineUrl,
      placeholderText: displayName,
      isLink: true,
      openInNewTab: true,
    },
    // { key: 'Usage', value: usage },
    // { key: 'Queries', value: `${weeklyUsageCount} past week` },
  ];
  const fetchTags = () => {
    getTagCategories().then((res) => {
      if (res.data) {
        setTagList(getTaglist(res.data));
      }
    });
  };

  const fetchTasks = async (tasks: Pipeline['tasks']) => {
    let tasksData: Task[] = [];
    let promiseArr: Array<AxiosPromise> = [];
    if (tasks?.length) {
      promiseArr = tasks.map((task) =>
        getTaskById(task.id, ['service', 'tags'])
      );
      await Promise.allSettled(promiseArr).then(
        (res: PromiseSettledResult<AxiosResponse>[]) => {
          if (res.length) {
            tasksData = res
              .filter((task) => task.status === 'fulfilled')
              .map(
                (task) =>
                  (task as PromiseFulfilledResult<AxiosResponse>).value.data
              );
          }
        }
      );
    }

    return tasksData;
  };

  const setFollowersData = (followers: Array<User>) => {
    // need to check if already following or not with logedIn user id
    setIsFollowing(followers.some(({ id }: { id: string }) => id === USERId));
    setFollowersCount(followers?.length);
  };

  const fetchPipelineDetail = (pipelineFQN: string) => {
    setLoading(true);
    getPipelineByFqn(pipelineFQN, [
      'owner',
      'service',
      'followers',
      'tags',
      'usageSummary',
      'tasks',
    ]).then((res: AxiosResponse) => {
      const {
        id,
        description,
        followers,
        fullyQualifiedName,
        service,
        tags,
        owner,
        displayName,
        tasks,
        pipelineUrl,
        // usageSummary,
      } = res.data;
      setDisplayName(displayName);
      setPipelineDetails(res.data);
      setPipelineId(id);
      setDescription(description ?? '');
      setFollowers(followers);
      setFollowersData(followers);
      setOwner(getOwnerFromId(owner?.id));
      setTier(getTierFromTableTags(tags));
      setTags(getTagsWithoutTier(tags));
      getServiceById('pipelineServices', service?.id).then(
        (serviceRes: AxiosResponse) => {
          setServiceType(serviceRes.data.serviceType);
          setSlashedPipelineName([
            {
              name: serviceRes.data.name,
              url: serviceRes.data.name
                ? getServiceDetailsPath(
                    serviceRes.data.name,
                    serviceRes.data.serviceType
                  )
                : '',
              imgSrc: serviceRes.data.serviceType
                ? serviceTypeLogo(serviceRes.data.serviceType)
                : undefined,
            },
            {
              name: displayName,
              url: '',
              activeTitle: true,
            },
          ]);

          addToRecentViewed({
            entityType: EntityType.PIPELINE,
            fqn: fullyQualifiedName,
            serviceType: serviceRes.data.serviceType,
            timestamp: 0,
          });
        }
      );
      setPipelineUrl(pipelineUrl);
      fetchTasks(tasks).then((tasks) => setTasks(tasks));
      // if (!isNil(usageSummary?.weeklyStats.percentileRank)) {
      //   const percentile = getUsagePercentile(
      //     usageSummary.weeklyStats.percentileRank
      //   );
      //   setUsage(percentile);
      // } else {
      //   setUsage('--');
      // }
      // setWeeklyUsageCount(
      //   usageSummary?.weeklyStats.count.toLocaleString() || '--'
      // );

      setLoading(false);
    });
  };

  const followPipeline = (): void => {
    if (isFollowing) {
      removeFollower(pipelineId, USERId).then((res: AxiosResponse) => {
        const { followers } = res.data;
        setFollowers(followers);
        setFollowersCount((preValu) => preValu - 1);
        setIsFollowing(false);
      });
    } else {
      addFollower(pipelineId, USERId).then((res: AxiosResponse) => {
        const { followers } = res.data;
        setFollowers(followers);
        setFollowersCount((preValu) => preValu + 1);
        setIsFollowing(true);
      });
    }
  };

  const onDescriptionUpdate = (updatedHTML: string) => {
    const updatedPipeline = { ...pipelineDetails, description: updatedHTML };

    const jsonPatch = compare(pipelineDetails, updatedPipeline);
    patchPipelineDetails(pipelineId, jsonPatch).then((res: AxiosResponse) => {
      setDescription(res.data.description);
    });
    setIsEdit(false);
  };
  const onDescriptionEdit = (): void => {
    setIsEdit(true);
  };
  const onCancel = () => {
    setIsEdit(false);
  };

  const onSettingsUpdate = (
    newOwner?: TableDetail['owner'],
    newTier?: TableDetail['tier']
  ): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      if (newOwner || newTier) {
        const tierTag: TableDetail['tags'] = newTier
          ? [
              ...getTagsWithoutTier(pipelineDetails.tags as EntityTags[]),
              { tagFQN: newTier, labelType: 'Manual', state: 'Confirmed' },
            ]
          : (pipelineDetails.tags as EntityTags[]);
        const updatedPipeline = {
          ...pipelineDetails,
          owner: newOwner
            ? { ...pipelineDetails.owner, ...newOwner }
            : pipelineDetails.owner,
          tags: tierTag,
        };
        const jsonPatch = compare(pipelineDetails, updatedPipeline);
        patchPipelineDetails(pipelineId, jsonPatch)
          .then((res: AxiosResponse) => {
            setPipelineDetails(res.data);
            setOwner(getOwnerFromId(res.data.owner?.id));
            setTier(getTierFromTableTags(res.data.tags));
            resolve();
          })
          .catch(() => reject());
      } else {
        reject();
      }
    });
  };

  const onTagUpdate = (selectedTags?: Array<string>) => {
    if (selectedTags) {
      const prevTags = pipelineDetails?.tags?.filter((tag) =>
        selectedTags.includes(tag?.tagFQN as string)
      );
      const newTags: Array<EntityTags> = selectedTags
        .filter((tag) => {
          return !prevTags?.map((prevTag) => prevTag.tagFQN).includes(tag);
        })
        .map((tag) => ({
          labelType: 'Manual',
          state: 'Confirmed',
          tagFQN: tag,
        }));
      const updatedTags = [...(prevTags as TagLabel[]), ...newTags];
      const updatedPipeline = { ...pipelineDetails, tags: updatedTags };
      const jsonPatch = compare(pipelineDetails, updatedPipeline);
      patchPipelineDetails(pipelineId, jsonPatch).then((res: AxiosResponse) => {
        setTier(getTierFromTableTags(res.data.tags));
        setTags(getTagsWithoutTier(res.data.tags));
      });
    }
  };

  const handleUpdateTask = (task: Task, index: number) => {
    setEditTask({ task, index });
  };

  const closeEditTaskModal = (): void => {
    setEditTask(undefined);
  };

  const onTaskUpdate = (taskDescription: string) => {
    if (editTask) {
      const updatedTask = {
        ...editTask.task,
        description: taskDescription,
      };
      const jsonPatch = compare(tasks[editTask.index], updatedTask);
      updateTask(editTask.task.id, jsonPatch).then((res: AxiosResponse) => {
        if (res.data) {
          setTasks((prevTasks) => {
            const tasks = [...prevTasks];
            tasks[editTask.index] = res.data;

            return tasks;
          });
        }
      });
      setEditTask(undefined);
    } else {
      setEditTask(undefined);
    }
  };

  const handleEditTaskTag = (task: Task, index: number): void => {
    setEditTaskTags({ task, index });
  };

  const handleTaskTagSelection = (selectedTags?: Array<EntityTags>) => {
    if (selectedTags && editTaskTags) {
      const prevTags = editTaskTags.task.tags?.filter((tag) =>
        selectedTags.some((selectedTag) => selectedTag.tagFQN === tag.tagFQN)
      );
      const newTags = selectedTags
        .filter(
          (selectedTag) =>
            !editTaskTags.task.tags?.some(
              (tag) => tag.tagFQN === selectedTag.tagFQN
            )
        )
        .map((tag) => ({
          labelType: 'Manual',
          state: 'Confirmed',
          tagFQN: tag.tagFQN,
        }));

      const updatedTask = {
        ...editTaskTags.task,
        tags: [...(prevTags as TagLabel[]), ...newTags],
      };
      const jsonPatch = compare(tasks[editTaskTags.index], updatedTask);
      updateTask(editTaskTags.task.id, jsonPatch).then((res: AxiosResponse) => {
        if (res.data) {
          setTasks((prevTasks) => {
            const tasks = [...prevTasks];
            tasks[editTaskTags.index] = res.data;

            return tasks;
          });
        }
      });
      setEditTaskTags(undefined);
    } else {
      setEditTaskTags(undefined);
    }
  };

  useEffect(() => {
    fetchPipelineDetail(pipelineFQN);
    setActiveTab(1);
    getLineageByFQN(pipelineFQN, EntityType.PIPELINE).then(
      (res: AxiosResponse) => setEntityLineage(res.data)
    );
  }, [pipelineFQN]);

  useEffect(() => {
    if (isAuthDisabled && AppState.users.length && followers.length) {
      setFollowersData(followers);
    }
  }, [AppState.users, followers]);

  useEffect(() => {
    fetchTags();
  }, []);

  return (
    <PageContainer>
      {isLoading ? (
        <Loader />
      ) : (
        <div className="tw-px-4 tw-w-full tw-h-full tw-flex tw-flex-col">
          <EntityPageInfo
            isTagEditable
            entityName={displayName}
            extraInfo={extraInfo}
            followers={followersCount}
            followersList={followers}
            followHandler={followPipeline}
            hasEditAccess={hasEditAccess()}
            isFollowing={isFollowing}
            owner={owner}
            tagList={tagList}
            tags={tags}
            tagsHandler={onTagUpdate}
            tier={tier || ''}
            titleLinks={slashedPipelineName}
          />
          <div className="tw-mt-1 tw-flex tw-flex-col tw-flex-grow">
            <TabsPane
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              tabs={tabs}
            />

            <div className="tw-bg-white tw-flex-grow ">
              {activeTab === 1 && (
                <>
                  <div className="tw-grid tw-grid-cols-4 tw-gap-4 tw-w-full tw-mt-4">
                    <div className="tw-col-span-full">
                      <Description
                        description={description}
                        entityName={displayName}
                        hasEditAccess={hasEditAccess()}
                        isEdit={isEdit}
                        owner={owner}
                        onCancel={onCancel}
                        onDescriptionEdit={onDescriptionEdit}
                        onDescriptionUpdate={onDescriptionUpdate}
                      />
                    </div>
                  </div>
                  <div className="tw-table-responsive tw-my-6">
                    <table className="tw-w-full" data-testid="schema-table">
                      <thead>
                        <tr className="tableHead-row">
                          <th className="tableHead-cell">Task Name</th>
                          <th className="tableHead-cell">Description</th>
                          <th className="tableHead-cell tw-w-60">Tags</th>
                        </tr>
                      </thead>
                      <tbody className="tableBody">
                        {tasks.map((task, index) => (
                          <tr
                            className={classNames(
                              'tableBody-row',
                              !isEven(index + 1) ? 'odd-row' : null
                            )}
                            key={index}>
                            <td className="tableBody-cell">
                              <Link
                                target="_blank"
                                to={{ pathname: task.taskUrl }}>
                                <span className="tw-flex">
                                  <span className="tw-mr-1">
                                    {task.displayName}
                                  </span>
                                  <SVGIcons
                                    alt="external-link"
                                    className="tw-align-middle"
                                    icon="external-link"
                                    width="12px"
                                  />
                                </span>
                              </Link>
                            </td>
                            <td className="tw-group tableBody-cell tw-relative">
                              <div
                                className="tw-cursor-pointer hover:tw-underline tw-flex"
                                data-testid="description"
                                onClick={() => handleUpdateTask(task, index)}>
                                <div>
                                  {task.description ? (
                                    <RichTextEditorPreviewer
                                      markdown={task.description}
                                    />
                                  ) : (
                                    <span className="tw-no-description">
                                      No description added
                                    </span>
                                  )}
                                </div>
                                <button className="tw-self-start tw-w-8 tw-h-auto tw-opacity-0 tw-ml-1 group-hover:tw-opacity-100 focus:tw-outline-none">
                                  <SVGIcons
                                    alt="edit"
                                    icon="icon-edit"
                                    title="Edit"
                                    width="10px"
                                  />
                                </button>
                              </div>
                            </td>
                            <td
                              className="tw-group tw-relative tableBody-cell"
                              onClick={() => {
                                if (!editTaskTags) {
                                  handleEditTaskTag(task, index);
                                }
                              }}>
                              <NonAdminAction
                                html={getHtmlForNonAdminAction(Boolean(owner))}
                                isOwner={hasEditAccess()}
                                position="left"
                                trigger="click">
                                <TagsContainer
                                  editable={editTaskTags?.index === index}
                                  selectedTags={task.tags as EntityTags[]}
                                  tagList={tagList}
                                  onCancel={() => {
                                    handleTaskTagSelection();
                                  }}
                                  onSelectionChange={(tags) => {
                                    handleTaskTagSelection(tags);
                                  }}>
                                  {task.tags?.length ? (
                                    <button className="tw-opacity-0 tw-ml-1 group-hover:tw-opacity-100 focus:tw-outline-none">
                                      <SVGIcons
                                        alt="edit"
                                        icon="icon-edit"
                                        title="Edit"
                                        width="10px"
                                      />
                                    </button>
                                  ) : (
                                    <span className="tw-opacity-0 group-hover:tw-opacity-100">
                                      <Tags
                                        className="tw-border-main"
                                        tag="+ Add tag"
                                        type="outlined"
                                      />
                                    </span>
                                  )}
                                </TagsContainer>
                              </NonAdminAction>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {activeTab === 2 && (
                <div className="tw-h-full">
                  <Entitylineage entityLineage={entityLineage} />
                </div>
              )}
              {activeTab === 3 && (
                <div className="tw-mt-4">
                  <ManageTab
                    currentTier={tier}
                    currentUser={owner?.id}
                    hasEditAccess={hasEditAccess()}
                    onSave={onSettingsUpdate}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {editTask && (
        <ModalWithMarkdownEditor
          header={`Edit Task: "${editTask.task.displayName}"`}
          placeholder="Enter Task Description"
          value={editTask.task.description || ''}
          onCancel={closeEditTaskModal}
          onSave={onTaskUpdate}
        />
      )}
    </PageContainer>
  );
};

export default MyPipelinePage;
