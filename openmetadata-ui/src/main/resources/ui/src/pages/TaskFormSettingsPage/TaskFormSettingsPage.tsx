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
  Box,
  Button,
  Card,
  FormField,
  HookForm,
  Input,
  Select,
  Tabs,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { FC, lazy, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import withSuspenseFallback from '../../components/AppRouter/withSuspenseFallback';
import Loader from '../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
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

const CodeEditor = withSuspenseFallback(
  lazy(() => import('../../components/Database/SchemaEditor/CodeEditor'))
);

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

// Lookup table replacing a per-task-type switch; unmapped task types fall
// through to `undefined`, matching the previous switch's `default`.
const DEFAULT_WORKFLOW_DEFINITION_REF_BY_TASK_TYPE: Record<string, string> = {
  DescriptionUpdate: 'DescriptionUpdateTaskWorkflow',
  TagUpdate: 'TagUpdateTaskWorkflow',
  OwnershipUpdate: 'OwnershipUpdateTaskWorkflow',
  TierUpdate: 'TierUpdateTaskWorkflow',
  DomainUpdate: 'DomainUpdateTaskWorkflow',
  GlossaryApproval: 'GlossaryApprovalTaskWorkflow',
  RequestApproval: 'RequestApprovalTaskWorkflow',
  Suggestion: 'SuggestionTaskWorkflow',
  TestCaseResolution: 'TestCaseResolutionTaskWorkflow',
  IncidentResolution: 'IncidentResolutionTaskWorkflow',
  CustomTask: 'CustomTaskWorkflow',
};

const getDefaultWorkflowDefinitionRef = (
  taskType?: string
): string | undefined =>
  taskType ? DEFAULT_WORKFLOW_DEFINITION_REF_BY_TASK_TYPE[taskType] : undefined;

// Returns the first non-empty string, mirroring a `||` fallback chain without
// adding a branch per operand to the caller's complexity.
const firstTruthyString = (
  ...values: Array<string | undefined>
): string | undefined => values.find((value) => Boolean(value));

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

const SchemaSidebarCard: FC<{
  loading: boolean;
  schemas: TaskFormSchema[];
  selectedSchema: TaskFormSchema;
  onSelectSchema: (schema: TaskFormSchema) => void;
  onAddNew: () => void;
  t: (key: string) => string;
}> = ({ loading, schemas, selectedSchema, onSelectSchema, onAddNew, t }) => (
  <Card className="task-form-settings-sidebar-card">
    <Card.Header title="Schemas" />
    <Card.Content>
      {loading ? (
        <div className="text-center p-y-lg">
          <Loader size="small" />
        </div>
      ) : (
        <div className="task-form-settings-schema-list">
          {schemas.length ? (
            schemas.map((schema) => {
              const isActive = schema.id === selectedSchema.id;

              return (
                <button
                  className={`task-form-settings-schema-item ${
                    isActive ? 'task-form-settings-schema-item--active' : ''
                  }`}
                  data-testid={`task-form-list-item-${schema.name}`}
                  key={schema.id ?? schema.name}
                  type="button"
                  onClick={() => onSelectSchema(schema)}>
                  <Typography className="task-form-settings-schema-item__title">
                    {schema.displayName ?? schema.name}
                  </Typography>
                  <Typography className="task-form-settings-schema-item__meta">
                    {`${schema.taskType} / ${schema.taskCategory ?? '-'}`}
                  </Typography>
                </button>
              );
            })
          ) : (
            <Typography color="secondary">
              {t('message.no-task-forms-found')}
            </Typography>
          )}
        </div>
      )}

      <Button
        className="tw:w-full"
        color="primary"
        data-testid="task-form-add-button"
        onClick={onAddNew}>
        {t('label.add')}
      </Button>
    </Card.Content>
  </Card>
);

const TransitionFormsPane: FC<{
  transitionBuilders: TaskFormDesignerTransition[];
  syncTransitionDesigner: (transitions: TaskFormDesignerTransition[]) => void;
  t: (key: string) => string;
}> = ({ transitionBuilders, syncTransitionDesigner, t }) => (
  <div className="task-form-settings-transition-pane">
    <div className="task-form-settings-section-header">
      <div>
        <Typography as="h5" className="m-b-xs" size="text-md" weight="semibold">
          {t('label.transition-form-plural')}
        </Typography>
        <Typography as="p" className="m-b-0" color="secondary">
          {t('message.transition-forms-help')}
        </Typography>
      </div>
      <Button
        color="secondary"
        data-testid="task-form-transition-add-button"
        iconLeading={<PlusOutlined />}
        onClick={() =>
          syncTransitionDesigner([
            ...transitionBuilders,
            createEmptyDesignerTransition(),
          ])
        }>
        {t('label.add-transition-form')}
      </Button>
    </div>
    {transitionBuilders.length ? (
      <div className="task-form-settings-transition-list">
        {transitionBuilders.map((transition, index) => (
          <Card
            className="task-form-settings-transition-card"
            data-testid={`task-form-transition-card-${index}`}
            key={transition.key}>
            <Card.Header
              extra={
                <Button
                  color="tertiary-destructive"
                  data-testid={`task-form-transition-remove-${index}`}
                  size="xs"
                  onClick={() =>
                    syncTransitionDesigner(
                      transitionBuilders.filter(
                        (_, currentIndex) => currentIndex !== index
                      )
                    )
                  }>
                  {t('label.remove')}
                </Button>
              }
              title={transition.transitionId || `Transition ${index + 1}`}
            />
            <Card.Content>
              <Input
                isRequired
                inputDataTestId={`task-form-transition-id-${index}`}
                label="Transition Id"
                placeholder="approve"
                value={transition.transitionId}
                onChange={(transitionId) =>
                  syncTransitionDesigner(
                    transitionBuilders.map((currentTransition, currentIndex) =>
                      currentIndex === index
                        ? { ...currentTransition, transitionId }
                        : currentTransition
                    )
                  )
                }
              />
              <TaskFormBuilderSection
                baseFormSchema={
                  transition.config?.formSchema as
                    | Record<string, unknown>
                    | undefined as undefined
                }
                baseUiSchema={
                  transition.config?.uiSchema as
                    | Record<string, unknown>
                    | undefined as undefined
                }
                description="Extra fields shown only for this transition."
                fields={transition.fields}
                testIdPrefix={`task-form-transition-builder-${index}`}
                title="Transition Fields"
                onChange={(fields) =>
                  syncTransitionDesigner(
                    transitionBuilders.map((currentTransition, currentIndex) =>
                      currentIndex === index
                        ? { ...currentTransition, fields }
                        : currentTransition
                    )
                  )
                }
              />
            </Card.Content>
          </Card>
        ))}
      </div>
    ) : (
      <Typography color="secondary">
        {t('message.no-transition-forms-configured')}
      </Typography>
    )}
  </div>
);

const TASK_STATUS_ITEMS = Object.values(TaskEntityStatus).map((status) => ({
  id: status,
  label: status,
}));

// Task Category is optional; this item maps back to an unset category.
const NO_TASK_CATEGORY_KEY = 'none';

const TASK_CATEGORY_ITEMS = Object.values(TaskCategory).map((category) => ({
  id: category,
  label: category,
}));

type TaskFormGeneralValues = Pick<
  TaskFormSchema,
  | 'name'
  | 'displayName'
  | 'description'
  | 'taskType'
  | 'taskCategory'
  | 'workflowDefinitionRef'
>;

type TaskFormTextField = Exclude<
  keyof TaskFormGeneralValues,
  'description' | 'taskCategory'
>;

/** Only the general fields are form-managed; the designer state holds the rest. */
const toGeneralValues = (schema: TaskFormSchema): TaskFormGeneralValues => ({
  name: schema.name ?? '',
  displayName: schema.displayName ?? '',
  description: schema.description ?? '',
  taskType: schema.taskType ?? '',
  taskCategory: schema.taskCategory,
  workflowDefinitionRef: schema.workflowDefinitionRef,
});

const WorkflowStagesPane: FC<{
  stageMappings: TaskFormDesignerStageMapping[];
  syncStageMappings: (mappings: TaskFormDesignerStageMapping[]) => void;
  t: (key: string) => string;
}> = ({ stageMappings, syncStageMappings, t }) => (
  <div className="task-form-settings-stage-pane">
    <div className="task-form-settings-section-header">
      <div>
        <Typography as="h5" className="m-b-xs" size="text-md" weight="semibold">
          {t('label.stage-to-status-mapping')}
        </Typography>
        <Typography as="p" className="m-b-0" color="secondary">
          {t('message.stage-status-mapping-help')}
        </Typography>
      </div>
      <Button
        color="secondary"
        data-testid="task-form-stage-mapping-add-button"
        iconLeading={<PlusOutlined />}
        onClick={() =>
          syncStageMappings([...stageMappings, createEmptyStageMapping()])
        }>
        {t('label.add-stage-mapping')}
      </Button>
    </div>
    {stageMappings.length ? (
      <div className="task-form-settings-stage-grid">
        {stageMappings.map((mapping, index) => (
          <Card
            className="task-form-settings-stage-card"
            data-testid={`task-form-stage-mapping-card-${index}`}
            key={mapping.key}
            size="sm">
            <Card.Header
              extra={
                <Button
                  color="tertiary-destructive"
                  data-testid={`task-form-stage-mapping-remove-${index}`}
                  size="xs"
                  onClick={() =>
                    syncStageMappings(
                      stageMappings.filter(
                        (_, currentIndex) => currentIndex !== index
                      )
                    )
                  }>
                  {t('label.remove')}
                </Button>
              }
              title={mapping.stageId || `Stage ${index + 1}`}
            />
            <Card.Content>
              <div className="task-form-settings-form-grid">
                <Input
                  inputDataTestId={`task-form-stage-id-${index}`}
                  label="Stage Id"
                  placeholder="open"
                  value={mapping.stageId}
                  onChange={(stageId) =>
                    syncStageMappings(
                      stageMappings.map((currentMapping, currentIndex) =>
                        currentIndex === index
                          ? { ...currentMapping, stageId }
                          : currentMapping
                      )
                    )
                  }
                />
                <Select
                  data-testid={`task-form-stage-status-${index}`}
                  items={TASK_STATUS_ITEMS}
                  label="Task Status"
                  selectedKey={mapping.taskStatus || null}
                  onSelectionChange={(key) =>
                    key !== null &&
                    syncStageMappings(
                      stageMappings.map((currentMapping, currentIndex) =>
                        currentIndex === index
                          ? { ...currentMapping, taskStatus: String(key) }
                          : currentMapping
                      )
                    )
                  }>
                  {(item) => <Select.Item id={item.id} label={item.label} />}
                </Select>
              </div>
            </Card.Content>
          </Card>
        ))}
      </div>
    ) : (
      <Typography color="secondary">
        {t('message.no-stage-mappings-configured')}
      </Typography>
    )}
  </div>
);

const TaskFormSettingsPage = () => {
  const { t } = useTranslation();
  const form = useForm<TaskFormGeneralValues>({
    defaultValues: toGeneralValues(EMPTY_SCHEMA),
  });
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
  const [designerTab, setDesignerTab] = useState('create-form');
  const {
    name: watchedName,
    displayName: watchedDisplayName,
    description: watchedDescription,
    taskType: watchedTaskType,
    taskCategory: watchedTaskCategory,
  } = form.watch();

  const taskCategoryItems = useMemo(
    () => [
      { id: NO_TASK_CATEGORY_KEY, label: t('label.none') },
      ...TASK_CATEGORY_ITEMS,
    ],
    [t]
  );

  const breadcrumbs = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.GOVERNANCE,
        t('label.task-form-plural'),
        GlobalSettingOptions.TASK_FORMS
      ),
    [t]
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
    form.reset(toGeneralValues({ ...schema, workflowDefinitionRef }));
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
    const currentValues = form.getValues();
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

  const handleSave = async (values: TaskFormGeneralValues) => {
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

  // The heading for the schema being edited — distinct from the document
  // title, which names the settings page itself.
  const watchedHeading = firstTruthyString(
    watchedDisplayName?.trim(),
    watchedName?.trim()
  );
  const schemaHeading =
    firstTruthyString(
      watchedHeading,
      selectedSchema.displayName,
      selectedSchema.name
    ) ?? 'New Task Form';
  const pageDescription =
    firstTruthyString(watchedDescription?.trim(), selectedSchema.description) ??
    'Configure task schemas, form behavior, and workflow transitions in one workspace.';
  const schemaSubtitle = [watchedTaskType, watchedTaskCategory]
    .filter(Boolean)
    .join(' / ');

  const designerTabs = [
    {
      key: 'create-form',
      label: 'Create Form',
      children: (
        <TaskFormBuilderSection
          baseFormSchema={parseJsonObject(createFormSchemaValue)}
          baseUiSchema={parseJsonObject(createUiSchemaValue)}
          description="Fields shown when a task is created."
          fields={createFields}
          testIdPrefix="task-form-create-builder"
          title="Create Form Fields"
          onChange={(fields) => syncCreateDesigner(fields)}
        />
      ),
    },
    {
      key: 'resolve-form',
      label: 'Resolve Form',
      children: (
        <TaskFormBuilderSection
          baseFormSchema={parseJsonObject(formSchemaValue)}
          baseUiSchema={parseJsonObject(uiSchemaValue)}
          description="Fields shown when the task is reviewed or resolved."
          fields={resolveFields}
          testIdPrefix="task-form-resolve-builder"
          title="Resolve Form Fields"
          onChange={(fields) => syncResolveDesigner(fields)}
        />
      ),
    },
    {
      key: 'transitions',
      label: 'Transition Forms',
      children: (
        <TransitionFormsPane
          syncTransitionDesigner={syncTransitionDesigner}
          t={t}
          transitionBuilders={transitionBuilders}
        />
      ),
    },
    {
      key: 'workflow',
      label: 'Workflow Stages',
      children: (
        <WorkflowStagesPane
          stageMappings={stageMappings}
          syncStageMappings={syncStageMappings}
          t={t}
        />
      ),
    },
  ];

  const primaryTabs = [
    {
      key: 'designer',
      label: 'Designer',
      children: (
        <div className="task-form-settings-designer-pane">
          <Alert
            showIcon
            className="task-form-settings-designer-pane__alert"
            title={t('message.task-form-builder-title')}
            variant="brand">
            {t('message.task-form-builder-description')}
          </Alert>
          <Tabs
            className="tw:gap-6"
            selectedKey={designerTab}
            onSelectionChange={(key) => setDesignerTab(String(key))}>
            <Tabs.List type="underline">
              {designerTabs.map(({ key, label }) => (
                <Tabs.Item id={key} key={key}>
                  {label}
                </Tabs.Item>
              ))}
            </Tabs.List>
            {designerTabs.map(({ key, children }) => (
              <Tabs.Panel id={key} key={key}>
                {children}
              </Tabs.Panel>
            ))}
          </Tabs>
        </div>
      ),
    },
    {
      key: 'advanced',
      label: 'Advanced JSON',
      children: (
        <div className="task-form-settings-json-pane">
          <Typography
            as="h5"
            className="m-b-sm"
            size="text-md"
            weight="semibold">
            {t('label.resolve-form-schema')}
          </Typography>
          <CodeEditor
            editorClass="task-form-schema-editor"
            value={formSchemaValue}
            onChange={(value) => {
              setFormSchemaValue(value);
              const nextFormSchema = parseJsonObject(value);
              const nextUiSchema = parseJsonObject(uiSchemaValue);

              if (nextFormSchema) {
                setResolveFields(
                  parseSchemaToDesignerFields(nextFormSchema, nextUiSchema)
                );
              }
            }}
          />

          <Typography
            as="h5"
            className="m-b-sm"
            size="text-md"
            weight="semibold">
            {t('label.resolve-ui-schema')}
          </Typography>
          <CodeEditor
            editorClass="task-form-ui-schema-editor"
            value={uiSchemaValue}
            onChange={(value) => {
              setUiSchemaValue(value);
              const nextFormSchema = parseJsonObject(formSchemaValue);
              const nextUiSchema = parseJsonObject(value);

              if (nextFormSchema) {
                setResolveFields(
                  parseSchemaToDesignerFields(nextFormSchema, nextUiSchema)
                );
              }
            }}
          />

          <Typography
            as="h5"
            className="m-b-sm"
            size="text-md"
            weight="semibold">
            {t('label.create-form-schema')}
          </Typography>
          <CodeEditor
            editorClass="task-form-create-schema-editor"
            value={createFormSchemaValue}
            onChange={(value) => {
              setCreateFormSchemaValue(value);
              const nextFormSchema = parseJsonObject(value);
              const nextUiSchema = parseJsonObject(createUiSchemaValue);

              if (nextFormSchema) {
                setCreateFields(
                  parseSchemaToDesignerFields(nextFormSchema, nextUiSchema)
                );
              }
            }}
          />

          <Typography
            as="h5"
            className="m-b-sm"
            size="text-md"
            weight="semibold">
            {t('label.create-ui-schema')}
          </Typography>
          <CodeEditor
            editorClass="task-form-create-ui-schema-editor"
            value={createUiSchemaValue}
            onChange={(value) => {
              setCreateUiSchemaValue(value);
              const nextFormSchema = parseJsonObject(createFormSchemaValue);
              const nextUiSchema = parseJsonObject(value);

              if (nextFormSchema) {
                setCreateFields(
                  parseSchemaToDesignerFields(nextFormSchema, nextUiSchema)
                );
              }
            }}
          />

          <Typography
            as="h5"
            className="m-b-sm"
            size="text-md"
            weight="semibold">
            {t('label.transition-form-plural')}
          </Typography>
          <CodeEditor
            editorClass="task-form-transition-forms-editor"
            value={transitionFormsValue}
            onChange={(value) => {
              setTransitionFormsValue(value);
              const nextTransitionForms = parseJsonObject(value);

              if (nextTransitionForms) {
                setTransitionBuilders(
                  parseTransitionForms(
                    nextTransitionForms as TaskFormSchema['transitionForms']
                  )
                );
              }
            }}
          />

          <Typography
            as="h5"
            className="m-b-sm"
            size="text-md"
            weight="semibold">
            {t('label.default-stage-mappings')}
          </Typography>
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

          <Typography
            as="h5"
            className="m-b-sm"
            size="text-md"
            weight="semibold">
            {t('label.workflow-definition-json')}
          </Typography>
          <CodeEditor
            editorClass="task-form-workflow-definition-editor"
            value={workflowDefinitionValue}
            onChange={(value) => setWorkflowDefinitionValue(value)}
          />
        </div>
      ),
    },
  ];

  const renderTextField = (
    name: TaskFormTextField,
    label: string,
    testId: string,
    requiredMessage?: string
  ) => (
    <FormField
      control={form.control}
      name={name}
      rules={requiredMessage ? { required: requiredMessage } : undefined}>
      {({ field, fieldState }) => (
        <Input
          hint={fieldState.error?.message}
          inputDataTestId={testId}
          isInvalid={fieldState.invalid}
          isRequired={Boolean(requiredMessage)}
          label={label}
          value={field.value ?? ''}
          onBlur={field.onBlur}
          onChange={field.onChange}
        />
      )}
    </FormField>
  );

  return (
    <PageLayoutV1 pageTitle={t('label.task-form-plural')}>
      <div
        className="task-form-settings-page"
        data-testid="task-form-settings-page">
        <TitleBreadcrumb titleLinks={breadcrumbs} />
        <HookForm form={form} onSubmit={form.handleSubmit(handleSave)}>
          <div className="task-form-settings-shell">
            <aside className="task-form-settings-sidebar">
              <SchemaSidebarCard
                loading={loading}
                schemas={schemas}
                selectedSchema={selectedSchema}
                t={t}
                onAddNew={handleCreateNew}
                onSelectSchema={handleSelectSchema}
              />
            </aside>

            <section className="task-form-settings-main">
              <div className="task-form-settings-hero">
                <div className="task-form-settings-hero__copy">
                  <Typography className="task-form-settings-hero__eyebrow">
                    {t('label.form-builder')}
                  </Typography>
                  <Typography
                    as="h2"
                    className="task-form-settings-hero__title">
                    {schemaHeading}
                  </Typography>
                  <Typography
                    as="p"
                    className="task-form-settings-hero__description">
                    {pageDescription}
                  </Typography>
                  {schemaSubtitle ? (
                    <Typography className="task-form-settings-hero__meta">
                      {schemaSubtitle}
                    </Typography>
                  ) : null}
                </div>
                <Box
                  inline
                  align="center"
                  className="layout-space layout-space-horizontal task-form-settings-hero__actions"
                  gap={4}
                  itemClassName="layout-space-item">
                  <Button
                    color="secondary"
                    data-testid="task-form-cancel-button"
                    onClick={handleDiscardChanges}>
                    {t('label.cancel')}
                  </Button>
                  <Button
                    color="primary"
                    data-testid="task-form-save-button"
                    isLoading={saving}
                    type="submit">
                    {t('label.save')}
                  </Button>
                </Box>
              </div>

              <div className="task-form-settings-config-grid">
                <Card className="task-form-settings-card">
                  <Card.Header title="General Configuration" />
                  <Card.Content>
                    <div className="task-form-settings-form-grid">
                      {renderTextField(
                        'name',
                        'Name',
                        'task-form-name-input',
                        'Name is required'
                      )}
                      {renderTextField(
                        'displayName',
                        'Display Name',
                        'task-form-display-name-input'
                      )}
                      <div className="task-form-settings-form-grid__span-2">
                        <FormField control={form.control} name="description">
                          {({ field }) => (
                            <TextArea
                              data-testid="task-form-description-input"
                              label="Description"
                              rows={4}
                              value={field.value ?? ''}
                              onBlur={field.onBlur}
                              onChange={field.onChange}
                            />
                          )}
                        </FormField>
                      </div>
                    </div>
                  </Card.Content>
                </Card>

                <Card className="task-form-settings-card task-form-settings-card--sidebar">
                  <Card.Header title="Classification" />
                  <Card.Content>
                    <div className="task-form-settings-card__stack">
                      {renderTextField(
                        'taskType',
                        'Task Type',
                        'task-form-type-input',
                        'Task type is required'
                      )}
                      <FormField control={form.control} name="taskCategory">
                        {({ field }) => (
                          <Select
                            data-testid="task-form-category-input"
                            items={taskCategoryItems}
                            label="Task Category"
                            selectedKey={field.value || NO_TASK_CATEGORY_KEY}
                            onSelectionChange={(key) =>
                              field.onChange(
                                key === null || key === NO_TASK_CATEGORY_KEY
                                  ? undefined
                                  : (key as TaskCategory)
                              )
                            }>
                            {(item) => (
                              <Select.Item id={item.id} label={item.label} />
                            )}
                          </Select>
                        )}
                      </FormField>
                      {renderTextField(
                        'workflowDefinitionRef',
                        'Workflow Definition',
                        'task-form-workflow-definition-input'
                      )}
                      <Button
                        color="secondary"
                        data-testid="task-form-load-template-button"
                        onClick={handleLoadTemplate}>
                        {t('label.load-built-in-template')}
                      </Button>
                    </div>
                  </Card.Content>
                </Card>
              </div>

              <Card className="task-form-settings-card task-form-settings-workspace">
                <Card.Content>
                  <Tabs className="tw:gap-6" defaultSelectedKey="designer">
                    <Tabs.List type="underline">
                      {primaryTabs.map(({ key, label }) => (
                        <Tabs.Item id={key} key={key}>
                          {label}
                        </Tabs.Item>
                      ))}
                    </Tabs.List>
                    {primaryTabs.map(({ key, children }) => (
                      <Tabs.Panel id={key} key={key}>
                        {children}
                      </Tabs.Panel>
                    ))}
                  </Tabs>
                </Card.Content>
              </Card>
            </section>
          </div>
        </HookForm>
      </div>
    </PageLayoutV1>
  );
};

export default TaskFormSettingsPage;
