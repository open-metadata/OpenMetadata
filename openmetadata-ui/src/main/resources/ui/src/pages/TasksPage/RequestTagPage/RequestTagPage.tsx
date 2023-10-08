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

import { Button, Form, FormProps, Input, Space, Typography } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { AxiosError } from 'axios';
import { observer } from 'mobx-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import AppState from '../../../AppState';
import { ActivityFeedTabs } from '../../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import ResizablePanels from '../../../components/common/ResizablePanels/ResizablePanels';
import TitleBreadcrumb from '../../../components/common/title-breadcrumb/title-breadcrumb.component';
import ExploreSearchCard from '../../../components/ExploreV1/ExploreSearchCard/ExploreSearchCard';
import { SearchedDataProps } from '../../../components/searched-data/SearchedData.interface';
import { EntityField } from '../../../constants/Feeds.constants';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import {
  CreateThread,
  TaskType,
} from '../../../generated/api/feed/createThread';
import { ThreadType } from '../../../generated/entity/feed/thread';
import { TagLabel } from '../../../generated/type/tagLabel';
import { postThread } from '../../../rest/feedsAPI';
import { getEntityDetailLink } from '../../../utils/CommonUtils';
import {
  ENTITY_LINK_SEPARATOR,
  getEntityFeedLink,
  getEntityName,
} from '../../../utils/EntityUtils';
import { getDecodedFqn } from '../../../utils/StringsUtils';
import {
  fetchEntityDetail,
  fetchOptions,
  getBreadCrumbList,
} from '../../../utils/TasksUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import Assignees from '../shared/Assignees';
import TagSuggestion from '../shared/TagSuggestion';
import '../TaskPage.style.less';
import { EntityData, Option } from '../TasksPage.interface';

const RequestTag = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const history = useHistory();
  const [form] = useForm();
  const { entityType, fqn: entityFQN } =
    useParams<{ fqn: string; entityType: EntityType }>();
  const queryParams = new URLSearchParams(location.search);

  const field = queryParams.get('field');
  const value = queryParams.get('value');

  const [entityData, setEntityData] = useState<EntityData>({} as EntityData);
  const [options, setOptions] = useState<Option[]>([]);
  const [assignees, setAssignees] = useState<Option[]>([]);
  const [suggestion] = useState<TagLabel[]>([]);

  const getSanitizeValue = value?.replaceAll(/^"|"$/g, '') || '';

  const message = `Request tags for ${getSanitizeValue || entityType} ${
    field !== EntityField.COLUMNS ? getEntityName(entityData) : ''
  }`;

  const decodedEntityFQN = useMemo(
    () => getDecodedFqn(entityFQN),
    [entityType]
  );

  // get current user details
  const currentUser = useMemo(
    () => AppState.getCurrentUserDetails(),
    [AppState.userDetails, AppState.nonSecureUserDetails]
  );

  const back = () => history.goBack();

  const onSearch = (query: string) => {
    fetchOptions(query, setOptions);
  };

  const getTaskAbout = () => {
    if (field && value) {
      return `${field}${ENTITY_LINK_SEPARATOR}${value}${ENTITY_LINK_SEPARATOR}tags`;
    } else {
      return EntityField.TAGS;
    }
  };

  const onCreateTask: FormProps['onFinish'] = (value) => {
    const data: CreateThread = {
      from: currentUser?.name as string,
      message: value.title || message,
      about: getEntityFeedLink(entityType, decodedEntityFQN, getTaskAbout()),
      taskDetails: {
        assignees: assignees.map((assignee) => ({
          id: assignee.value,
          type: assignee.type,
        })),
        suggestion: JSON.stringify(value.suggestTags),
        type: TaskType.RequestTag,
        oldValue: '[]',
      },
      type: ThreadType.Task,
    };
    postThread(data)
      .then(() => {
        showSuccessToast(
          t('server.create-entity-success', {
            entity: t('label.task'),
          })
        );
        history.push(
          getEntityDetailLink(
            entityType,
            decodedEntityFQN,
            EntityTabs.ACTIVITY_FEED,
            ActivityFeedTabs.TASKS
          )
        );
      })
      .catch((err: AxiosError) => showErrorToast(err));
  };

  useEffect(() => {
    fetchEntityDetail(entityType, entityFQN, setEntityData);
  }, [entityFQN, entityType]);

  useEffect(() => {
    const owner = entityData.owner;
    let defaultAssignee: Option[] = [];
    if (owner) {
      defaultAssignee = [
        {
          label: getEntityName(owner),
          value: owner.id || '',
          type: owner.type,
        },
      ];
      setAssignees(defaultAssignee);
      setOptions((prev) => [...defaultAssignee, ...prev]);
    }
    form.setFieldsValue({
      title: message.trimEnd(),
      assignees: defaultAssignee,
    });
  }, [entityData]);

  return (
    <ResizablePanels
      firstPanel={{
        minWidth: 700,
        flex: 0.6,
        children: (
          <div className="max-width-md w-9/10 m-x-auto m-y-md d-grid gap-4">
            <TitleBreadcrumb
              titleLinks={[
                ...getBreadCrumbList(entityData, entityType),
                {
                  name: t('label.create-entity', {
                    entity: t('label.task'),
                  }),
                  activeTitle: true,
                  url: '',
                },
              ]}
            />
            <div className="m-t-0 request-tags" key="request-tags">
              <Typography.Paragraph
                className="text-base"
                data-testid="form-title">
                {t('label.create-entity', {
                  entity: t('label.task'),
                })}
              </Typography.Paragraph>
              <Form
                form={form}
                initialValues={{
                  suggestTags: [],
                }}
                layout="vertical"
                onFinish={onCreateTask}>
                <Form.Item
                  data-testid="title"
                  label={`${t('label.task-entity', {
                    entity: t('label.title'),
                  })}:`}
                  name="title">
                  <Input
                    disabled
                    placeholder={`${t('label.task-entity', {
                      entity: t('label.title'),
                    })}`}
                  />
                </Form.Item>
                <Form.Item
                  data-testid="assignees"
                  label={`${t('label.assignee-plural')}:`}
                  name="assignees"
                  rules={[
                    {
                      required: true,
                      message: t('message.field-text-is-required', {
                        fieldText: t('label.assignee-plural'),
                      }),
                    },
                  ]}>
                  <Assignees
                    options={options}
                    value={assignees}
                    onChange={setAssignees}
                    onSearch={onSearch}
                  />
                </Form.Item>
                <Form.Item
                  data-testid="tags-label"
                  label={`${t('label.suggest-entity', {
                    entity: t('label.tag-plural'),
                  })}:`}
                  name="suggestTags">
                  <TagSuggestion />
                </Form.Item>

                <Form.Item>
                  <Space
                    className="w-full justify-end"
                    data-testid="cta-buttons"
                    size={16}>
                    <Button type="link" onClick={back}>
                      {t('label.back')}
                    </Button>
                    <Button
                      data-testid="submit-tag-request"
                      htmlType="submit"
                      type="primary">
                      {suggestion ? t('label.suggest') : t('label.submit')}
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            </div>
          </div>
        ),
      }}
      pageTitle={t('label.task')}
      secondPanel={{
        minWidth: 60,
        flex: 0.4,
        children: (
          <ExploreSearchCard
            hideBreadcrumbs
            showTags
            id={entityData.id ?? ''}
            source={
              {
                ...entityData,
                entityType,
              } as SearchedDataProps['data'][number]['_source']
            }
          />
        ),
      }}
    />
  );
};

export default observer(RequestTag);
