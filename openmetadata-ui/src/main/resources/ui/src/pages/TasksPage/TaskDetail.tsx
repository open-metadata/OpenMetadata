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

import { Card, Layout, Tabs } from 'antd';
import { AxiosError, AxiosResponse } from 'axios';
import classNames from 'classnames';
import { EntityTags } from 'Models';
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getTask } from '../../axiosAPIs/feedsAPI';
import { getTableDetailsByFQN } from '../../axiosAPIs/tableAPI';
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
import {
  TaskStatus,
  Thread as TaskDetail,
} from '../../generated/entity/feed/thread';
import { EntityReference } from '../../generated/type/entityReference';
import {
  getEntityName,
  getPartialNameFromTableFQN,
} from '../../utils/CommonUtils';
import { defaultFields } from '../../utils/DatasetDetailsUtils';
import { getEntityFQN } from '../../utils/FeedUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import { getTagsWithoutTier, getTierTags } from '../../utils/TableUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { background, cardStyles, contentStyles } from './TaskPage.styles';
import { EntityData } from './TasksPage.interface';

const TaskDetailPage = () => {
  const { Content, Sider } = Layout;
  const { TabPane } = Tabs;

  const { taskId } = useParams<{ [key: string]: string }>();

  const [taskDetail, setTaskDetail] = useState<TaskDetail>({} as TaskDetail);
  const [entityData, setEntityData] = useState<EntityData>({} as EntityData);

  const fetchTaskDetail = () => {
    getTask(taskId)
      .then((res: AxiosResponse) => {
        setTaskDetail(res.data);
      })
      .catch((err: AxiosError) => showErrorToast(err));
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

  const entityTier = useMemo(() => {
    const tierFQN = getTierTags(entityData.tags || [])?.tagFQN;

    return tierFQN?.split(FQN_SEPARATOR_CHAR)[1];
  }, [entityData.tags]);

  const entityTags = useMemo(() => {
    const tags: EntityTags[] = getTagsWithoutTier(entityData.tags || []) || [];

    return tags.map((tag) => `#${tag.tagFQN}`).join(' ');
  }, [entityData.tags]);

  useEffect(() => {
    fetchTaskDetail();
  }, [taskId]);

  useEffect(() => {
    if (taskDetail.about) {
      const entityFQN = getEntityFQN(taskDetail.about);

      entityFQN && fetchTableDetails(entityFQN);
    }
  }, [taskDetail]);

  return (
    <Layout style={background}>
      <Content style={contentStyles}>
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
        <Card key="task-details" style={{ ...cardStyles, marginTop: '32px' }}>
          <h6>
            {`#${taskId}`} {taskDetail.message}
          </h6>
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
          </p>
        </Card>
      </Content>
      <Sider className="ant-layout-sider-task-detail" width={600}>
        <Tabs className="ant-tabs-task-detail">
          <TabPane key="1" tab="Task">
            Content of Tab Pane 1
          </TabPane>
          <TabPane key="2" tab="Conversations">
            Content of Tab Pane 2
          </TabPane>
        </Tabs>
      </Sider>
    </Layout>
  );
};

export default TaskDetailPage;
