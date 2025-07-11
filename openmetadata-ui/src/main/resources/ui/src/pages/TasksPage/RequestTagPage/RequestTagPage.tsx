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
import { isEmpty } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { ActivityFeedTabs } from '../../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import Loader from '../../../components/common/Loader/Loader';
import ResizablePanels from '../../../components/common/ResizablePanels/ResizablePanels';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import ExploreSearchCard from '../../../components/ExploreV1/ExploreSearchCard/ExploreSearchCard';
import { SearchedDataProps } from '../../../components/SearchedData/SearchedData.interface';
import { EntityField } from '../../../constants/Feeds.constants';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import {
  CreateThread,
  TaskType,
} from '../../../generated/api/feed/createThread';
import { Glossary } from '../../../generated/entity/data/glossary';
import { ThreadType } from '../../../generated/entity/feed/thread';
import { TagLabel } from '../../../generated/type/tagLabel';
import { withPageLayout } from '../../../hoc/withPageLayout';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { useFqn } from '../../../hooks/useFqn';
import { postThread } from '../../../rest/feedsAPI';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import {
  ENTITY_LINK_SEPARATOR,
  getEntityFeedLink,
} from '../../../utils/EntityUtils';
import i18n from '../../../utils/i18next/LocalUtil';
import {
  fetchEntityDetail,
  fetchOptions,
  getBreadCrumbList,
  getTaskAssignee,
  getTaskEntityFQN,
  getTaskMessage,
} from '../../../utils/TasksUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import Assignees from '../shared/Assignees';
import TagSuggestion from '../shared/TagSuggestion';
import '../task-page.style.less';
import { EntityData, Option } from '../TasksPage.interface';

const RequestTag = () => {
  const { currentUser } = useApplicationStore();
  const { t } = useTranslation();
  const location = useCustomLocation();
  const history = useHistory();
  const [form] = useForm();
  const { entityType } = useParams<{ entityType: EntityType }>();
  const { fqn } = useFqn();
  const queryParams = new URLSearchParams(location.search);

  const field = queryParams.get('field');
  const value = queryParams.get('value');

  const [entityData, setEntityData] = useState<EntityData>({} as EntityData);
  const [options, setOptions] = useState<Option[]>([]);
  const [assignees, setAssignees] = useState<Option[]>([]);
  const [suggestion] = useState<TagLabel[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const entityFQN = useMemo(
    () => getTaskEntityFQN(entityType, fqn),
    [fqn, entityType]
  );

  const taskMessage = useMemo(
    () =>
      getTaskMessage({
        value,
        entityType,
        entityData,
        field,
        startMessage: 'Request tags',
      }),
    [value, entityType, field, entityData]
  );

  const back = () => history.goBack();

  const onSearch = (query: string) => {
    const data = {
      query,
      setOptions,
    };
    fetchOptions(data);
  };

  const getTaskAbout = () => {
    if (field && value) {
      return `${field}${ENTITY_LINK_SEPARATOR}${value}${ENTITY_LINK_SEPARATOR}tags`;
    } else {
      return EntityField.TAGS;
    }
  };

  const onCreateTask: FormProps['onFinish'] = (value) => {
    setIsLoading(true);
    const data: CreateThread = {
      from: currentUser?.name as string,
      message: value.title || taskMessage,
      about: getEntityFeedLink(entityType, entityFQN, getTaskAbout()),
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
          entityUtilClassBase.getEntityLink(
            entityType,
            entityFQN,
            EntityTabs.ACTIVITY_FEED,
            ActivityFeedTabs.TASKS
          )
        );
      })
      .catch((err: AxiosError) => showErrorToast(err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchEntityDetail(entityType, entityFQN, setEntityData);
  }, [entityFQN, entityType]);

  useEffect(() => {
    const defaultAssignee = getTaskAssignee(entityData as Glossary);

    if (defaultAssignee) {
      setAssignees(defaultAssignee);
      setOptions((prev) => [...defaultAssignee, ...prev]);
    }
    form.setFieldsValue({
      title: taskMessage.trimEnd(),
      assignees: defaultAssignee,
    });
  }, [entityData]);

  if (isEmpty(entityData)) {
    return <Loader />;
  }

  return (
    <ResizablePanels
      className="content-height-with-resizable-panel"
      firstPanel={{
        className: 'content-resizable-panel-container bg-white',
        minWidth: 700,
        flex: 0.6,
        cardClassName: 'max-width-md m-x-auto',
        allowScroll: true,
        children: (
          <div className="d-grid gap-4">
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
                data-testid="form-container"
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
                    <Button data-testid="cancel-btn" type="link" onClick={back}>
                      {t('label.back')}
                    </Button>
                    <Button
                      data-testid="submit-tag-request"
                      htmlType="submit"
                      loading={isLoading}
                      type="primary">
                      {suggestion ? t('label.suggest') : t('label.save')}
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            </div>
          </div>
        ),
      }}
      pageTitle={t('label.request-tag-plural')}
      secondPanel={{
        className: 'content-resizable-panel-container bg-white',
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

export default withPageLayout(i18n.t('label.request-tag-plural'))(RequestTag);
