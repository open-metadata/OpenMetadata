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

import { PlusOutlined } from '@ant-design/icons';
import { Button, Form, FormProps, Input, Space, Typography } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { AxiosError } from 'axios';
import { isEmpty, isUndefined } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ActivityFeedTabs } from '../../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import Loader from '../../../components/common/Loader/Loader';
import { OwnerLabel } from '../../../components/common/OwnerLabel/OwnerLabel.component';
import ResizablePanels from '../../../components/common/ResizablePanels/ResizablePanels';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { UserTeamSelectableList } from '../../../components/common/UserTeamSelectableList/UserTeamSelectableList.component';
import ExploreSearchCard from '../../../components/ExploreV1/ExploreSearchCard/ExploreSearchCard';
import { SearchedDataProps } from '../../../components/SearchedData/SearchedData.interface';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { LIST_SIZE, VALIDATION_MESSAGES } from '../../../constants/constants';
import { EntityField } from '../../../constants/Feeds.constants';
import { TASK_SANITIZE_VALUE_REGEX } from '../../../constants/regex.constants';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import {
  CreateThread,
  TaskType,
  ThreadType,
} from '../../../generated/api/feed/createThread';
import { Glossary } from '../../../generated/entity/data/glossary';
import { EntityReference } from '../../../generated/tests/testCase';
import { withPageLayout } from '../../../hoc/withPageLayout';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { useFqn } from '../../../hooks/useFqn';
import { postThread } from '../../../rest/feedsAPI';
import { isDescriptionContentEmpty } from '../../../utils/BlockEditorUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import {
  ENTITY_LINK_SEPARATOR,
  getEntityFeedLink,
} from '../../../utils/EntityUtils';
import {
  fetchEntityDetail,
  getBreadCrumbList,
  getColumnObject,
  getEntityColumnsDetails,
  getTaskAssignee,
  getTaskEntityFQN,
  getTaskMessage,
} from '../../../utils/TasksUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { DescriptionTabs } from '../shared/DescriptionTabs';
import '../task-page.style.less';
import { EntityData } from '../TasksPage.interface';

const UpdateDescription = () => {
  const { currentUser } = useApplicationStore();
  const location = useCustomLocation();
  const navigate = useNavigate();
  const [form] = useForm();

  const { entityType } = useRequiredParams<{ entityType: EntityType }>();
  const { fqn } = useFqn();
  const { t } = useTranslation();
  const queryParams = new URLSearchParams(location.search);

  const field = queryParams.get('field');
  const value = queryParams.get('value');

  const [entityData, setEntityData] = useState<EntityData>({} as EntityData);
  const [currentDescription, setCurrentDescription] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const selectedAssignees =
    Form.useWatch<EntityReference[]>('assignees', form) ?? [];

  const entityFQN = useMemo(
    () => getTaskEntityFQN(entityType, fqn),
    [fqn, entityType]
  );

  const sanitizeValue = useMemo(
    () => value?.replaceAll(TASK_SANITIZE_VALUE_REGEX, '') ?? '',
    [value]
  );

  const taskMessage = useMemo(
    () =>
      getTaskMessage({
        value,
        entityType,
        entityData,
        field,
        startMessage: 'Update description',
      }),
    [value, entityType, field, entityData]
  );

  const back = () => navigate(-1);

  const columnObject = useMemo(() => {
    const column = sanitizeValue.split(FQN_SEPARATOR_CHAR).slice(-1);

    return getColumnObject(
      column[0],
      getEntityColumnsDetails(entityType, entityData),
      entityType
    );
  }, [field, entityData, entityType]);

  const getDescription = () => {
    if (!isEmpty(columnObject) && !isUndefined(columnObject)) {
      return columnObject.description ?? '';
    } else {
      return entityData.description ?? '';
    }
  };

  const getTaskAbout = () => {
    if (field && value) {
      return `${field}${ENTITY_LINK_SEPARATOR}${value}${ENTITY_LINK_SEPARATOR}description`;
    } else {
      return EntityField.DESCRIPTION;
    }
  };

  const onCreateTask: FormProps['onFinish'] = (value) => {
    setIsLoading(true);
    const data: CreateThread = {
      from: currentUser?.name as string,
      message: value.title || taskMessage,
      about: getEntityFeedLink(entityType, entityFQN, getTaskAbout()),
      taskDetails: {
        assignees: selectedAssignees.map((assignee) => ({
          id: assignee.id,
          type: assignee.type,
        })),
        suggestion: isDescriptionContentEmpty(value.description)
          ? ''
          : value.description,
        type: TaskType.UpdateDescription,
        oldValue: currentDescription,
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
        navigate(
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
    form.setFieldsValue({
      title: taskMessage.trimEnd(),
      description: getDescription(),
      assignees: getTaskAssignee(entityData as Glossary),
    });
  }, [entityData]);

  useEffect(() => {
    setCurrentDescription(getDescription());
  }, [entityData, columnObject]);

  if (isEmpty(entityData)) {
    return <Loader />;
  }

  return (
    <ResizablePanels
      className="content-height-with-resizable-panel"
      firstPanel={{
        className: 'content-resizable-panel-container',
        cardClassName: 'max-width-md m-x-auto',
        allowScroll: true,
        minWidth: 700,
        flex: 0.6,
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

            <div className="m-t-0 request-description" key="update-description">
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
                layout="vertical"
                validateMessages={VALIDATION_MESSAGES}
                onFinish={onCreateTask}>
                <Form.Item
                  data-testid="title"
                  label={`${t('label.title')}:`}
                  name="title">
                  <Input
                    disabled
                    placeholder={t('label.task-entity', {
                      entity: t('label.title'),
                    })}
                  />
                </Form.Item>
                <div className="m-b-lg">
                  <Form.Item
                    className="form-item-horizontal m-b-sm"
                    data-testid="assignees"
                    label={`${t('label.assignee-plural')}:`}
                    name="assignees"
                    rules={[{ required: true }]}>
                    <UserTeamSelectableList
                      hasPermission
                      selectBoth
                      multiple={{ user: true, team: true }}
                      owner={selectedAssignees}
                      onUpdate={(values) =>
                        form.setFieldValue(['assignees'], values)
                      }>
                      <Button
                        data-testid="add-owner"
                        icon={
                          <PlusOutlined
                            style={{ color: 'white', fontSize: '12px' }}
                          />
                        }
                        size="small"
                        type="primary"
                      />
                    </UserTeamSelectableList>
                  </Form.Item>

                  {Boolean(selectedAssignees.length) && (
                    <Space wrap data-testid="assignees-container" size={[8, 8]}>
                      <OwnerLabel
                        maxVisibleOwners={LIST_SIZE}
                        owners={selectedAssignees}
                      />
                    </Space>
                  )}
                </div>

                {currentDescription && (
                  <Form.Item
                    data-testid="description-tabs"
                    label={`${t('label.description')}:`}
                    name="description"
                    rules={[{ required: true }]}>
                    <DescriptionTabs
                      suggestion={currentDescription}
                      value={currentDescription}
                    />
                  </Form.Item>
                )}

                <Form.Item>
                  <Space
                    className="w-full justify-end"
                    data-testid="cta-buttons"
                    size={16}>
                    <Button data-testid="cancel-btn" type="link" onClick={back}>
                      {t('label.back')}
                    </Button>
                    <Button
                      data-testid="submit-btn"
                      htmlType="submit"
                      loading={isLoading}
                      type="primary">
                      {t('label.save')}
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            </div>
          </div>
        ),
      }}
      pageTitle={t('label.update-description')}
      secondPanel={{
        className: 'content-resizable-panel-container',
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

export default withPageLayout(UpdateDescription);
