/*
 *  Copyright 2026 Collate.
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
/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { PlusOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Select,
  Space,
  Spin,
  Tabs,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import CodeEditor from '../../components/Database/SchemaEditor/CodeEditor';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';
import { WorkflowDefinition } from '../../generated/governance/workflows/workflowDefinition';
import {
  createTaskFormSchema,
  listTaskFormSchemas,
  TaskFormSchema,
  updateTaskFormSchema,
} from '../../rest/taskFormSchemasAPI';
import {
  TaskCategory,
  TaskEntityStatus,
  TaskEntityType,
} from '../../rest/tasksAPI';
import {
  getWorkflowDefinitionByFQN,
  updateWorkflowDefinition,
} from '../../rest/workflowDefinitionsAPI';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import {
  buildDesignerSchema,
  buildStageMappings,
  buildTransitionForms,
  createEmptyDesignerTransition,
  createEmptyStageMapping,
  parseSchemaToDesignerFields,
  parseStageMappings,
  parseTransitionForms,
  stringifyDesignerJson,
  TaskFormDesignerStageMapping,
  TaskFormDesignerTransition,
} from '../../utils/TaskFormDesignerUtils';
import { getDefaultTaskFormSchema } from '../../utils/TaskFormSchemaUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import TaskFormBuilderSection from './components/TaskFormBuilderSection';
import './task-form-settings.less';

const EMPTY_SCHEMA: TaskFormSchema = {
  name: '',
  displayName: '',
  description: '',
  taskType: '',
  taskCategory: '',
  formSchema: {
    type: 'object',
    properties: {},
  },
  uiSchema: {},
  createFormSchema: {
    type: 'object',
    properties: {},
  },
  createUiSchema: {},
  transitionForms: {},
  defaultStageMappings: {},
};

const parseJsonObject = (value: string) => {
  try {
    const parsed = JSON.parse(value);

    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const stringifyJson = stringifyDesignerJson;

const getDefaultWorkflowDefinitionRef = (taskType?: string) => {
  switch (taskType) {
    case 'DescriptionUpdate':
      return 'DescriptionUpdateTaskWorkflow';
    case 'TagUpdate':
      return 'TagUpdateTaskWorkflow';
    case 'OwnershipUpdate':
      return 'OwnershipUpdateTaskWorkflow';
    case 'TierUpdate':
      return 'TierUpdateTaskWorkflow';
    case 'DomainUpdate':
      return 'DomainUpdateTaskWorkflow';
    case 'GlossaryApproval':
      return 'GlossaryApprovalTaskWorkflow';
    case 'RequestApproval':
      return 'RequestApprovalTaskWorkflow';
    case 'Suggestion':
      return 'SuggestionTaskWorkflow';
    case 'TestCaseResolution':
      return 'TestCaseResolutionTaskWorkflow';
    case 'IncidentResolution':
      return 'IncidentResolutionTaskWorkflow';
    case 'CustomTask':
      return 'CustomTaskWorkflow';
    default:
      return undefined;
  }
};

const sanitizeWorkflowDefinitionPayload = (
  workflowDefinition: WorkflowDefinition
) => {
  const {
    name,
    displayName,
    description,
    owners,
    config,
    trigger,
    nodes,
    edges,
  } = workflowDefinition;

  return {
    name,
    displayName,
    description,
    owners,
    config,
    trigger,
    nodes,
    edges,
  };
};

const TaskFormSettingsPage = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm<TaskFormSchema>();
  const [schemas, setSchemas] = useState<TaskFormSchema[]>([]);
  const [selectedSchema, setSelectedSchema] =
    useState<TaskFormSchema>(EMPTY_SCHEMA);
  const [formSchemaValue, setFormSchemaValue] = useState(
    stringifyJson(EMPTY_SCHEMA.formSchema)
  );
  const [uiSchemaValue, setUiSchemaValue] = useState(
    stringifyJson(EMPTY_SCHEMA.uiSchema)
  );
  const [createFormSchemaValue, setCreateFormSchemaValue] = useState(
    stringifyJson(EMPTY_SCHEMA.createFormSchema)
  );
  const [createUiSchemaValue, setCreateUiSchemaValue] = useState(
    stringifyJson(EMPTY_SCHEMA.createUiSchema)
  );
  const [transitionFormsValue, setTransitionFormsValue] = useState(
    stringifyJson(EMPTY_SCHEMA.transitionForms)
  );
  const [defaultStageMappingsValue, setDefaultStageMappingsValue] = useState(
    stringifyJson(EMPTY_SCHEMA.defaultStageMappings)
  );
  const [workflowDefinitionValue, setWorkflowDefinitionValue] = useState('{}');
  const [resolveFields, setResolveFields] = useState(
    parseSchemaToDesignerFields(EMPTY_SCHEMA.formSchema, EMPTY_SCHEMA.uiSchema)
  );
  const [createFields, setCreateFields] = useState(
    parseSchemaToDesignerFields(
      EMPTY_SCHEMA.createFormSchema,
      EMPTY_SCHEMA.createUiSchema
    )
  );
  const [transitionBuilders, setTransitionBuilders] = useState<
    TaskFormDesignerTransition[]
  >([]);
  const [stageMappings, setStageMappings] = useState<
    TaskFormDesignerStageMapping[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const watchedName = Form.useWatch('name', form);
  const watchedDisplayName = Form.useWatch('displayName', form);
  const watchedDescription = Form.useWatch('description', form);
  const watchedTaskType = Form.useWatch('taskType', form);
  const watchedTaskCategory = Form.useWatch('taskCategory', form);

  const breadcrumbs = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.GOVERNANCE,
        'Task Forms',
        GlobalSettingOptions.TASK_FORMS
      ),
    []
  );

  const setSchemaEditors = (schema: TaskFormSchema) => {
    const workflowDefinitionRef =
      schema.workflowDefinitionRef ??
      getDefaultWorkflowDefinitionRef(schema.taskType);
    const nextResolveSchema = schema.formSchema;
    const nextResolveUiSchema = schema.uiSchema;
    const nextCreateSchema = schema.createFormSchema ?? schema.formSchema;
    const nextCreateUiSchema = schema.createUiSchema ?? schema.uiSchema;
    const nextTransitionForms = schema.transitionForms ?? {};
    const nextStageMappings = schema.defaultStageMappings ?? {};

    setSelectedSchema(schema);
    form.setFieldsValue({
      ...schema,
      workflowDefinitionRef,
    });
    setFormSchemaValue(stringifyJson(nextResolveSchema));
    setUiSchemaValue(stringifyJson(nextResolveUiSchema));
    setCreateFormSchemaValue(stringifyJson(nextCreateSchema));
    setCreateUiSchemaValue(stringifyJson(nextCreateUiSchema));
    setTransitionFormsValue(stringifyJson(nextTransitionForms));
    setDefaultStageMappingsValue(stringifyJson(nextStageMappings));
    setResolveFields(
      parseSchemaToDesignerFields(nextResolveSchema, nextResolveUiSchema)
    );
    setCreateFields(
      parseSchemaToDesignerFields(nextCreateSchema, nextCreateUiSchema)
    );
    setTransitionBuilders(
      parseTransitionForms(nextTransitionForms) as TaskFormDesignerTransition[]
    );
    setStageMappings(parseStageMappings(nextStageMappings));
    setWorkflowDefinitionValue('{}');
    if (workflowDefinitionRef) {
      void getWorkflowDefinitionByFQN(workflowDefinitionRef)
        .then((workflow) => setWorkflowDefinitionValue(stringifyJson(workflow)))
        .catch(() => setWorkflowDefinitionValue('{}'));
    }
  };

  const loadSchemas = async () => {
    setLoading(true);
    try {
      const response = await listTaskFormSchemas({ limit: 100 });
      const data = response.data ?? [];
      setSchemas(data);
      if (!selectedSchema.id && data.length > 0) {
        setSchemaEditors(data[0]);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchemas();
  }, []);

  const handleSelectSchema = (schema: TaskFormSchema) => {
    setSchemaEditors(schema);
  };

  const handleCreateNew = () => {
    form.resetFields();
    setSchemaEditors(EMPTY_SCHEMA);
  };

  const handleDiscardChanges = () => {
    if (selectedSchema.id || selectedSchema.name) {
      setSchemaEditors(selectedSchema);
    } else {
      handleCreateNew();
    }
  };

  const handleLoadTemplate = () => {
    const currentValues = form.getFieldsValue();
    const taskType = currentValues.taskType as TaskEntityType | undefined;
    const taskCategory = currentValues.taskCategory as TaskCategory | undefined;

    if (!taskType || !taskCategory) {
      showErrorToast(
        'Select a task type and category before loading a template'
      );

      return;
    }

    const template = getDefaultTaskFormSchema(taskType, taskCategory);

    if (!template) {
      showErrorToast('No built-in template is available for this task type');

      return;
    }

    setSchemaEditors({
      ...selectedSchema,
      ...template,
      ...currentValues,
      taskType,
      taskCategory,
      name: currentValues.name || template.name,
      displayName: currentValues.displayName || template.displayName,
      description: currentValues.description || template.description,
      workflowDefinitionRef:
        currentValues.workflowDefinitionRef ??
        template.workflowDefinitionRef ??
        getDefaultWorkflowDefinitionRef(taskType),
    });
  };

  const syncResolveDesigner = (
    fields = resolveFields,
    nextFormSchemaValue = formSchemaValue,
    nextUiSchemaValue = uiSchemaValue
  ) => {
    const { formSchema: nextFormSchema, uiSchema: nextUiSchema } =
      buildDesignerSchema(
        fields,
        parseJsonObject(nextFormSchemaValue),
        parseJsonObject(nextUiSchemaValue)
      );

    setResolveFields(fields);
    setFormSchemaValue(stringifyJson(nextFormSchema));
    setUiSchemaValue(stringifyJson(nextUiSchema));
  };

  const syncCreateDesigner = (
    fields = createFields,
    nextFormSchemaValue = createFormSchemaValue,
    nextUiSchemaValue = createUiSchemaValue
  ) => {
    const { formSchema: nextFormSchema, uiSchema: nextUiSchema } =
      buildDesignerSchema(
        fields,
        parseJsonObject(nextFormSchemaValue),
        parseJsonObject(nextUiSchemaValue)
      );

    setCreateFields(fields);
    setCreateFormSchemaValue(stringifyJson(nextFormSchema));
    setCreateUiSchemaValue(stringifyJson(nextUiSchema));
  };

  const syncTransitionDesigner = (
    transitions = transitionBuilders,
    nextTransitionFormsValue = transitionFormsValue
  ) => {
    const existingConfigs = parseJsonObject(nextTransitionFormsValue);
    const mergedTransitions = transitions.map((transition) => ({
      ...transition,
      config: existingConfigs?.[transition.transitionId] ?? transition.config,
    }));
    const nextTransitionForms = buildTransitionForms(mergedTransitions);

    setTransitionBuilders(mergedTransitions);
    setTransitionFormsValue(stringifyJson(nextTransitionForms));
  };

  const syncStageMappings = (mappings = stageMappings) => {
    setStageMappings(mappings);
    setDefaultStageMappingsValue(stringifyJson(buildStageMappings(mappings)));
  };

  const handleSave = async (values: TaskFormSchema) => {
    let parsedFormSchema;
    let parsedUiSchema;
    let parsedCreateFormSchema;
    let parsedCreateUiSchema;
    let parsedTransitionForms;
    let parsedDefaultStageMappings;
    let parsedWorkflowDefinition;

    try {
      parsedFormSchema = JSON.parse(formSchemaValue);
      parsedUiSchema = JSON.parse(uiSchemaValue);
      parsedCreateFormSchema = JSON.parse(createFormSchemaValue);
      parsedCreateUiSchema = JSON.parse(createUiSchemaValue);
      parsedTransitionForms = JSON.parse(transitionFormsValue);
      parsedDefaultStageMappings = JSON.parse(defaultStageMappingsValue);
      parsedWorkflowDefinition = JSON.parse(workflowDefinitionValue);
    } catch {
      showErrorToast('Task form settings JSON is invalid');

      return;
    }

    setSaving(true);
    try {
      const payload: TaskFormSchema = {
        ...selectedSchema,
        ...values,
        formSchema: parsedFormSchema,
        uiSchema: parsedUiSchema,
        createFormSchema: parsedCreateFormSchema,
        createUiSchema: parsedCreateUiSchema,
        transitionForms: parsedTransitionForms,
        defaultStageMappings: parsedDefaultStageMappings,
      };

      if (
        parsedWorkflowDefinition &&
        typeof parsedWorkflowDefinition === 'object' &&
        Object.keys(parsedWorkflowDefinition).length > 0
      ) {
        const workflowName =
          parsedWorkflowDefinition.name ?? payload.workflowDefinitionRef;
        if (!workflowName) {
          showErrorToast('Workflow definition JSON must include a name');

          return;
        }

        const savedWorkflow = await updateWorkflowDefinition({
          ...sanitizeWorkflowDefinitionPayload(parsedWorkflowDefinition),
          name: workflowName,
        });
        payload.workflowDefinitionRef = savedWorkflow.name;
        payload.workflowVersion = savedWorkflow.version;
      }

      const savedSchema = payload.id
        ? await updateTaskFormSchema(payload)
        : await createTaskFormSchema(payload);

      showSuccessToast('Task form saved successfully');
      await loadSchemas();
      handleSelectSchema(savedSchema);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setSaving(false);
    }
  };

  const pageTitle =
    watchedDisplayName?.trim() ||
    watchedName?.trim() ||
    selectedSchema.displayName ||
    selectedSchema.name ||
    'New Task Form';
  const pageDescription =
    watchedDescription?.trim() ||
    selectedSchema.description ||
    'Configure task schemas, form behavior, and workflow transitions in one workspace.';
  const schemaSubtitle = [watchedTaskType, watchedTaskCategory]
    .filter(Boolean)
    .join(' / ');

  return (
    <PageLayoutV1 pageTitle="Task Forms">
      <div
        className="task-form-settings-page"
        data-testid="task-form-settings-page">
        <TitleBreadcrumb titleLinks={breadcrumbs} />
        <Form<TaskFormSchema>
          form={form}
          layout="vertical"
          onFinish={handleSave}>
          <div className="task-form-settings-shell">
            <aside className="task-form-settings-sidebar">
              <Card className="task-form-settings-sidebar-card" title="Schemas">
                {loading ? (
                  <div className="text-center p-y-lg">
                    <Spin />
                  </div>
                ) : (
                  <div className="task-form-settings-schema-list">
                    {schemas.length ? (
                      schemas.map((schema) => {
                        const isActive = schema.id === selectedSchema.id;

                        return (
                          <button
                            className={`task-form-settings-schema-item ${
                              isActive
                                ? 'task-form-settings-schema-item--active'
                                : ''
                            }`}
                            data-testid={`task-form-list-item-${schema.name}`}
                            key={schema.id ?? schema.name}
                            type="button"
                            onClick={() => handleSelectSchema(schema)}>
                            <span className="task-form-settings-schema-item__title">
                              {schema.displayName ?? schema.name}
                            </span>
                            <span className="task-form-settings-schema-item__meta">
                              {`${schema.taskType} / ${
                                schema.taskCategory ?? '-'
                              }`}
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <Typography.Text className="text-grey-muted">
                        No task forms found yet.
                      </Typography.Text>
                    )}
                  </div>
                )}

                <Button
                  block
                  className="task-form-settings-sidebar-action"
                  data-testid="task-form-add-button"
                  type="primary"
                  onClick={handleCreateNew}>
                  {t('label.add')}
                </Button>
              </Card>
            </aside>

            <section className="task-form-settings-main">
              <div className="task-form-settings-hero">
                <div className="task-form-settings-hero__copy">
                  <Typography.Text className="task-form-settings-hero__eyebrow">
                    Form Builder
                  </Typography.Text>
                  <Typography.Title
                    className="task-form-settings-hero__title"
                    level={2}>
                    {pageTitle}
                  </Typography.Title>
                  <Typography.Paragraph className="task-form-settings-hero__description">
                    {pageDescription}
                  </Typography.Paragraph>
                  {schemaSubtitle ? (
                    <Typography.Text className="task-form-settings-hero__meta">
                      {schemaSubtitle}
                    </Typography.Text>
                  ) : null}
                </div>
                <Space
                  className="task-form-settings-hero__actions"
                  size="middle">
                  <Button
                    data-testid="task-form-cancel-button"
                    onClick={handleDiscardChanges}>
                    {t('label.cancel')}
                  </Button>
                  <Button
                    data-testid="task-form-save-button"
                    htmlType="submit"
                    loading={saving}
                    type="primary">
                    {t('label.save')}
                  </Button>
                </Space>
              </div>

              <div className="task-form-settings-config-grid">
                <Card
                  className="task-form-settings-card"
                  title="General Configuration">
                  <div className="task-form-settings-form-grid">
                    <Form.Item
                      className="m-b-0"
                      label="Name"
                      name="name"
                      rules={[{ required: true, message: 'Name is required' }]}>
                      <Input data-testid="task-form-name-input" />
                    </Form.Item>
                    <Form.Item
                      className="m-b-0"
                      label="Display Name"
                      name="displayName">
                      <Input data-testid="task-form-display-name-input" />
                    </Form.Item>
                    <Form.Item
                      className="m-b-0 task-form-settings-form-grid__span-2"
                      label="Description"
                      name="description">
                      <Input.TextArea
                        autoSize={{ minRows: 4, maxRows: 6 }}
                        data-testid="task-form-description-input"
                      />
                    </Form.Item>
                  </div>
                </Card>

                <Card
                  className="task-form-settings-card task-form-settings-card--sidebar"
                  title="Classification">
                  <div className="task-form-settings-card__stack">
                    <Form.Item
                      className="m-b-0"
                      label="Task Type"
                      name="taskType"
                      rules={[
                        { required: true, message: 'Task type is required' },
                      ]}>
                      <Input data-testid="task-form-type-input" />
                    </Form.Item>
                    <Form.Item
                      className="m-b-0"
                      label="Task Category"
                      name="taskCategory">
                      <Select
                        allowClear
                        data-testid="task-form-category-input"
                        options={Object.values(TaskCategory).map(
                          (category) => ({
                            label: category,
                            value: category,
                          })
                        )}
                      />
                    </Form.Item>
                    <Form.Item
                      className="m-b-0"
                      label="Workflow Definition"
                      name="workflowDefinitionRef">
                      <Input data-testid="task-form-workflow-definition-input" />
                    </Form.Item>
                    <Button
                      data-testid="task-form-load-template-button"
                      onClick={handleLoadTemplate}>
                      Load built-in template
                    </Button>
                  </div>
                </Card>
              </div>

              <Card className="task-form-settings-card task-form-settings-workspace">
                <Tabs
                  className="task-form-settings-primary-tabs"
                  items={[
                    {
                      key: 'designer',
                      label: 'Designer',
                      children: (
                        <div className="task-form-settings-designer-pane">
                          <Alert
                            showIcon
                            className="task-form-settings-designer-pane__alert"
                            description="Use the builder for create forms, resolve forms, transition forms, and stage mappings. The raw JSON editors are still available under Advanced."
                            message="Design task forms visually"
                            type="info"
                          />
                          <Tabs
                            className="task-form-settings-secondary-tabs"
                            items={[
                              {
                                key: 'create-form',
                                label: 'Create Form',
                                children: (
                                  <TaskFormBuilderSection
                                    baseFormSchema={parseJsonObject(
                                      createFormSchemaValue
                                    )}
                                    baseUiSchema={parseJsonObject(
                                      createUiSchemaValue
                                    )}
                                    description="Fields shown when a task is created."
                                    fields={createFields}
                                    testIdPrefix="task-form-create-builder"
                                    title="Create Form Fields"
                                    onChange={(fields) =>
                                      syncCreateDesigner(fields)
                                    }
                                  />
                                ),
                              },
                              {
                                key: 'resolve-form',
                                label: 'Resolve Form',
                                children: (
                                  <TaskFormBuilderSection
                                    baseFormSchema={parseJsonObject(
                                      formSchemaValue
                                    )}
                                    baseUiSchema={parseJsonObject(
                                      uiSchemaValue
                                    )}
                                    description="Fields shown when the task is reviewed or resolved."
                                    fields={resolveFields}
                                    testIdPrefix="task-form-resolve-builder"
                                    title="Resolve Form Fields"
                                    onChange={(fields) =>
                                      syncResolveDesigner(fields)
                                    }
                                  />
                                ),
                              },
                              {
                                key: 'transitions',
                                label: 'Transition Forms',
                                children: (
                                  <div className="task-form-settings-transition-pane">
                                    <div className="task-form-settings-section-header">
                                      <div>
                                        <Typography.Title
                                          className="m-b-xs"
                                          level={5}>
                                          Transition Forms
                                        </Typography.Title>
                                        <Typography.Paragraph className="m-b-0 text-grey-muted">
                                          Configure additional fields for
                                          specific workflow transitions like
                                          approve, reject, or reassign.
                                        </Typography.Paragraph>
                                      </div>
                                      <Button
                                        data-testid="task-form-transition-add-button"
                                        icon={<PlusOutlined />}
                                        onClick={() =>
                                          syncTransitionDesigner([
                                            ...transitionBuilders,
                                            createEmptyDesignerTransition(),
                                          ])
                                        }>
                                        Add transition form
                                      </Button>
                                    </div>
                                    {transitionBuilders.length ? (
                                      <div className="task-form-settings-transition-list">
                                        {transitionBuilders.map(
                                          (transition, index) => (
                                            <Card
                                              className="task-form-settings-transition-card"
                                              data-testid={`task-form-transition-card-${index}`}
                                              extra={
                                                <Button
                                                  danger
                                                  data-testid={`task-form-transition-remove-${index}`}
                                                  size="small"
                                                  type="text"
                                                  onClick={() =>
                                                    syncTransitionDesigner(
                                                      transitionBuilders.filter(
                                                        (_, currentIndex) =>
                                                          currentIndex !== index
                                                      )
                                                    )
                                                  }>
                                                  Remove
                                                </Button>
                                              }
                                              key={transition.key}
                                              title={
                                                transition.transitionId ||
                                                `Transition ${index + 1}`
                                              }>
                                              <Form.Item
                                                required
                                                label="Transition Id">
                                                <Input
                                                  data-testid={`task-form-transition-id-${index}`}
                                                  placeholder="approve"
                                                  value={
                                                    transition.transitionId
                                                  }
                                                  onChange={(event) =>
                                                    syncTransitionDesigner(
                                                      transitionBuilders.map(
                                                        (
                                                          currentTransition,
                                                          currentIndex
                                                        ) =>
                                                          currentIndex === index
                                                            ? {
                                                                ...currentTransition,
                                                                transitionId:
                                                                  event.target
                                                                    .value,
                                                              }
                                                            : currentTransition
                                                      )
                                                    )
                                                  }
                                                />
                                              </Form.Item>
                                              <TaskFormBuilderSection
                                                baseFormSchema={
                                                  transition.config
                                                    ?.formSchema as
                                                    | Record<string, unknown>
                                                    | undefined as undefined
                                                }
                                                baseUiSchema={
                                                  transition.config
                                                    ?.uiSchema as
                                                    | Record<string, unknown>
                                                    | undefined as undefined
                                                }
                                                description="Extra fields shown only for this transition."
                                                fields={transition.fields}
                                                testIdPrefix={`task-form-transition-builder-${index}`}
                                                title="Transition Fields"
                                                onChange={(fields) =>
                                                  syncTransitionDesigner(
                                                    transitionBuilders.map(
                                                      (
                                                        currentTransition,
                                                        currentIndex
                                                      ) =>
                                                        currentIndex === index
                                                          ? {
                                                              ...currentTransition,
                                                              fields,
                                                            }
                                                          : currentTransition
                                                    )
                                                  )
                                                }
                                              />
                                            </Card>
                                          )
                                        )}
                                      </div>
                                    ) : (
                                      <Typography.Text className="text-grey-muted">
                                        No transition forms configured yet.
                                      </Typography.Text>
                                    )}
                                  </div>
                                ),
                              },
                              {
                                key: 'workflow',
                                label: 'Workflow Stages',
                                children: (
                                  <div className="task-form-settings-stage-pane">
                                    <div className="task-form-settings-section-header">
                                      <div>
                                        <Typography.Title
                                          className="m-b-xs"
                                          level={5}>
                                          Stage to Status Mapping
                                        </Typography.Title>
                                        <Typography.Paragraph className="m-b-0 text-grey-muted">
                                          Map workflow stage ids to the coarse
                                          task status exposed in APIs and
                                          counts.
                                        </Typography.Paragraph>
                                      </div>
                                      <Button
                                        data-testid="task-form-stage-mapping-add-button"
                                        icon={<PlusOutlined />}
                                        onClick={() =>
                                          syncStageMappings([
                                            ...stageMappings,
                                            createEmptyStageMapping(),
                                          ])
                                        }>
                                        Add stage mapping
                                      </Button>
                                    </div>
                                    {stageMappings.length ? (
                                      <div className="task-form-settings-stage-grid">
                                        {stageMappings.map((mapping, index) => (
                                          <Card
                                            className="task-form-settings-stage-card"
                                            data-testid={`task-form-stage-mapping-card-${index}`}
                                            extra={
                                              <Button
                                                danger
                                                data-testid={`task-form-stage-mapping-remove-${index}`}
                                                size="small"
                                                type="text"
                                                onClick={() =>
                                                  syncStageMappings(
                                                    stageMappings.filter(
                                                      (_, currentIndex) =>
                                                        currentIndex !== index
                                                    )
                                                  )
                                                }>
                                                Remove
                                              </Button>
                                            }
                                            key={mapping.key}
                                            size="small"
                                            title={
                                              mapping.stageId ||
                                              `Stage ${index + 1}`
                                            }>
                                            <div className="task-form-settings-form-grid">
                                              <Form.Item
                                                className="m-b-0"
                                                label="Stage Id">
                                                <Input
                                                  data-testid={`task-form-stage-id-${index}`}
                                                  placeholder="open"
                                                  value={mapping.stageId}
                                                  onChange={(event) =>
                                                    syncStageMappings(
                                                      stageMappings.map(
                                                        (
                                                          currentMapping,
                                                          currentIndex
                                                        ) =>
                                                          currentIndex === index
                                                            ? {
                                                                ...currentMapping,
                                                                stageId:
                                                                  event.target
                                                                    .value,
                                                              }
                                                            : currentMapping
                                                      )
                                                    )
                                                  }
                                                />
                                              </Form.Item>
                                              <Form.Item
                                                className="m-b-0"
                                                label="Task Status">
                                                <Select
                                                  data-testid={`task-form-stage-status-${index}`}
                                                  options={Object.values(
                                                    TaskEntityStatus
                                                  ).map((status) => ({
                                                    label: status,
                                                    value: status,
                                                  }))}
                                                  value={
                                                    mapping.taskStatus ||
                                                    undefined
                                                  }
                                                  onChange={(value) =>
                                                    syncStageMappings(
                                                      stageMappings.map(
                                                        (
                                                          currentMapping,
                                                          currentIndex
                                                        ) =>
                                                          currentIndex === index
                                                            ? {
                                                                ...currentMapping,
                                                                taskStatus:
                                                                  value,
                                                              }
                                                            : currentMapping
                                                      )
                                                    )
                                                  }
                                                />
                                              </Form.Item>
                                            </div>
                                          </Card>
                                        ))}
                                      </div>
                                    ) : (
                                      <Typography.Text className="text-grey-muted">
                                        No stage mappings configured yet.
                                      </Typography.Text>
                                    )}
                                  </div>
                                ),
                              },
                            ]}
                          />
                        </div>
                      ),
                    },
                    {
                      key: 'advanced',
                      label: 'Advanced JSON',
                      children: (
                        <div className="task-form-settings-json-pane">
                          <Typography.Title className="m-b-sm" level={5}>
                            Resolve Form Schema
                          </Typography.Title>
                          <CodeEditor
                            editorClass="task-form-schema-editor"
                            value={formSchemaValue}
                            onChange={(value) => {
                              setFormSchemaValue(value);
                              const nextFormSchema = parseJsonObject(value);
                              const nextUiSchema =
                                parseJsonObject(uiSchemaValue);

                              if (nextFormSchema) {
                                setResolveFields(
                                  parseSchemaToDesignerFields(
                                    nextFormSchema,
                                    nextUiSchema
                                  )
                                );
                              }
                            }}
                          />

                          <Typography.Title className="m-b-sm" level={5}>
                            Resolve UI Schema
                          </Typography.Title>
                          <CodeEditor
                            editorClass="task-form-ui-schema-editor"
                            value={uiSchemaValue}
                            onChange={(value) => {
                              setUiSchemaValue(value);
                              const nextFormSchema =
                                parseJsonObject(formSchemaValue);
                              const nextUiSchema = parseJsonObject(value);

                              if (nextFormSchema) {
                                setResolveFields(
                                  parseSchemaToDesignerFields(
                                    nextFormSchema,
                                    nextUiSchema
                                  )
                                );
                              }
                            }}
                          />

                          <Typography.Title className="m-b-sm" level={5}>
                            Create Form Schema
                          </Typography.Title>
                          <CodeEditor
                            editorClass="task-form-create-schema-editor"
                            value={createFormSchemaValue}
                            onChange={(value) => {
                              setCreateFormSchemaValue(value);
                              const nextFormSchema = parseJsonObject(value);
                              const nextUiSchema =
                                parseJsonObject(createUiSchemaValue);

                              if (nextFormSchema) {
                                setCreateFields(
                                  parseSchemaToDesignerFields(
                                    nextFormSchema,
                                    nextUiSchema
                                  )
                                );
                              }
                            }}
                          />

                          <Typography.Title className="m-b-sm" level={5}>
                            Create UI Schema
                          </Typography.Title>
                          <CodeEditor
                            editorClass="task-form-create-ui-schema-editor"
                            value={createUiSchemaValue}
                            onChange={(value) => {
                              setCreateUiSchemaValue(value);
                              const nextFormSchema = parseJsonObject(
                                createFormSchemaValue
                              );
                              const nextUiSchema = parseJsonObject(value);

                              if (nextFormSchema) {
                                setCreateFields(
                                  parseSchemaToDesignerFields(
                                    nextFormSchema,
                                    nextUiSchema
                                  )
                                );
                              }
                            }}
                          />

                          <Typography.Title className="m-b-sm" level={5}>
                            Transition Forms
                          </Typography.Title>
                          <CodeEditor
                            editorClass="task-form-transition-forms-editor"
                            value={transitionFormsValue}
                            onChange={(value) => {
                              setTransitionFormsValue(value);
                              const nextTransitionForms =
                                parseJsonObject(value);

                              if (nextTransitionForms) {
                                setTransitionBuilders(
                                  parseTransitionForms(
                                    nextTransitionForms as TaskFormSchema['transitionForms']
                                  )
                                );
                              }
                            }}
                          />

                          <Typography.Title className="m-b-sm" level={5}>
                            Default Stage Mappings
                          </Typography.Title>
                          <CodeEditor
                            editorClass="task-form-stage-mappings-editor"
                            value={defaultStageMappingsValue}
                            onChange={(value) => {
                              setDefaultStageMappingsValue(value);
                              const nextStageMappings = parseJsonObject(value);

                              if (nextStageMappings) {
                                setStageMappings(
                                  parseStageMappings(
                                    nextStageMappings as TaskFormSchema['defaultStageMappings']
                                  )
                                );
                              }
                            }}
                          />

                          <Typography.Title className="m-b-sm" level={5}>
                            Workflow Definition JSON
                          </Typography.Title>
                          <CodeEditor
                            editorClass="task-form-workflow-definition-editor"
                            value={workflowDefinitionValue}
                            onChange={(value) =>
                              setWorkflowDefinitionValue(value)
                            }
                          />
                        </div>
                      ),
                    },
                  ]}
                />
              </Card>
            </section>
          </div>
        </Form>
      </div>
    </PageLayoutV1>
  );
};

export default TaskFormSettingsPage;
