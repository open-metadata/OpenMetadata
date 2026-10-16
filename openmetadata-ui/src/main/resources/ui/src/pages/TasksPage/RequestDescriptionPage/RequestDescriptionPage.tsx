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

import {
  Box,
  Button,
  Card,
  FieldTypes,
  FormField,
  getField,
  HintText,
  HookForm,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ActivityFeedTabs } from '../../../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import Loader from '../../../components/common/Loader/Loader';
import ResizablePanels from '../../../components/common/ResizablePanels/ResizablePanels';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import ExploreSearchCard from '../../../components/ExploreV1/ExploreSearchCard/ExploreSearchCard';
import { SearchedDataProps } from '../../../components/SearchedData/SearchedData.interface';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { Glossary } from '../../../generated/entity/data/glossary';
import { withPageLayout } from '../../../hoc/withPageLayout';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { useFqn } from '../../../hooks/useFqn';
import { TaskFormSchema } from '../../../rest/taskFormSchemasAPI';
import {
  CreateTask,
  createTask,
  TaskCategory,
  TaskEntityType,
  TaskPayload,
  TaskPriority,
} from '../../../rest/tasksAPI';
import { getEntityFeedLink } from '../../../utils/EntityPureUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { fetchOptions } from '../../../utils/TaskAssigneeUtils';
import {
  fetchEntityDetail,
  getBreadCrumbList,
} from '../../../utils/TaskEntityFetchUtils';
import {
  getDescriptionTaskFieldPath,
  getTaskAssignee,
  getTaskEntityFQN,
  getTaskMessage,
} from '../../../utils/TaskFieldUtils';
import {
  applyTaskFormSchemaDefaults,
  getResolvedTaskFormSchema,
} from '../../../utils/TaskFormSchemaUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import Assignees from '../shared/Assignees';
import TaskPayloadSchemaFields from '../shared/TaskPayloadSchemaFields';
import { EntityData, Option } from '../TasksPage.interface';

const RequestDescription = () => {
  const { t } = useTranslation();
  const location = useCustomLocation();
  const navigate = useNavigate();
  const form = useForm<{ title: string; assignees: Option[] }>({
    defaultValues: { title: '', assignees: [] },
  });

  const { entityType } = useRequiredParams<{ entityType: EntityType }>();

  const { fqn } = useFqn();
  const queryParams = new URLSearchParams(location.search);

  const field = queryParams.get('field');
  const value = queryParams.get('value');

  const [entityData, setEntityData] = useState<EntityData>({} as EntityData);
  const [options, setOptions] = useState<Option[]>([]);
  const [assignees, setAssignees] = useState<Array<Option>>([]);
  const [payload, setPayload] = useState<TaskPayload>({});
  const [taskFormSchema, setTaskFormSchema] = useState<TaskFormSchema>();
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
        startMessage: 'Request description',
      }),
    [value, entityType, field, entityData]
  );

  const back = () => navigate(-1);

  const onSearch = (query: string) => {
    const data = {
      query,
      setOptions,
    };
    fetchOptions(data);
  };

  const getTaskAbout = () => {
    return getDescriptionTaskFieldPath(field, value);
  };

  const onCreateTask = async (formValues: {
    title: string;
    assignees: Option[];
  }) => {
    setIsLoading(true);
    if (assignees.length) {
      const data: CreateTask = {
        name: formValues.title || taskMessage,
        category: TaskCategory.MetadataUpdate,
        type: TaskEntityType.DescriptionUpdate,
        priority: TaskPriority.Medium,
        about: getEntityFeedLink(entityType, entityFQN),
        assignees: assignees.map((assignee) => assignee.name ?? ''),
        payload: applyTaskFormSchemaDefaults(
          payload,
          taskFormSchema?.formSchema
        ),
      };

      try {
        await createTask(data);
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
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        setIsLoading(false);
      }
    } else {
      showErrorToast(t('server.no-task-creation-without-assignee'));
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEntityDetail(entityType, entityFQN, setEntityData);
  }, [entityFQN, entityType]);

  useEffect(() => {
    getResolvedTaskFormSchema(
      TaskEntityType.DescriptionUpdate,
      TaskCategory.MetadataUpdate
    ).then(setTaskFormSchema);
  }, []);

  useEffect(() => {
    const defaultAssignee = getTaskAssignee(entityData as Glossary);

    if (defaultAssignee) {
      setAssignees(defaultAssignee);
      setOptions(defaultAssignee);
    }
    form.setValue('title', taskMessage.trimEnd());
    form.setValue('assignees', defaultAssignee ?? []);
  }, [entityData, form, taskMessage]);

  useEffect(() => {
    setPayload({
      fieldPath: getTaskAbout(),
      currentDescription: '',
      newDescription: '',
    });
  }, [field, value]);

  useEffect(() => {
    setPayload((prevPayload) =>
      applyTaskFormSchemaDefaults(prevPayload, taskFormSchema?.formSchema)
    );
  }, [taskFormSchema?.formSchema]);

  if (isEmpty(entityData)) {
    return <Loader />;
  }

  return (
    <ResizablePanels
      className="content-height-with-resizable-panel"
      firstPanel={{
        className: 'content-resizable-panel-container',
        wrapInCard: false,
        allowScroll: true,
        minWidth: 700,
        flex: 0.6,
        children: (
          <Card className="tw:mx-auto tw:max-w-3xl">
            <Card.Content>
              <Box direction="col" gap={4}>
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

                <div key="request-description">
                  <Typography as="p" data-testid="form-title" size="text-md">
                    {t('label.create-entity', {
                      entity: t('label.task'),
                    })}
                  </Typography>
                  <HookForm
                    className="tw:flex tw:flex-col tw:gap-6"
                    data-testid="form-container"
                    form={form}
                    onSubmit={form.handleSubmit(onCreateTask)}>
                    {getField({
                      name: 'title',
                      type: FieldTypes.TEXT,
                      label: t('label.task-entity', {
                        entity: t('label.title'),
                      }),
                      props: { 'data-testid': 'title', isDisabled: true },
                    })}
                    <FormField
                      control={form.control}
                      name="assignees"
                      rules={{
                        required: t('message.field-text-is-required', {
                          fieldText: t('label.assignee-plural'),
                        }),
                      }}>
                      {({ field, fieldState }) => (
                        <Box data-testid="assignees" direction="col" gap={1}>
                          <Assignees
                            isRequired
                            isInvalid={fieldState.invalid}
                            label={t('label.assignee-plural')}
                            options={options}
                            value={field.value}
                            onBlur={field.onBlur}
                            onChange={(values) => {
                              field.onChange(values);
                              setAssignees(values);
                            }}
                            onSearch={onSearch}
                          />
                          {fieldState.error?.message && (
                            <HintText isInvalid>
                              {fieldState.error.message}
                            </HintText>
                          )}
                        </Box>
                      )}
                    </FormField>
                    <TaskPayloadSchemaFields
                      payload={payload}
                      schema={taskFormSchema?.formSchema}
                      uiSchema={taskFormSchema?.uiSchema}
                      onChange={setPayload}
                    />
                    <Box data-testid="cta-buttons" gap={4} justify="end">
                      <Button
                        color="link-gray"
                        data-testid="cancel-btn"
                        onPress={back}>
                        {t('label.back')}
                      </Button>
                      <Button
                        data-testid="submit-btn"
                        isLoading={isLoading}
                        type="submit">
                        {payload.newDescription
                          ? t('label.suggest')
                          : t('label.save')}
                      </Button>
                    </Box>
                  </HookForm>
                </div>
              </Box>
            </Card.Content>
          </Card>
        ),
      }}
      pageTitle={t('label.request-description')}
      secondPanel={{
        wrapInCard: false,
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

export default withPageLayout(RequestDescription);
