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

import { Button, Form, Space } from 'antd';
import { FieldProp, FieldTypes } from 'interface/FormUtils.interface';
import { capitalize, isNil } from 'lodash';
import React, { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { generateFormFields } from 'utils/formUtils';
import { PROFILE_SAMPLE_OPTIONS } from '../../../constants/profiler.constant';
import { FilterPatternEnum } from '../../../enums/filterPattern.enum';
import { FormSubmitType } from '../../../enums/form.enum';
import { ServiceCategory } from '../../../enums/service.enum';
import { ProfileSampleType } from '../../../generated/entity/data/table';
import { PipelineType } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { EditorContentRef } from '../../common/rich-text-editor/RichTextEditor.interface';
import {
  AddIngestionState,
  ConfigureIngestionProps,
  ShowFilter,
} from '../addIngestion.interface';
import './ConfigureIngestion.less';

const ConfigureIngestion = ({
  data,
  formType,
  getExcludeValue,
  getIncludeValue,
  handleShowFilter,
  onCancel,
  onChange,
  onNext,
  pipelineType,
  serviceCategory,
  onFocus,
}: ConfigureIngestionProps) => {
  const { t } = useTranslation();
  const markdownRef = useRef<EditorContentRef>();

  const {
    dataModelFilterPattern,
    chartFilterPattern,
    dashboardFilterPattern,
    databaseFilterPattern,
    containerFilterPattern,
    showContainerFilter,
    databaseServiceNames,
    description,
    enableDebugLog,
    includeLineage,
    includeTags,
    includeView,
    includeDataModels,
    ingestionName,
    ingestSampleData,
    markAllDeletedTables,
    markDeletedTables,
    markDeletedDashboards,
    markDeletedTopics,
    markDeletedMlModels,
    markDeletedPipelines,
    mlModelFilterPattern,
    pipelineFilterPattern,
    profileSample,
    profileSampleType,
    queryLogDuration,
    resultLimit,
    schemaFilterPattern,
    showDataModelFilter,
    showChartFilter,
    showDashboardFilter,
    showDatabaseFilter,
    showMlModelFilter,
    showPipelineFilter,
    showSchemaFilter,
    showTableFilter,
    showTopicFilter,
    stageFileLocation,
    tableFilterPattern,
    threadCount,
    timeoutSeconds,
    topicFilterPattern,
    useFqnFilter,
    processPii,
    confidence,
    includeOwners,
  } = useMemo(
    () => ({
      dataModelFilterPattern: data.dataModelFilterPattern,
      chartFilterPattern: data.chartFilterPattern,
      dashboardFilterPattern: data.dashboardFilterPattern,
      databaseFilterPattern: data.databaseFilterPattern,
      containerFilterPattern: data.containerFilterPattern,
      showContainerFilter: data.showContainerFilter,
      databaseServiceNames: data.databaseServiceNames,
      description: data.description,
      enableDebugLog: data.enableDebugLog,
      includeLineage: data.includeLineage,
      includeTags: data.includeTags,
      includeView: data.includeView,
      includeDataModels: data.includeDataModels,
      ingestionName: data.ingestionName,
      ingestSampleData: data.ingestSampleData,
      markAllDeletedTables: data.markAllDeletedTables,
      markDeletedTables: data.markDeletedTables,
      mlModelFilterPattern: data.mlModelFilterPattern,
      pipelineFilterPattern: data.pipelineFilterPattern,
      profileSample: data.profileSample,
      profileSampleType: data.profileSampleType,
      queryLogDuration: data.queryLogDuration,
      resultLimit: data.resultLimit,
      schemaFilterPattern: data.schemaFilterPattern,
      showDataModelFilter: data.showDataModelFilter,
      showChartFilter: data.showChartFilter,
      showDashboardFilter: data.showDashboardFilter,
      showDatabaseFilter: data.showDatabaseFilter,
      showMlModelFilter: data.showMlModelFilter,
      showPipelineFilter: data.showPipelineFilter,
      showSchemaFilter: data.showSchemaFilter,
      showTableFilter: data.showTableFilter,
      showTopicFilter: data.showTopicFilter,
      stageFileLocation: data.stageFileLocation,
      tableFilterPattern: data.tableFilterPattern,
      threadCount: data.threadCount,
      timeoutSeconds: data.timeoutSeconds,
      topicFilterPattern: data.topicFilterPattern,
      useFqnFilter: data.useFqnFilter,
      processPii: data.processPii,
      includeOwners: data.includeOwners,
      markDeletedDashboards: data.markDeletedDashboards,
      markDeletedTopics: data.markDeletedTopics,
      markDeletedMlModels: data.markDeletedMlModels,
      markDeletedPipelines: data.markDeletedPipelines,
      confidence: data.confidence,
    }),
    [data]
  );

  const toggleField = (field: keyof AddIngestionState) =>
    onChange({ [field]: !data[field] });

  const handleIntValue =
    (property: keyof AddIngestionState) => (value: number | undefined | null) =>
      onChange({
        [property]: value ?? undefined,
      });

  const handleValueChange =
    (property: keyof AddIngestionState) =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      onChange({
        [property]: event.target.value,
      });

  const handleDashBoardServiceNames = (inputValue: string[]) => {
    if (inputValue) {
      onChange({
        databaseServiceNames: inputValue,
      });
    }
  };

  const handleEnableDebugLogCheck = () => toggleField('enableDebugLog');

  const handleIncludeOwners = () => toggleField('includeOwners');

  const handleIncludeLineage = () => toggleField('includeLineage');

  const handleIncludeTags = () => toggleField('includeTags');

  const handleIncludeDataModels = () => toggleField('includeDataModels');

  const handleIncludeViewToggle = () => toggleField('includeView');

  const handleIngestSampleToggle = () => toggleField('ingestSampleData');

  const handleMarkAllDeletedTables = () => toggleField('markAllDeletedTables');

  const handleMarkDeletedTables = () => toggleField('markDeletedTables');

  const handleMarkDeletedDashboards = () =>
    toggleField('markDeletedDashboards');

  const handleMarkDeletedTopics = () => toggleField('markDeletedTopics');

  const handleMarkDeletedMlModels = () => toggleField('markDeletedMlModels');

  const handleMarkDeletedPipelines = () => toggleField('markDeletedPipelines');

  const handleFqnFilter = () => toggleField('useFqnFilter');

  const handleProcessPii = () => toggleField('processPii');

  const handleQueryLogDuration = handleIntValue('queryLogDuration');

  const handleResultLimit = handleIntValue('resultLimit');

  const handleStageFileLocation = handleValueChange('stageFileLocation');

  const handleThreadCount = handleIntValue('threadCount');

  const handleTimeoutSeconds = handleIntValue('timeoutSeconds');

  const handleIngestionName = handleValueChange('ingestionName');

  const handleProfileSample = handleIntValue('profileSample');

  const handleConfidenceScore = handleIntValue('confidence');

  const handleProfileSampleTypeChange = (value: ProfileSampleType) => {
    onChange({
      profileSampleType: value,
    });

    handleProfileSample(undefined);
  };

  const commonMetadataFields: FieldProp[] = [
    {
      name: 'name',
      label: t('label.name'),
      type: FieldTypes.TEXT,
      required: true,
      props: {
        disabled: formType === FormSubmitType.EDIT,
        value: ingestionName,
        onChange: handleIngestionName,
        'data-testid': 'name',
      },
      id: 'root/name',
      helperText: t('message.ingestion-pipeline-name-message'),
      hasSeparator: true,
      formItemProps: {
        initialValue: ingestionName,
      },
    },
  ];

  const databaseServiceFilterPatternFields: FieldProp[] = [
    {
      name: 'databaseFilterPattern',
      label: null,
      type: FieldTypes.FILTER_PATTERN,
      required: false,
      props: {
        checked: showDatabaseFilter,
        excludePattern: databaseFilterPattern?.excludes ?? [],
        getExcludeValue: getExcludeValue,
        getIncludeValue: getIncludeValue,
        handleChecked: (value: boolean) =>
          handleShowFilter(value, ShowFilter.showDatabaseFilter),
        includePattern: databaseFilterPattern?.includes ?? [],
        includePatternExtraInfo: data.database
          ? t('message.include-database-filter-extra-information')
          : undefined,
        isDisabled: data.isDatabaseFilterDisabled,
        type: FilterPatternEnum.DATABASE,
      },
      id: 'root/databaseFilterPattern',
    },
    {
      name: 'schemaFilterPattern',
      label: null,
      type: FieldTypes.FILTER_PATTERN,
      required: false,
      props: {
        checked: showSchemaFilter,
        excludePattern: schemaFilterPattern?.excludes ?? [],
        getExcludeValue: getExcludeValue,
        getIncludeValue: getIncludeValue,
        handleChecked: (value: boolean) =>
          handleShowFilter(value, ShowFilter.showSchemaFilter),
        includePattern: schemaFilterPattern?.includes ?? [],
        type: FilterPatternEnum.SCHEMA,
      },
      id: 'root/schemaFilterPattern',
    },
    {
      name: 'tableFilterPattern',
      label: null,
      type: FieldTypes.FILTER_PATTERN,
      required: false,
      props: {
        checked: showTableFilter,
        excludePattern: tableFilterPattern?.excludes ?? [],
        getExcludeValue: getExcludeValue,
        getIncludeValue: getIncludeValue,
        handleChecked: (value: boolean) =>
          handleShowFilter(value, ShowFilter.showTableFilter),
        includePattern: tableFilterPattern?.includes ?? [],
        type: FilterPatternEnum.TABLE,
        showSeparator: false,
      },
      id: 'root/tableFilterPattern',
      hasSeparator: true,
    },
  ];

  const includeTagsField: FieldProp = {
    name: 'includeTags',
    label: t('label.include-entity', { entity: t('label.tag-plural') }),
    type: FieldTypes.SWITCH,
    required: false,
    props: {
      checked: includeTags,
      onChange: handleIncludeTags,
      'data-testid': 'toggle-button-include-tags',
    },
    id: 'root/includeTags',
    hasSeparator: true,
    helperText: t('message.include-assets-message'),
    formItemLayout: 'horizontal',
    formItemProps: {
      initialValue: includeTags,
      valuePropName: 'checked',
    },
  };

  const loggerLevelField: FieldProp = {
    name: 'loggerLevel',
    label: t('label.enable-debug-log'),
    type: FieldTypes.SWITCH,
    required: false,
    props: {
      checked: enableDebugLog,
      onChange: handleEnableDebugLogCheck,
      'data-testid': 'toggle-button-enable-debug-log',
    },
    id: 'root/loggerLevel',
    hasSeparator: true,
    helperText: t('message.enable-debug-logging'),
    formItemLayout: 'horizontal',
    formItemProps: {
      initialValue: enableDebugLog,
      valuePropName: 'checked',
    },
  };

  const includeDataModelsField: FieldProp = {
    name: 'includeDataModels',
    label: t('label.include-entity', {
      entity: t('label.data-model-plural'),
    }),
    type: FieldTypes.SWITCH,
    required: false,
    props: {
      checked: includeDataModels,
      onChange: handleIncludeDataModels,
      'data-testid': 'toggle-button-include-data-models',
    },
    id: 'root/includeDataModels',
    hasSeparator: true,
    helperText: t('message.include-assets-message', {
      assets: t('label.data-model-plural'),
    }),
    formItemLayout: 'horizontal',
    formItemProps: {
      initialValue: includeDataModels,
      valuePropName: 'checked',
    },
  };

  const generateSampleDataField: FieldProp = {
    name: 'generateSampleData',
    label: t('label.ingest-sample-data'),
    type: FieldTypes.SWITCH,
    required: false,
    props: {
      checked: ingestSampleData,
      onChange: handleIngestSampleToggle,
      'data-testid': 'toggle-button-ingest-sample-data',
    },
    id: 'root/generateSampleData',
    hasSeparator: true,
    helperText: t('message.ingest-sample-data-for-entity', {
      entity: t('label.topic-lowercase'),
    }),
    formItemLayout: 'horizontal',
    formItemProps: {
      initialValue: ingestSampleData,
      valuePropName: 'checked',
    },
  };

  const queryLogDurationField: FieldProp = {
    name: 'queryLogDuration',
    label: t('label.query-log-duration'),
    type: FieldTypes.NUMBER,
    helperText: t('message.query-log-duration-message'),
    hasSeparator: true,
    props: {
      className: 'tw-form-inputs tw-form-inputs-padding',
      'data-testid': 'query-log-duration',
      value: queryLogDuration,
      onChange: handleQueryLogDuration,
    },
    id: 'root/queryLogDuration',
    required: false,
    formItemProps: {
      initialValue: queryLogDuration,
    },
  };

  const rateLimitField: FieldProp = {
    name: 'resultLimit',
    label: t('label.result-limit'),
    type: FieldTypes.NUMBER,
    helperText: t('message.result-limit-message'),
    hasSeparator: true,
    props: {
      className: 'tw-form-inputs tw-form-inputs-padding',
      'data-testid': 'result-limit',
      value: resultLimit,
      onChange: handleResultLimit,
    },
    id: 'root/resultLimit',
    required: false,
    formItemProps: {
      initialValue: resultLimit,
    },
  };

  const dbServiceNamesField: FieldProp = {
    name: 'dbServiceNames',
    label: t('label.database-service-name'),
    type: FieldTypes.SELECT,
    required: false,
    id: 'root/dbServiceNames',
    hasSeparator: true,
    props: {
      allowClear: true,
      'data-testid': 'name',
      mode: 'tags',
      placeholder: t('label.add-entity', {
        entity: t('label.database-service-name'),
      }),
      style: { width: '100%' },
      value: databaseServiceNames,
      onChange: handleDashBoardServiceNames,
    },
    formItemProps: {
      initialValue: databaseServiceNames,
    },
  };

  const databaseMetadataFields: FieldProp[] = [
    ...databaseServiceFilterPatternFields,
    {
      name: 'useFqnForFiltering',
      label: t('label.use-fqn-for-filtering'),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        checked: useFqnFilter,
        onChange: handleFqnFilter,
      },
      id: 'root/useFqnForFiltering',
      hasSeparator: true,
      helperText: t('message.use-fqn-for-filtering-message'),
      formItemLayout: 'horizontal',
      formItemProps: {
        initialValue: useFqnFilter,
        valuePropName: 'checked',
      },
    },
    {
      name: 'includeViews',
      label: t('label.include-entity', { entity: t('label.view-plural') }),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        checked: includeView,
        onChange: handleIncludeViewToggle,
        'data-testid': 'toggle-button-include-views',
      },
      id: 'root/includeViews',
      hasSeparator: true,
      helperText: t('message.include-assets-message', {
        assets: t('label.view-plural'),
      }),
      formItemLayout: 'horizontal',
      formItemProps: {
        initialValue: includeView,
        valuePropName: 'checked',
      },
    },
    includeTagsField,
    loggerLevelField,
    {
      name: 'markDeletedTables',
      label: t('label.mark-deleted-table-plural'),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        checked: markDeletedTables,
        onChange: handleMarkDeletedTables,
        'data-testid': 'toggle-button-mark-deleted',
      },
      id: 'root/markDeletedTables',
      hasSeparator: true,
      helperText: t('message.mark-deleted-table-message'),
      formItemLayout: 'horizontal',
      formItemProps: {
        initialValue: markDeletedTables,
        valuePropName: 'checked',
      },
    },
    ...(!isNil(markAllDeletedTables)
      ? ([
          {
            name: 'markAllDeletedTables',
            label: t('label.mark-all-deleted-table-plural'),
            type: FieldTypes.SWITCH,
            required: false,
            props: {
              checked: markAllDeletedTables,
              onChange: handleMarkAllDeletedTables,
              'data-testid': 'toggle-button-mark-deleted-filter-only',
            },
            id: 'root/markAllDeletedTables',
            hasSeparator: true,
            helperText: t('message.mark-all-deleted-table-message'),
            formItemLayout: 'horizontal',
            formItemProps: {
              initialValue: markAllDeletedTables,
              valuePropName: 'checked',
            },
          },
        ] as FieldProp[])
      : []),
  ];

  const dashboardMetadataFields: FieldProp[] = [
    {
      name: 'dashboardFilterPattern',
      label: null,
      type: FieldTypes.FILTER_PATTERN,
      required: false,
      props: {
        checked: showDashboardFilter,
        excludePattern: dashboardFilterPattern?.excludes ?? [],
        getExcludeValue: getExcludeValue,
        getIncludeValue: getIncludeValue,
        handleChecked: (value: boolean) =>
          handleShowFilter(value, ShowFilter.showDashboardFilter),
        includePattern: dashboardFilterPattern?.includes ?? [],
        type: FilterPatternEnum.DASHBOARD,
      },
      id: 'root/dashboardFilterPattern',
    },
    {
      name: 'chartFilterPattern',
      label: null,
      type: FieldTypes.FILTER_PATTERN,
      required: false,
      props: {
        checked: showChartFilter,
        excludePattern: chartFilterPattern?.excludes ?? [],
        getExcludeValue: getExcludeValue,
        getIncludeValue: getIncludeValue,
        handleChecked: (value: boolean) =>
          handleShowFilter(value, ShowFilter.showChartFilter),
        includePattern: chartFilterPattern?.includes ?? [],
        type: FilterPatternEnum.CHART,
      },
      id: 'root/chartFilterPattern',
    },
    {
      name: 'dataModelFilterPattern',
      label: null,
      type: FieldTypes.FILTER_PATTERN,
      required: false,
      props: {
        checked: showDataModelFilter,
        excludePattern: dataModelFilterPattern?.excludes ?? [],
        getExcludeValue: getExcludeValue,
        getIncludeValue: getIncludeValue,
        handleChecked: (value: boolean) =>
          handleShowFilter(value, ShowFilter.showDataModelFilter),
        includePattern: dataModelFilterPattern?.includes ?? [],
        type: FilterPatternEnum.DASHBOARD_DATAMODEL,
      },
      id: 'root/dataModelFilterPattern',
      hasSeparator: true,
    },
    dbServiceNamesField,
    loggerLevelField,
    {
      name: 'includeOwners',
      label: t('label.include-owner'),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        checked: includeOwners,
        onChange: handleIncludeOwners,
        'data-testid': 'toggle-button-enabled-override-owner',
      },
      id: 'root/includeOwners',
      hasSeparator: true,
      helperText: t('message.include-owner'),
      formItemLayout: 'horizontal',
      formItemProps: {
        initialValue: includeOwners,
        valuePropName: 'checked',
      },
    },
    includeTagsField,
    includeDataModelsField,
    {
      name: 'markDeletedDashboards',
      label: t('label.mark-deleted-entity', {
        entity: t('label.dashboard-plural'),
      }),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        checked: markDeletedDashboards,
        onChange: handleMarkDeletedDashboards,
        'data-testid': 'toggle-button-mark-deleted',
      },
      id: 'root/markDeletedDashboards',
      hasSeparator: true,
      helperText: t('message.mark-deleted-entity-message', {
        entity: t('label.dashboard-lowercase'),
        entityPlural: t('label.dashboard-lowercase-plural'),
      }),
      formItemLayout: 'horizontal',
      formItemProps: {
        initialValue: markDeletedDashboards,
        valuePropName: 'checked',
      },
    },
  ];

  const messagingMetadataFields: FieldProp[] = [
    {
      name: 'topicFilterPattern',
      label: null,
      type: FieldTypes.FILTER_PATTERN,
      required: false,
      props: {
        checked: showTopicFilter,
        excludePattern: topicFilterPattern?.excludes ?? [],
        getExcludeValue: getExcludeValue,
        getIncludeValue: getIncludeValue,
        handleChecked: (value: boolean) =>
          handleShowFilter(value, ShowFilter.showTopicFilter),
        includePattern: topicFilterPattern?.includes ?? [],
        type: FilterPatternEnum.TOPIC,
      },
      id: 'root/topicFilterPattern',
      hasSeparator: true,
    },
    generateSampleDataField,
    loggerLevelField,
    {
      name: 'markDeletedTopics',
      label: t('label.mark-deleted-entity', {
        entity: t('label.topic-plural'),
      }),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        checked: markDeletedTopics,
        onChange: handleMarkDeletedTopics,
        'data-testid': 'toggle-button-mark-deleted',
      },
      id: 'root/markDeletedTopics',
      hasSeparator: true,
      helperText: t('message.mark-deleted-entity-message', {
        entity: t('label.topic-lowercase'),
        entityPlural: t('label.topic-lowercase-plural'),
      }),
      formItemLayout: 'horizontal',
      formItemProps: {
        initialValue: markDeletedTopics,
        valuePropName: 'checked',
      },
    },
  ];

  const pipelineMetadataFields: FieldProp[] = [
    {
      name: 'pipelineFilterPattern',
      label: null,
      type: FieldTypes.FILTER_PATTERN,
      required: false,
      props: {
        checked: showPipelineFilter,
        excludePattern: pipelineFilterPattern?.excludes ?? [],
        getExcludeValue: getExcludeValue,
        getIncludeValue: getIncludeValue,
        handleChecked: (value: boolean) =>
          handleShowFilter(value, ShowFilter.showPipelineFilter),
        includePattern: pipelineFilterPattern?.includes ?? [],
        type: FilterPatternEnum.PIPELINE,
      },
      id: 'root/pipelineFilterPattern',
      hasSeparator: true,
    },
    dbServiceNamesField,
    {
      name: 'includeLineage',
      label: t('label.include-entity', {
        entity: t('label.lineage'),
      }),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        checked: includeLineage,
        onChange: handleIncludeLineage,
        'data-testid': 'toggle-button-include-lineage',
      },
      id: 'root/includeLineage',
      hasSeparator: true,
      helperText: t('message.include-lineage-message'),
      formItemLayout: 'horizontal',
      formItemProps: {
        initialValue: includeLineage,
        valuePropName: 'checked',
      },
    },
    loggerLevelField,
    includeTagsField,
    {
      name: 'markDeletedPipelines',
      label: t('label.mark-deleted-entity', {
        entity: t('label.pipeline-plural'),
      }),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        checked: markDeletedPipelines,
        onChange: handleMarkDeletedPipelines,
        'data-testid': 'toggle-button-mark-deleted',
      },
      id: 'root/markDeletedPipelines',
      hasSeparator: true,
      helperText: t('message.mark-deleted-entity-message', {
        entity: t('label.pipeline-lowercase'),
        entityPlural: t('label.pipeline-lowercase-plural'),
      }),
      formItemLayout: 'horizontal',
      formItemProps: {
        initialValue: markDeletedPipelines,
        valuePropName: 'checked',
      },
    },
  ];

  const mlModelMetadataFields: FieldProp[] = [
    {
      name: 'mlModelFilterPattern',
      label: null,
      type: FieldTypes.FILTER_PATTERN,
      required: false,
      props: {
        checked: showMlModelFilter,
        excludePattern: mlModelFilterPattern?.excludes ?? [],
        getExcludeValue: getExcludeValue,
        getIncludeValue: getIncludeValue,
        handleChecked: (value: boolean) =>
          handleShowFilter(value, ShowFilter.showMlModelFilter),
        includePattern: mlModelFilterPattern?.includes ?? [],
        type: FilterPatternEnum.MLMODEL,
      },
      id: 'root/mlModelFilterPattern',
      hasSeparator: true,
    },
    {
      name: 'markDeletedMlModels',
      label: t('label.mark-deleted-entity', {
        entity: t('label.ml-model-plural'),
      }),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        checked: markDeletedMlModels,
        onChange: handleMarkDeletedMlModels,
        'data-testid': 'toggle-button-mark-deleted',
      },
      id: 'root/markDeletedMlModels',
      hasSeparator: true,
      helperText: t('message.mark-deleted-entity-message', {
        entity: t('label.ml-model-lowercase'),
        entityPlural: t('label.ml-model-lowercase-plural'),
      }),
      formItemLayout: 'horizontal',
      formItemProps: {
        initialValue: markDeletedMlModels,
        valuePropName: 'checked',
      },
    },
    loggerLevelField,
  ];

  const objectStoreMetadataFields: FieldProp[] = [
    {
      name: 'containerFilterPattern',
      label: null,
      type: FieldTypes.FILTER_PATTERN,
      required: false,
      props: {
        checked: showContainerFilter,
        excludePattern: containerFilterPattern?.excludes ?? [],
        getExcludeValue: getExcludeValue,
        getIncludeValue: getIncludeValue,
        handleChecked: (value: boolean) =>
          handleShowFilter(value, ShowFilter.showContainerFilter),
        includePattern: containerFilterPattern?.includes ?? [],
        type: FilterPatternEnum.CONTAINER,
      },
      id: 'root/containerFilterPattern',
      hasSeparator: true,
    },
    loggerLevelField,
  ];

  const metadataServiceMetadataFields: FieldProp[] = [loggerLevelField];

  const getMetadataFields = () => {
    let fields = [...commonMetadataFields];

    switch (serviceCategory) {
      case ServiceCategory.DATABASE_SERVICES:
        fields = [...fields, ...databaseMetadataFields];

        break;
      case ServiceCategory.DASHBOARD_SERVICES:
        fields = [...fields, ...dashboardMetadataFields];

        break;
      case ServiceCategory.PIPELINE_SERVICES:
        fields = [...fields, ...pipelineMetadataFields];

        break;
      case ServiceCategory.MESSAGING_SERVICES:
        fields = [...fields, ...messagingMetadataFields];

        break;
      case ServiceCategory.ML_MODEL_SERVICES:
        fields = [...fields, ...mlModelMetadataFields];

        break;
      case ServiceCategory.STORAGE_SERVICES:
        fields = [...fields, ...objectStoreMetadataFields];

        break;

      case ServiceCategory.METADATA_SERVICES:
        fields = [...fields, ...metadataServiceMetadataFields];

        break;

      default:
        break;
    }

    return generateFormFields(fields);
  };

  const getUsageFields = () => {
    const fields: FieldProp[] = [
      queryLogDurationField,
      {
        name: 'stageFileLocation',
        label: t('label.stage-file-location'),
        type: FieldTypes.TEXT,
        helperText: t('message.stage-file-location-message'),
        hasSeparator: true,
        props: {
          className: 'tw-form-inputs tw-form-inputs-padding',
          'data-testid': 'stage-file-location',
          value: stageFileLocation,
          onChange: handleStageFileLocation,
        },
        id: 'root/stageFileLocation',
        required: false,
        formItemProps: {
          initialValue: stageFileLocation,
        },
      },
      rateLimitField,
      loggerLevelField,
    ];

    return generateFormFields(fields);
  };

  const getLineageFields = () => {
    const fields: FieldProp[] = [
      queryLogDurationField,
      rateLimitField,
      loggerLevelField,
    ];

    return generateFormFields(fields);
  };

  const getProfilerFields = () => {
    const fields: FieldProp[] = [
      ...commonMetadataFields,
      ...databaseServiceFilterPatternFields,
      {
        name: 'profileSampleType',
        id: 'root/profileSampleType',
        label: t('label.profile-sample-type', {
          type: t('label.type'),
        }),
        type: FieldTypes.SELECT,
        props: {
          'data-testid': 'profile-sample',
          options: PROFILE_SAMPLE_OPTIONS,
          value: profileSampleType,
          onChange: handleProfileSampleTypeChange,
        },
        required: false,
        formItemProps: {
          initialValue: profileSampleType,
        },
      },
      ...(profileSampleType === ProfileSampleType.Percentage
        ? [
            {
              name: 'profileSample',
              id: 'root/profileSample',
              label: capitalize(ProfileSampleType.Percentage),
              helperText: t('message.profile-sample-percentage-message'),
              required: false,
              type: FieldTypes.SLIDER_INPUT,
              props: {
                value: profileSample || 100,
                onChange: handleProfileSample,
              },
              formItemProps: {
                initialValue: profileSample || 100,
              },
            },
          ]
        : []),
      ...(profileSampleType === ProfileSampleType.Rows
        ? [
            {
              name: 'profileSample',
              id: 'root/profileSample',
              label: capitalize(ProfileSampleType.Rows),
              helperText: t('message.profile-sample-row-count-message'),
              required: false,
              type: FieldTypes.NUMBER,
              props: {
                className: 'w-full',
                'data-testid': 'metric-number-input',
                min: 0,
                placeholder: t('label.please-enter-value', {
                  name: t('label.row-count-lowercase'),
                }),
                value: profileSample,
                onChange: handleProfileSample,
              },
              formItemProps: {
                initialValue: profileSample,
              },
            },
          ]
        : []),
      {
        name: 'threadCount',
        id: 'root/threadCount',
        helperText: t('message.thread-count-message'),
        label: t('label.entity-count', {
          entity: t('label.thread'),
        }),
        required: false,
        type: FieldTypes.NUMBER,
        props: {
          className: 'tw-form-inputs tw-form-inputs-padding tw-w-24',
          'data-testid': 'threadCount',
          placeholder: '5',
          value: threadCount,
          min: 1,
          onChange: handleThreadCount,
        },
        formItemProps: {
          initialValue: threadCount,
        },
      },
      {
        name: 'timeoutSeconds',
        id: 'root/timeoutSeconds',
        helperText: t('message.profiler-timeout-seconds-message'),
        label: t('label.profiler-timeout-second-plural-label'),
        required: false,
        type: FieldTypes.NUMBER,
        props: {
          className: 'tw-form-inputs tw-form-inputs-padding tw-w-24',
          'data-testid': 'timeoutSeconds',
          placeholder: '43200',
          value: timeoutSeconds,
          min: 1,
          onChange: handleTimeoutSeconds,
        },
        formItemProps: {
          initialValue: timeoutSeconds,
        },
      },
      generateSampleDataField,
      loggerLevelField,
      {
        name: 'processPiiSensitive',
        label: t('label.auto-tag-pii-uppercase'),
        type: FieldTypes.SWITCH,
        required: false,
        props: {
          checked: processPii,
          onChange: handleProcessPii,
          'data-testid': 'toggle-button-process-pii',
        },
        id: 'root/processPiiSensitive',
        hasSeparator: processPii,
        helperText: t('message.process-pii-sensitive-column-message-profiler'),
        formItemLayout: 'horizontal',
        formItemProps: {
          initialValue: processPii,
          valuePropName: 'checked',
        },
      },
      ...(processPii
        ? [
            {
              name: 'confidence',
              id: 'root/confidence',
              label: t('label.auto-pii-confidence-score'),
              helperText: t('message.confidence-percentage-message'),
              required: false,
              type: FieldTypes.SLIDER_INPUT,
              props: {
                value: confidence || 80,
                onChange: handleConfidenceScore,
              },
              formItemProps: {
                initialValue: confidence || 80,
              },
            },
          ]
        : []),
      {
        name: 'description',
        id: 'root/description',
        label: t('label.description'),
        helperText: t('message.pipeline-description-message'),
        required: false,
        hasSeparator: true,
        props: {
          'data-testid': 'description',
          initialValue: description,
          ref: markdownRef,
        },
        type: FieldTypes.DESCRIPTION,
      },
    ];

    return generateFormFields(fields);
  };

  const getIngestionPipelineFields = () => {
    switch (pipelineType) {
      case PipelineType.Usage: {
        return getUsageFields();
      }
      case PipelineType.Lineage: {
        return getLineageFields();
      }
      case PipelineType.Profiler: {
        return getProfilerFields();
      }
      case PipelineType.Metadata:
      default: {
        return getMetadataFields();
      }
    }
  };

  const handleNext = () => {
    onChange({
      description: markdownRef.current?.getEditorContent() || '',
    });
    onNext();
  };

  return (
    <Form
      className="p-x-xs configure-ingestion-form"
      data-testid="configure-ingestion-container"
      layout="vertical"
      onFocus={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onFocus(e.target.id);
      }}>
      {getIngestionPipelineFields()}

      <Space className="w-full justify-end">
        <Button
          className="m-r-xs"
          data-testid="back-button"
          type="link"
          onClick={onCancel}>
          <span>{t('label.cancel')}</span>
        </Button>

        <Button
          className="font-medium p-x-md p-y-xxs h-auto rounded-6"
          data-testid="next-button"
          type="primary"
          onClick={handleNext}>
          <span>{t('label.next')}</span>
        </Button>
      </Space>
    </Form>
  );
};

export default ConfigureIngestion;
