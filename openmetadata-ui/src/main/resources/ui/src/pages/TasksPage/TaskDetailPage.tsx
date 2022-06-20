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

import { Button, Card, Layout, Tabs } from 'antd';
import { AxiosError, AxiosResponse } from 'axios';
import classNames from 'classnames';
import { isEmpty, toLower } from 'lodash';
import { observer } from 'mobx-react';
import { EntityTags } from 'Models';
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import AppState from '../../AppState';
import { getFeedById, getTask, postFeedById } from '../../axiosAPIs/feedsAPI';
import { getTableDetailsByFQN } from '../../axiosAPIs/tableAPI';
import ActivityFeedEditor from '../../components/ActivityFeed/ActivityFeedEditor/ActivityFeedEditor';
import FeedPanelBody from '../../components/ActivityFeed/ActivityFeedPanel/FeedPanelBody';
import ActivityThreadPanelBody from '../../components/ActivityFeed/ActivityThreadPanel/ActivityThreadPanelBody';
import ProfilePicture from '../../components/common/ProfilePicture/ProfilePicture';
import TitleBreadcrumb from '../../components/common/title-breadcrumb/title-breadcrumb.component';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import {
  getDatabaseDetailsPath,
  getDatabaseSchemaDetailsPath,
  getServiceDetailsPath,
} from '../../constants/constants';
import { FqnPart } from '../../enums/entity.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { TaskStatus, Thread } from '../../generated/entity/feed/thread';
import { EntityReference } from '../../generated/type/entityReference';
import {
  getEntityName,
  getPartialNameFromTableFQN,
} from '../../utils/CommonUtils';
import { defaultFields } from '../../utils/DatasetDetailsUtils';
import { getEntityFQN } from '../../utils/FeedUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import { getTagsWithoutTier, getTierTags } from '../../utils/TableUtils';
import { fetchOptions } from '../../utils/TasksUtils';
import { getDayTimeByTimeStamp } from '../../utils/TimeUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import Assignees from './Assignees';
import { background, cardStyles, contentStyles } from './TaskPage.styles';
import { EntityData, Option } from './TasksPage.interface';
import { DescriptionTabs } from './UpdateDescriptionPage';

const TaskDetailPage = () => {
  const { Content, Sider } = Layout;
  const { TabPane } = Tabs;

  const { taskId } = useParams<{ [key: string]: string }>();

  const [taskDetail, setTaskDetail] = useState<Thread>({} as Thread);
  const [taskFeedDetail, setTaskFeedDetail] = useState<Thread>({} as Thread);
  const [entityData, setEntityData] = useState<EntityData>({} as EntityData);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [options, setOptions] = useState<Option[]>([]);
  const [assignees, setAssignees] = useState<Array<Option>>([]);

  const fetchTaskDetail = () => {
    getTask(taskId)
      .then((res: AxiosResponse) => {
        setTaskDetail(res.data);
      })
      .catch((err: AxiosError) => showErrorToast(err));
  };

  const fetchTaskFeed = (id: string) => {
    setIsLoading(true);
    getFeedById(id)
      .then((res: AxiosResponse) => {
        setTaskFeedDetail(res.data);
      })
      .catch((err: AxiosError) => {
        showErrorToast(err);
      })
      .finally(() => setIsLoading(false));
  };

  const fetchTableDetails = (entityFQN: string) => {
    getTableDetailsByFQN(entityFQN, defaultFields)
      .then((res: AxiosResponse) => {
        setEntityData(res.data);
      })
      .catch((err: AxiosError) => {
        showErrorToast(err);
      });
  };

  const getBreadCrumb = () => {
    return [
      {
        name: getEntityName(entityData.service),
        url: getEntityName(entityData.service)
          ? getServiceDetailsPath(
              entityData.service.name || '',
              ServiceCategory.DATABASE_SERVICES
            )
          : '',
        imgSrc: entityData.serviceType
          ? serviceTypeLogo(entityData.serviceType || '')
          : undefined,
      },
      {
        name: getPartialNameFromTableFQN(
          entityData.database?.fullyQualifiedName || '',
          [FqnPart.Database]
        ),
        url: getDatabaseDetailsPath(
          entityData.database?.fullyQualifiedName || ''
        ),
      },
      {
        name: getPartialNameFromTableFQN(
          entityData.databaseSchema?.fullyQualifiedName || '',
          [FqnPart.Schema]
        ),
        url: getDatabaseSchemaDetailsPath(
          entityData.databaseSchema?.fullyQualifiedName || ''
        ),
      },
      {
        name: getEntityName(entityData as unknown as EntityReference),
        url: '',
        activeTitle: true,
      },
    ];
  };

  const onSearch = (query: string) => {
    fetchOptions(query, setOptions);
  };

  // get current user details
  const currentUser = useMemo(
    () => AppState.getCurrentUserDetails(),
    [AppState.userDetails, AppState.nonSecureUserDetails]
  );

  const entityTier = useMemo(() => {
    const tierFQN = getTierTags(entityData.tags || [])?.tagFQN;

    return tierFQN?.split(FQN_SEPARATOR_CHAR)[1];
  }, [entityData.tags]);

  const entityTags = useMemo(() => {
    const tags: EntityTags[] = getTagsWithoutTier(entityData.tags || []) || [];

    return tags.map((tag) => `#${tag.tagFQN}`).join('  ');
  }, [entityData.tags]);

  const onPostReply = (value: string) => {
    const data = {
      message: value,
      from: currentUser?.name,
    };
    postFeedById(taskFeedDetail.id, data)
      .then((res: AxiosResponse) => {
        const { posts } = res.data;
        setTaskFeedDetail((prev) => ({ ...prev, posts }));
      })
      .catch((err: AxiosError) => {
        showErrorToast(err);
      });
  };

  useEffect(() => {
    fetchTaskDetail();
  }, [taskId]);

  useEffect(() => {
    if (!isEmpty(taskDetail)) {
      const entityFQN = getEntityFQN(taskDetail.about);

      entityFQN && fetchTableDetails(entityFQN);
      fetchTaskFeed(taskDetail.id);
    }
  }, [taskDetail]);

  useEffect(() => {
    const owner = entityData.owner;
    if (owner) {
      setAssignees([
        {
          label: getEntityName(owner),
          value: owner.name || '',
          type: owner.type,
        },
      ]);
    }
  }, [entityData]);

  const fn = () => {
    return;
  };

  return (
    <Layout style={{ ...background, height: '100vh' }}>
      <Content style={{ ...contentStyles, overflowY: 'auto' }}>
        <TitleBreadcrumb titleLinks={getBreadCrumb()} />

        <div className="tw-flex tw-ml-6">
          <span className="tw-text-grey-muted">Owner:</span>{' '}
          <span>
            {entityData.owner ? (
              <span className="tw-flex tw-ml-1">
                <ProfilePicture
                  displayName={getEntityName(entityData.owner)}
                  id=""
                  name={getEntityName(entityData.owner)}
                  width="20"
                />
                <span className="tw-ml-1">
                  {getEntityName(entityData.owner)}
                </span>
              </span>
            ) : (
              <span className="tw-text-grey-muted tw-ml-1">No Owner</span>
            )}
          </span>
          <span className="tw-mx-1.5 tw-inline-block tw-text-gray-400">|</span>
          <p data-testid="tier">
            {entityTier ? (
              entityTier
            ) : (
              <span className="tw-text-grey-muted">No Tier</span>
            )}
          </p>
        </div>
        <p className="tw-ml-6" data-testid="tags">
          {entityTags}
        </p>
        <Card key="task-details" style={{ ...cardStyles, marginTop: '16px' }}>
          <h6>
            {`#${taskId}`} {taskDetail.message}
          </h6>
          <div data-testid="assignees">
            <span className="tw-text-grey-muted">Assignees:</span>{' '}
            <Assignees
              assignees={assignees}
              options={options}
              onChange={setAssignees}
              onSearch={onSearch}
            />
          </div>
          <p>
            <span
              className={classNames(
                'tw-inline-block tw-w-2 tw-h-2 tw-rounded-full',
                {
                  'tw-bg-green-500':
                    taskDetail.task?.status === TaskStatus.Open,
                },
                {
                  'tw-bg-red-500':
                    taskDetail.task?.status === TaskStatus.Closed,
                }
              )}
            />
            <span className="tw-ml-1">{taskDetail.task?.status}</span>
            <span className="tw-mx-1.5 tw-inline-block tw-text-gray-400">
              |
            </span>
            <span>
              <span className="tw-font-semibold tw-cursor-pointer hover:tw-underline">
                {taskDetail.createdBy}
              </span>{' '}
              created this task{' '}
              {toLower(getDayTimeByTimeStamp(taskDetail.threadTs as number))}
            </span>
          </p>
          <div data-testid="description-tabs">
            <span>Description:</span>{' '}
            <DescriptionTabs
              description={entityData.description || ''}
              suggestion={taskDetail.task?.suggestion || ''}
            />
          </div>
          <div className="tw-flex tw-justify-end" data-testid="cta-buttons">
            <Button className="ant-btn-link-custom" type="link">
              Reject
            </Button>
            <Button className="ant-btn-primary-custom" type="primary">
              Submit
            </Button>
          </div>
        </Card>
      </Content>
      <Sider className="ant-layout-sider-task-detail" width={600}>
        <Tabs className="ant-tabs-task-detail">
          <TabPane key="1" tab="Task">
            {!isEmpty(taskFeedDetail) ? (
              <div id="task-feed">
                <FeedPanelBody
                  isLoading={isLoading}
                  threadData={taskFeedDetail}
                  updateThreadHandler={() => {
                    return;
                  }}
                />
                <ActivityFeedEditor
                  buttonClass="tw-mr-4"
                  className="tw-ml-5 tw-mr-2 tw-mb-2"
                  onSave={onPostReply}
                />
              </div>
            ) : null}
          </TabPane>
          <TabPane key="2" tab="Conversations">
            {!isEmpty(taskFeedDetail) ? (
              <ActivityThreadPanelBody
                className="tw-p-0"
                createThread={() => fn()}
                deletePostHandler={() => fn()}
                postFeedHandler={() => fn()}
                showHeader={false}
                threadLink={taskFeedDetail.about}
                updateThreadHandler={() => fn()}
              />
            ) : null}
          </TabPane>
        </Tabs>
      </Sider>
    </Layout>
  );
};

export default observer(TaskDetailPage);
