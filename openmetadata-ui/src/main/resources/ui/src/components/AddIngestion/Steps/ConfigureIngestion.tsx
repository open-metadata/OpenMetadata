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

import { Button, Form, InputNumber, Select, Typography } from 'antd';
import { isNil } from 'lodash';
import React, { Fragment, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FieldProp, FieldTypes, generateFormFields } from 'utils/formUtils';
import { PROFILE_SAMPLE_OPTIONS } from '../../../constants/profiler.constant';
import { FilterPatternEnum } from '../../../enums/filterPattern.enum';
import { FormSubmitType } from '../../../enums/form.enum';
import { ServiceCategory } from '../../../enums/service.enum';
import { ProfileSampleType } from '../../../generated/entity/data/table';
import { PipelineType } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { getSeparator } from '../../../utils/CommonUtils';
import FilterPattern from '../../common/FilterPattern/FilterPattern';
import RichTextEditor from '../../common/rich-text-editor/RichTextEditor';
import { EditorContentRef } from '../../common/rich-text-editor/RichTextEditor.interface';
import ToggleSwitchV1 from '../../common/toggle-switch/ToggleSwitchV1';
import { Field } from '../../Field/Field';
import SliderWithInput from '../../SliderWithInput/SliderWithInput';
import {
  AddIngestionState,
  ConfigureIngestionProps,
  ShowFilter,
} from '../addIngestion.interface';

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
}: ConfigureIngestionProps) => {
  const { t } = useTranslation();
  const markdownRef = useRef<EditorContentRef>();

  const {
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
    overrideOwner,
  } = useMemo(
    () => ({
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
      overrideOwner: data.overrideOwner,
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

  const handleValueParseInt =
    (property: keyof AddIngestionState) =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      onChange({
        [property]: parseInt(event.target.value),
      });

  const handleValueChange =
    (property: keyof AddIngestionState) =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      onChange({
        [property]: event.target.value,
      });

  const handleProfileSample = (profileSample: number | undefined | null) =>
    onChange({
      profileSample: profileSample ?? undefined,
    });

  const handleConfidenceScore = (confidence: number | undefined | null) =>
    onChange({
      confidence: confidence ?? undefined,
    });

  const handleProfileSampleTypeChange = (value: ProfileSampleType) => {
    onChange({
      profileSampleType: value,
    });

    handleProfileSample(undefined);
  };

  const handleDashBoardServiceNames = (inputValue: string[]) => {
    if (inputValue) {
      onChange({
        databaseServiceNames: inputValue,
      });
    }
  };

  const handleEnableDebugLogCheck = () => toggleField('enableDebugLog');

  const handleOverrideOwner = () => toggleField('overrideOwner');

  const handleIncludeLineage = () => toggleField('includeLineage');

  const handleIncludeTags = () => toggleField('includeTags');

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

  const handleQueryLogDuration = handleValueParseInt('queryLogDuration');

  const handleResultLimit = handleValueParseInt('resultLimit');

  const handleStageFileLocation = handleValueChange('stageFileLocation');

  const handleThreadCount = handleValueParseInt('threadCount');

  const handleTimeoutSeconds = handleValueParseInt('timeoutSeconds');

  const handleIngestionName = handleValueChange('ingestionName');

  const getIngestSampleToggle = (label: string, desc: string) => {
    return (
      <>
        <Field>
          <div className="tw-flex tw-gap-1">
            <label>{label}</label>
            <ToggleSwitchV1
              checked={ingestSampleData}
              handleCheck={handleIngestSampleToggle}
              testId="ingest-sample-data"
            />
          </div>
          <p className="tw-text-grey-muted tw-mt-3">{desc}</p>
        </Field>
        {getSeparator('')}
      </>
    );
  };

  const getDebugLogToggle = () => {
    return (
      <Field>
        <div className="tw-flex tw-gap-1">
          <label>{t('label.enable-debug-log')}</label>
          <ToggleSwitchV1
            checked={enableDebugLog}
            handleCheck={handleEnableDebugLogCheck}
            testId="enable-debug-log"
          />
        </div>
        <p className="tw-text-grey-muted tw-mt-3">
          {t('message.enable-debug-logging')}
        </p>
        {getSeparator('')}
      </Field>
    );
  };

  const getProfileSample = () => {
    return (
      <>
        <Form.Item
          className="m-t-sm"
          initialValue={profileSampleType || ProfileSampleType.Percentage}
          label={t('label.profile-sample-type', {
            type: t('label.type'),
          })}
          name="profileSample">
          <Select
            data-testid="profile-sample"
            options={PROFILE_SAMPLE_OPTIONS}
            value={profileSampleType}
            onChange={handleProfileSampleTypeChange}
          />
        </Form.Item>
        <Form.Item
          className="m-b-xs"
          label={t('label.profile-sample-type', {
            type: t('label.value'),
          })}
          name="profile-sample-value">
          {profileSampleType === ProfileSampleType.Percentage && (
            <>
              <Typography.Paragraph className="text-grey-muted m-t-0 m-b-xs text-sm">
                {t('message.profile-sample-percentage-message')}
              </Typography.Paragraph>
              <SliderWithInput
                value={profileSample || 100}
                onChange={handleProfileSample}
              />
            </>
          )}
          {profileSampleType === ProfileSampleType.Rows && (
            <>
              <Typography.Paragraph className="text-grey-muted m-t-0 m-b-xs text-sm">
                {t('message.profile-sample-row-count-message')}
              </Typography.Paragraph>
              <InputNumber
                className="w-full"
                data-testid="metric-number-input"
                min={0}
                placeholder={t('label.please-enter-value', {
                  name: t('label.row-count-lowercase'),
                })}
                value={profileSample}
                onChange={handleProfileSample}
              />
            </>
          )}
        </Form.Item>
      </>
    );
  };

  const getThreadCount = () => {
    return (
      <div>
        <label>
          {t('label.entity-count', {
            entity: t('label.thread'),
          })}
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-sm">
          {t('message.thread-count-message')}
        </p>
        <input
          className="tw-form-inputs tw-form-inputs-padding tw-w-24"
          data-testid="threadCount"
          id="threadCount"
          name="threadCount"
          placeholder="5"
          type="number"
          value={threadCount}
          onChange={handleThreadCount}
        />
      </div>
    );
  };

  const getTimeoutSeconds = () => {
    return (
      <div>
        <label>{t('label.profiler-timeout-second-plural-label')}</label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-sm">
          {t('message.profiler-timeout-seconds-message')}
        </p>
        <input
          className="tw-form-inputs tw-form-inputs-padding tw-w-24"
          data-testid="timeoutSeconds"
          id="timeoutSeconds"
          name="timeoutSeconds"
          placeholder="43200"
          type="number"
          value={timeoutSeconds}
          onChange={handleTimeoutSeconds}
        />
      </div>
    );
  };

  const getProcessPiiTogglesForProfiler = () => {
    return (
      <Fragment>
        <Field>
          <div className="tw-flex tw-gap-1">
            <label>{t('label.auto-tag-pii-uppercase')}</label>
            <ToggleSwitchV1
              checked={processPii}
              handleCheck={handleProcessPii}
              testId="include-lineage"
            />
          </div>
          <p className="tw-text-grey-muted tw-mt-3">
            {t('message.process-pii-sensitive-column-message-profiler')}
          </p>
          {processPii && (
            <>
              {getSeparator('')}
              <Typography.Paragraph className="text-grey-muted m-t-0 m-b-xs text-sm">
                {t('message.confidence-percentage-message')}
              </Typography.Paragraph>
              <SliderWithInput
                value={confidence || 80}
                onChange={handleConfidenceScore}
              />
            </>
          )}
        </Field>
      </Fragment>
    );
  };

  const getFilterPatterns = () => {
    return (
      <div>
        <FilterPattern
          checked={showDatabaseFilter}
          excludePattern={databaseFilterPattern?.excludes ?? []}
          getExcludeValue={getExcludeValue}
          getIncludeValue={getIncludeValue}
          handleChecked={(value) =>
            handleShowFilter(value, ShowFilter.showDatabaseFilter)
          }
          includePattern={databaseFilterPattern?.includes ?? []}
          includePatternExtraInfo={
            data.database
              ? t('message.include-database-filter-extra-information')
              : undefined
          }
          isDisabled={data.isDatabaseFilterDisabled}
          type={FilterPatternEnum.DATABASE}
        />

        <FilterPattern
          checked={showSchemaFilter}
          excludePattern={schemaFilterPattern?.excludes ?? []}
          getExcludeValue={getExcludeValue}
          getIncludeValue={getIncludeValue}
          handleChecked={(value) =>
            handleShowFilter(value, ShowFilter.showSchemaFilter)
          }
          includePattern={schemaFilterPattern?.includes ?? []}
          type={FilterPatternEnum.SCHEMA}
        />
        <FilterPattern
          checked={showTableFilter}
          excludePattern={tableFilterPattern?.excludes ?? []}
          getExcludeValue={getExcludeValue}
          getIncludeValue={getIncludeValue}
          handleChecked={(value) =>
            handleShowFilter(value, ShowFilter.showTableFilter)
          }
          includePattern={tableFilterPattern?.includes ?? []}
          showSeparator={false}
          type={FilterPatternEnum.TABLE}
        />
      </div>
    );
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
      id: 'name',
      helperText: t('message.ingestion-pipeline-name-message'),
      hasSeparator: true,
    },
  ];

  const databaseMetadataFields: FieldProp[] = [
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
      id: 'databaseFilterPattern',
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
      id: 'schemaFilterPattern',
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
      },
      id: 'tableFilterPattern',
      hasSeparator: true,
    },
    {
      name: 'useFqnForFiltering',
      label: t('label.use-fqn-for-filtering'),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        checked: useFqnFilter,
        handleCheck: handleFqnFilter,
      },
      id: 'useFqnForFiltering',
      hasSeparator: true,
      helperText: t('message.use-fqn-for-filtering-message'),
    },
    {
      name: 'includeViews',
      label: t('label.include-entity', { entity: t('label.view-plural') }),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        checked: includeView,
        handleCheck: handleIncludeViewToggle,
        testId: 'include-views',
      },
      id: 'includeViews',
      hasSeparator: true,
      helperText: t('message.include-assets-message', {
        assets: t('label.view-plural'),
      }),
    },
    {
      name: 'includeTags',
      label: t('label.include-entity', { entity: t('label.tag-plural') }),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        checked: includeTags,
        handleCheck: handleIncludeTags,
        testId: 'include-tags',
      },
      id: 'includeTags',
      hasSeparator: true,
      helperText: t('message.include-assets-message'),
    },
    {
      name: 'loggerLevel',
      label: t('label.enable-debug-log'),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        checked: enableDebugLog,
        handleCheck: handleEnableDebugLogCheck,
        testId: 'enable-debug-log',
      },
      id: 'loggerLevel',
      hasSeparator: true,
      helperText: t('message.enable-debug-logging'),
    },
    {
      name: 'markDeletedTables',
      label: t('label.mark-deleted-table-plural'),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        checked: markDeletedTables,
        handleCheck: handleMarkDeletedTables,
        testId: 'mark-deleted',
      },
      id: 'markDeletedTables',
      hasSeparator: true,
      helperText: t('message.mark-deleted-table-message'),
    },
    ...(!isNil(markAllDeletedTables)
      ? [
          {
            name: 'markAllDeletedTables',
            label: t('label.mark-all-deleted-table-plural'),
            type: FieldTypes.SWITCH,
            required: false,
            props: {
              checked: markAllDeletedTables,
              handleCheck: handleMarkAllDeletedTables,
              testId: 'mark-deleted-filter-only',
            },
            id: 'markAllDeletedTables',
            hasSeparator: true,
            helperText: t('message.mark-all-deleted-table-message'),
          },
        ]
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
      id: 'dashboardFilterPattern',
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
      id: 'chartFilterPattern',
      hasSeparator: true,
    },
    {
      name: 'dbServiceNames',
      label: t('label.database-service-name'),
      type: FieldTypes.SELECT,
      required: false,
      id: 'dbServiceNames',
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
    },
    {
      name: 'loggerLevel',
      label: t('label.enable-debug-log'),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        checked: enableDebugLog,
        handleCheck: handleEnableDebugLogCheck,
        testId: 'enable-debug-log',
      },
      id: 'loggerLevel',
      hasSeparator: true,
      helperText: t('message.enable-debug-logging'),
    },
    {
      name: 'overrideOwner',
      label: t('label.override-current-owner'),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        checked: overrideOwner,
        handleCheck: handleOverrideOwner,
        testId: 'enabled-override-owner',
      },
      id: 'overrideOwner',
      hasSeparator: true,
      helperText: t('message.enable-override-owner'),
    },
    {
      name: 'includeTags',
      label: t('label.include-entity', { entity: t('label.tag-plural') }),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        checked: includeTags,
        handleCheck: handleIncludeTags,
        testId: 'include-tags',
      },
      id: 'includeTags',
      hasSeparator: true,
      helperText: t('message.include-assets-message'),
    },
    {
      name: 'markDeletedDashboards',
      label: t('label.mark-deleted-entity', {
        entity: t('label.dashboard-plural'),
      }),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        checked: markDeletedDashboards,
        handleCheck: handleMarkDeletedDashboards,
        testId: 'mark-deleted',
      },
      id: 'markDeletedDashboards',
      hasSeparator: true,
      helperText: t('message.mark-deleted-entity-message', {
        entity: t('label.dashboard-lowercase'),
        entityPlural: t('label.dashboard-lowercase-plural'),
      }),
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
      id: 'topicFilterPattern',
      hasSeparator: true,
    },
    {
      name: 'ingestSampleData',
      label: t('label.ingest-sample-data'),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        checked: ingestSampleData,
        handleCheck: handleIngestSampleToggle,
        testId: 'ingest-sample-data',
      },
      id: 'ingestSampleData',
      hasSeparator: true,
      helperText: t('message.ingest-sample-data-for-entity', {
        entity: t('label.topic-lowercase'),
      }),
    },
    {
      name: 'loggerLevel',
      label: t('label.enable-debug-log'),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        checked: enableDebugLog,
        handleCheck: handleEnableDebugLogCheck,
        testId: 'enable-debug-log',
      },
      id: 'loggerLevel',
      hasSeparator: true,
      helperText: t('message.enable-debug-logging'),
    },
    {
      name: 'markDeletedTopics',
      label: t('label.mark-deleted-entity', {
        entity: t('label.topic-plural'),
      }),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        checked: markDeletedTopics,
        handleCheck: handleMarkDeletedTopics,
        testId: 'mark-deleted',
      },
      id: 'markDeletedTopics',
      hasSeparator: true,
      helperText: t('message.mark-deleted-entity-message', {
        entity: t('label.topic-lowercase'),
        entityPlural: t('label.topic-lowercase-plural'),
      }),
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
      id: 'pipelineFilterPattern',
      hasSeparator: true,
    },
    {
      name: 'includeLineage',
      label: t('label.include-entity', {
        entity: t('label.lineage-lowercase'),
      }),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        checked: includeLineage,
        handleCheck: handleIncludeLineage,
        testId: 'include-lineage',
      },
      id: 'includeLineage',
      hasSeparator: true,
      helperText: t('message.include-lineage-message'),
    },
    {
      name: 'loggerLevel',
      label: t('label.enable-debug-log'),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        checked: enableDebugLog,
        handleCheck: handleEnableDebugLogCheck,
        testId: 'enable-debug-log',
      },
      id: 'loggerLevel',
      hasSeparator: true,
      helperText: t('message.enable-debug-logging'),
    },
    {
      name: 'includeTags',
      label: t('label.include-entity', { entity: t('label.tag-plural') }),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        checked: includeTags,
        handleCheck: handleIncludeTags,
        testId: 'include-tags',
      },
      id: 'includeTags',
      hasSeparator: true,
      helperText: t('message.include-assets-message'),
    },
    {
      name: 'markDeletedPipelines',
      label: t('label.mark-deleted-entity', {
        entity: t('label.pipeline-plural'),
      }),
      type: FieldTypes.SWITCH,
      required: false,
      props: {
        checked: markDeletedPipelines,
        handleCheck: handleMarkDeletedPipelines,
        testId: 'mark-deleted',
      },
      id: 'markDeletedPipelines',
      hasSeparator: true,
      helperText: t('message.mark-deleted-entity-message', {
        entity: t('label.pipeline-lowercase'),
        entityPlural: t('label.pipeline-lowercase-plural'),
      }),
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
      id: 'mlModelFilterPattern',
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
        handleCheck: handleMarkDeletedMlModels,
        testId: 'mark-deleted',
      },
      id: 'markDeletedMlModels',
      hasSeparator: true,
      helperText: t('message.mark-deleted-entity-message', {
        entity: t('label.ml-model-lowercase'),
        entityPlural: t('label.ml-model-lowercase-plural'),
      }),
    },
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
      id: 'containerFilterPattern',
      hasSeparator: true,
    },
  ];

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
      case ServiceCategory.OBJECT_STORE_SERVICES:
        fields = [...fields, ...objectStoreMetadataFields];

        break;

      default:
        break;
    }

    return generateFormFields(fields);
  };

  const getUsageFields = () => {
    return (
      <>
        <Field>
          <label
            className="tw-block tw-form-label tw-mb-1"
            htmlFor="query-log-duration">
            {t('label.query-log-duration')}
          </label>
          <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-sm">
            {t('message.query-log-duration-message')}
          </p>
          <input
            className="tw-form-inputs tw-form-inputs-padding"
            data-testid="query-log-duration"
            id="query-log-duration"
            name="query-log-duration"
            type="number"
            value={queryLogDuration}
            onChange={handleQueryLogDuration}
          />
          {getSeparator('')}
        </Field>
        <Field>
          <label
            className="tw-block tw-form-label tw-mb-1"
            htmlFor="stage-file-location">
            {t('label.stage-file-location')}
          </label>
          <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-sm">
            {t('message.stage-file-location-message')}
          </p>
          <input
            className="tw-form-inputs tw-form-inputs-padding"
            data-testid="stage-file-location"
            id="stage-file-location"
            name="stage-file-location"
            type="text"
            value={stageFileLocation}
            onChange={handleStageFileLocation}
          />
          {getSeparator('')}
        </Field>
        <Field>
          <label
            className="tw-block tw-form-label tw-mb-1"
            htmlFor="result-limit">
            {t('label.result-limit')}
          </label>
          <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-sm">
            {t('message.result-limit-message')}
          </p>
          <input
            className="tw-form-inputs tw-form-inputs-padding"
            data-testid="result-limit"
            id="result-limit"
            name="result-limit"
            type="number"
            value={resultLimit}
            onChange={handleResultLimit}
          />
          {getSeparator('')}
        </Field>
        {getDebugLogToggle()}
      </>
    );
  };

  const getLineageFields = () => {
    return (
      <>
        <Field>
          <label
            className="tw-block tw-form-label tw-mb-1"
            htmlFor="query-log-duration">
            {t('label.query-log-duration')}
          </label>
          <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-sm">
            {t('message.query-log-duration-message')}
          </p>
          <input
            className="tw-form-inputs tw-form-inputs-padding"
            data-testid="query-log-duration"
            id="query-log-duration"
            name="query-log-duration"
            type="number"
            value={queryLogDuration}
            onChange={handleQueryLogDuration}
          />
          {getSeparator('')}
        </Field>
        <Field>
          <label
            className="tw-block tw-form-label tw-mb-1"
            htmlFor="result-limit">
            {t('label.result-limit')}
          </label>
          <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-sm">
            {t('message.result-limit-message')}
          </p>
          <input
            className="tw-form-inputs tw-form-inputs-padding"
            data-testid="result-limit"
            id="result-limit"
            name="result-limit"
            type="number"
            value={resultLimit}
            onChange={handleResultLimit}
          />
          {getSeparator('')}
        </Field>
        {getDebugLogToggle()}
      </>
    );
  };

  const getProfilerFields = () => {
    return (
      <>
        <div>
          <Field>
            <label className="tw-block tw-form-label tw-mb-1" htmlFor="name">
              {t('label.name')}
            </label>
            <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-sm">
              {t('message.ingestion-pipeline-name-message')}
            </p>
            <input
              className="tw-form-inputs tw-form-inputs-padding"
              data-testid="name"
              id="name"
              name="name"
              type="text"
              value={ingestionName}
              onChange={handleIngestionName}
            />
            {getSeparator('')}
          </Field>
        </div>
        {getFilterPatterns()}
        {getSeparator('')}
        {getProfileSample()}
        {getSeparator('')}
        {getThreadCount()}
        {getSeparator('')}
        {getTimeoutSeconds()}
        {getSeparator('')}
        {getIngestSampleToggle(
          t('label.ingest-sample-data'),
          t('message.ingest-sample-data-for-entity', {
            entity: t('label.profile-lowercase'),
          })
        )}
        {getDebugLogToggle()}
        {getProcessPiiTogglesForProfiler()}
        <div>
          <Field>
            <label className="tw-block tw-form-label tw-mb-1" htmlFor="name">
              {t('label.description')}
            </label>
            <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-sm">
              {t('message.pipeline-description-message')}
            </p>
            <RichTextEditor
              data-testid="description"
              initialValue={description}
              ref={markdownRef}
            />
            {getSeparator('')}
          </Field>
        </div>
      </>
    );
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
      className="p-x-xs"
      data-testid="configure-ingestion-container"
      layout="vertical">
      {getIngestionPipelineFields()}

      <Field className="d-flex justify-end">
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
      </Field>
    </Form>
  );
};

export default ConfigureIngestion;
