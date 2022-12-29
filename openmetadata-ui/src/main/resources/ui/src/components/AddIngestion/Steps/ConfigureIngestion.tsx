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

import { Form, InputNumber, Select, Typography } from 'antd';
import { isNil } from 'lodash';
import { EditorContentRef } from 'Models';
import React, { Fragment, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { PROFILE_SAMPLE_OPTIONS } from '../../../constants/profiler.constant';
import { FilterPatternEnum } from '../../../enums/filterPattern.enum';
import { FormSubmitType } from '../../../enums/form.enum';
import { ServiceCategory } from '../../../enums/service.enum';
import { ProfileSampleType } from '../../../generated/entity/data/table';
import { PipelineType } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { getSeparator } from '../../../utils/CommonUtils';
import { Button } from '../../buttons/Button/Button';
import FilterPattern from '../../common/FilterPattern/FilterPattern';
import RichTextEditor from '../../common/rich-text-editor/RichTextEditor';
import ToggleSwitchV1 from '../../common/toggle-switch/ToggleSwitchV1';
import { Field } from '../../Field/Field';
import SliderWithInput from '../../SliderWithInput/SliderWithInput';
import { ConfigureIngestionProps } from '../addIngestion.interface';

const ConfigureIngestion = ({
  ingestionName,
  description = '',
  databaseServiceNames,
  databaseFilterPattern,
  dashboardFilterPattern,
  schemaFilterPattern,
  tableFilterPattern,
  topicFilterPattern,
  chartFilterPattern,
  pipelineFilterPattern,
  mlModelFilterPattern,
  includeLineage,
  includeView,
  includeTags,
  markDeletedTables,
  markAllDeletedTables,
  serviceCategory,
  pipelineType,
  showDatabaseFilter,
  ingestSampleData,
  showDashboardFilter,
  showSchemaFilter,
  showTableFilter,
  showTopicFilter,
  showChartFilter,
  showPipelineFilter,
  showMlModelFilter,
  queryLogDuration,
  stageFileLocation,
  threadCount,
  timeoutSeconds,
  resultLimit,
  enableDebugLog,
  profileSample,
  handleEnableDebugLog,
  getExcludeValue,
  getIncludeValue,
  handleIngestionName,
  handleDescription,
  handleShowFilter,
  handleIncludeLineage,
  handleIncludeView,
  handleIncludeTags,
  handleMarkDeletedTables,
  handleMarkAllDeletedTables,
  handleIngestSampleData,
  handleDatasetServiceName,
  handleQueryLogDuration,
  handleProfileSample,
  handleStageFileLocation,
  handleResultLimit,
  handleThreadCount,
  handleTimeoutSeconds,
  useFqnFilter,
  onUseFqnFilterClick,
  onCancel,
  onNext,
  formType,
  profileSampleType,
  handleProfileSampleType,
}: ConfigureIngestionProps) => {
  const { t } = useTranslation();
  const markdownRef = useRef<EditorContentRef>();

  const handleProfileSampleTypeChange = (value: ProfileSampleType) => {
    handleProfileSampleType(value);
    handleProfileSample(undefined);
  };

  const getIngestSampleToggle = (label: string, desc: string) => {
    return (
      <>
        <Field>
          <div className="tw-flex tw-gap-1">
            <label>{label}</label>
            <ToggleSwitchV1
              checked={ingestSampleData}
              handleCheck={handleIngestSampleData}
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
          <label>Enable Debug Log</label>
          <ToggleSwitchV1
            checked={enableDebugLog}
            handleCheck={handleEnableDebugLog}
            testId="enable-debug-log"
          />
        </div>
        <p className="tw-text-grey-muted tw-mt-3">Enable debug logging</p>
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
                onChange={(value: number | null) =>
                  handleProfileSample(value ?? undefined)
                }
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
                onChange={(value) => handleProfileSample(value ?? undefined)}
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
        <label>Thread Count</label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-sm">
          Set the number of threads to use when computing the metrics. If left
          blank, it will default to 5.
        </p>
        <input
          className="tw-form-inputs tw-form-inputs-padding tw-w-24"
          data-testid="threadCount"
          id="threadCount"
          name="threadCount"
          placeholder="5"
          type="number"
          value={threadCount}
          onChange={(e) => handleThreadCount(parseInt(e.target.value))}
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
          onChange={(e) => handleTimeoutSeconds(parseInt(e.target.value))}
        />
      </div>
    );
  };

  const getDatabaseFieldToggles = () => {
    return (
      <>
        <div>
          <Field>
            <div className="tw-flex tw-gap-1">
              <label>Include views</label>
              <ToggleSwitchV1
                checked={includeView}
                handleCheck={handleIncludeView}
                testId="include-views"
              />
            </div>
            <p className="tw-text-grey-muted tw-mt-3">
              Enable extracting views from the data source
            </p>
            {getSeparator('')}
          </Field>
          <Field>
            <div className="tw-flex tw-gap-1">
              <label>Include tags</label>
              <ToggleSwitchV1
                checked={includeTags}
                handleCheck={handleIncludeTags}
                testId="include-tags"
              />
            </div>
            <p className="tw-text-grey-muted tw-mt-3">
              Enable extracting tags from the data source
            </p>
            {getSeparator('')}
          </Field>
          {getDebugLogToggle()}
          {!isNil(markDeletedTables) && (
            <Field>
              <div className="tw-flex tw-gap-1">
                <label>Mark Deleted Tables</label>
                <ToggleSwitchV1
                  checked={markDeletedTables}
                  handleCheck={() => {
                    if (handleMarkDeletedTables) {
                      handleMarkDeletedTables();
                    }
                  }}
                  testId="mark-deleted"
                />
              </div>
              <p className="tw-text-grey-muted tw-mt-3">
                Any deleted tables in the data source will be soft deleted in
                OpenMetadata
              </p>
              {getSeparator('')}
            </Field>
          )}
          {!isNil(markAllDeletedTables) && (
            <Field>
              <div className="tw-flex tw-gap-1">
                <label>Mark All Deleted Tables</label>
                <ToggleSwitchV1
                  checked={markAllDeletedTables}
                  handleCheck={() => {
                    if (handleMarkAllDeletedTables) {
                      handleMarkAllDeletedTables();
                    }
                  }}
                  testId="mark-deleted-filter-only"
                />
              </div>
              <p className="tw-text-grey-muted tw-mt-3">
                Optional configuration to mark deleted tables only to the
                filtered schema
              </p>
              {getSeparator('')}
            </Field>
          )}
        </div>
      </>
    );
  };

  const getPipelineFieldToggles = () => {
    return (
      <div>
        <Field>
          <div className="tw-flex tw-gap-1">
            <label>Include lineage</label>
            <ToggleSwitchV1
              checked={includeLineage}
              handleCheck={handleIncludeLineage}
              testId="include-lineage"
            />
          </div>
          <p className="tw-text-grey-muted tw-mt-3">
            Configuration to turn off fetching lineage from pipelines.
          </p>
          {getSeparator('')}
        </Field>
        {getDebugLogToggle()}
      </div>
    );
  };
  const getFqnForFilteringToggles = () => {
    return (
      <Field>
        <div className="tw-flex tw-gap-1">
          <label>Use FQN For Filtering</label>
          <ToggleSwitchV1
            checked={useFqnFilter}
            handleCheck={onUseFqnFilterClick}
            testId="include-lineage"
          />
        </div>
        <p className="tw-text-grey-muted tw-mt-3">
          Regex will be applied on fully qualified name (e.g
          service_name.db_name.schema_name.table_name) instead of raw name (e.g.
          table_name).
        </p>
        {getSeparator('')}
      </Field>
    );
  };

  const handleDashBoardServiceNames = (inputValue: string) => {
    const separator = ',';

    const databaseNames = inputValue.includes(separator)
      ? inputValue.split(separator)
      : Array(inputValue);

    if (databaseNames) handleDatasetServiceName(databaseNames);
  };

  const getDashboardDBServiceName = () => {
    return (
      <Field>
        <label className="tw-block tw-form-label tw-mb-1" htmlFor="name">
          Database Service Name
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-sm">
          Database Service Name for creation of lineage
        </p>
        <input
          className="tw-form-inputs tw-form-inputs-padding"
          data-testid="name"
          id="name"
          name="name"
          type="text"
          value={databaseServiceNames}
          onChange={(e) => handleDashBoardServiceNames(e.target.value)}
        />
        {getSeparator('')}
      </Field>
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
            handleShowFilter(value, FilterPatternEnum.DATABASE)
          }
          includePattern={databaseFilterPattern?.includes ?? []}
          type={FilterPatternEnum.DATABASE}
        />
        <FilterPattern
          checked={showSchemaFilter}
          excludePattern={schemaFilterPattern?.excludes ?? []}
          getExcludeValue={getExcludeValue}
          getIncludeValue={getIncludeValue}
          handleChecked={(value) =>
            handleShowFilter(value, FilterPatternEnum.SCHEMA)
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
            handleShowFilter(value, FilterPatternEnum.TABLE)
          }
          includePattern={tableFilterPattern?.includes ?? []}
          showSeparator={false}
          type={FilterPatternEnum.TABLE}
        />
      </div>
    );
  };

  const getMetadataFilterPatternField = () => {
    switch (serviceCategory) {
      case ServiceCategory.DATABASE_SERVICES:
        return (
          <Fragment>
            {getFilterPatterns()}
            {getSeparator('')}
            {getFqnForFilteringToggles()}
            {getDatabaseFieldToggles()}
          </Fragment>
        );
      case ServiceCategory.DASHBOARD_SERVICES:
        return (
          <Fragment>
            <FilterPattern
              checked={showDashboardFilter}
              excludePattern={dashboardFilterPattern.excludes ?? []}
              getExcludeValue={getExcludeValue}
              getIncludeValue={getIncludeValue}
              handleChecked={(value) =>
                handleShowFilter(value, FilterPatternEnum.DASHBOARD)
              }
              includePattern={dashboardFilterPattern.includes ?? []}
              type={FilterPatternEnum.DASHBOARD}
            />
            <FilterPattern
              checked={showChartFilter}
              excludePattern={chartFilterPattern.excludes ?? []}
              getExcludeValue={getExcludeValue}
              getIncludeValue={getIncludeValue}
              handleChecked={(value) =>
                handleShowFilter(value, FilterPatternEnum.CHART)
              }
              includePattern={chartFilterPattern.includes ?? []}
              showSeparator={false}
              type={FilterPatternEnum.CHART}
            />
            {getSeparator('')}
            {getDashboardDBServiceName()}
            {getDebugLogToggle()}
          </Fragment>
        );

      case ServiceCategory.MESSAGING_SERVICES:
        return (
          <Fragment>
            <FilterPattern
              checked={showTopicFilter}
              excludePattern={topicFilterPattern.excludes ?? []}
              getExcludeValue={getExcludeValue}
              getIncludeValue={getIncludeValue}
              handleChecked={(value) =>
                handleShowFilter(value, FilterPatternEnum.TOPIC)
              }
              includePattern={topicFilterPattern.includes ?? []}
              showSeparator={false}
              type={FilterPatternEnum.TOPIC}
            />
            {getSeparator('')}
            {getIngestSampleToggle(
              'Ingest Sample Data',
              'Extract sample data from each topic'
            )}
            {getDebugLogToggle()}
          </Fragment>
        );
      case ServiceCategory.PIPELINE_SERVICES:
        return (
          <Fragment>
            <FilterPattern
              checked={showPipelineFilter}
              excludePattern={pipelineFilterPattern.excludes ?? []}
              getExcludeValue={getExcludeValue}
              getIncludeValue={getIncludeValue}
              handleChecked={(value) =>
                handleShowFilter(value, FilterPatternEnum.PIPELINE)
              }
              includePattern={pipelineFilterPattern.includes ?? []}
              showSeparator={false}
              type={FilterPatternEnum.PIPELINE}
            />
            {getSeparator('')}
            {getPipelineFieldToggles()}
          </Fragment>
        );

      case ServiceCategory.ML_MODEL_SERVICES:
        return (
          <Fragment>
            <FilterPattern
              checked={showMlModelFilter}
              excludePattern={mlModelFilterPattern.excludes ?? []}
              getExcludeValue={getExcludeValue}
              getIncludeValue={getIncludeValue}
              handleChecked={(value) =>
                handleShowFilter(value, FilterPatternEnum.MLMODEL)
              }
              includePattern={mlModelFilterPattern.includes ?? []}
              showSeparator={false}
              type={FilterPatternEnum.MLMODEL}
            />
            {getSeparator('')}
          </Fragment>
        );
      default:
        return <></>;
    }
  };

  const getMetadataFields = () => {
    return (
      <>
        <Field>
          <label className="tw-block tw-form-label tw-mb-1" htmlFor="name">
            Name
          </label>
          <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-sm">
            Name that identifies this pipeline instance uniquely.
          </p>
          <input
            className="tw-form-inputs tw-form-inputs-padding"
            data-testid="name"
            disabled={formType === FormSubmitType.EDIT}
            id="name"
            name="name"
            type="text"
            value={ingestionName}
            onChange={(e) => handleIngestionName(e.target.value)}
          />
          {getSeparator('')}
        </Field>
        <div>{getMetadataFilterPatternField()}</div>
      </>
    );
  };

  const getUsageFields = () => {
    return (
      <>
        <Field>
          <label
            className="tw-block tw-form-label tw-mb-1"
            htmlFor="query-log-duration">
            Query Log Duration
          </label>
          <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-sm">
            Configuration to tune how far we want to look back in query logs to
            process usage data.
          </p>
          <input
            className="tw-form-inputs tw-form-inputs-padding"
            data-testid="query-log-duration"
            id="query-log-duration"
            name="query-log-duration"
            type="number"
            value={queryLogDuration}
            onChange={(e) => handleQueryLogDuration(parseInt(e.target.value))}
          />
          {getSeparator('')}
        </Field>
        <Field>
          <label
            className="tw-block tw-form-label tw-mb-1"
            htmlFor="stage-file-location">
            Stage File Location
          </label>
          <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-sm">
            Temporary file name to store the query logs before processing.
            Absolute file path required.
          </p>
          <input
            className="tw-form-inputs tw-form-inputs-padding"
            data-testid="stage-file-location"
            id="stage-file-location"
            name="stage-file-location"
            type="text"
            value={stageFileLocation}
            onChange={(e) => handleStageFileLocation(e.target.value)}
          />
          {getSeparator('')}
        </Field>
        <Field>
          <label
            className="tw-block tw-form-label tw-mb-1"
            htmlFor="result-limit">
            Result Limit
          </label>
          <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-sm">
            Configuration to set the limit for query logs.
          </p>
          <input
            className="tw-form-inputs tw-form-inputs-padding"
            data-testid="result-limit"
            id="result-limit"
            name="result-limit"
            type="number"
            value={resultLimit}
            onChange={(e) => handleResultLimit(parseInt(e.target.value))}
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
            Query Log Duration
          </label>
          <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-sm">
            Configuration to tune how far we want to look back in query logs to
            process usage data.
          </p>
          <input
            className="tw-form-inputs tw-form-inputs-padding"
            data-testid="query-log-duration"
            id="query-log-duration"
            name="query-log-duration"
            type="number"
            value={queryLogDuration}
            onChange={(e) => handleQueryLogDuration(parseInt(e.target.value))}
          />
          {getSeparator('')}
        </Field>
        <Field>
          <label
            className="tw-block tw-form-label tw-mb-1"
            htmlFor="result-limit">
            Result Limit
          </label>
          <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-sm">
            Configuration to set the limit for query logs.
          </p>
          <input
            className="tw-form-inputs tw-form-inputs-padding"
            data-testid="result-limit"
            id="result-limit"
            name="result-limit"
            type="number"
            value={resultLimit}
            onChange={(e) => handleResultLimit(parseInt(e.target.value))}
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
              Name
            </label>
            <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-sm">
              Name that identifies this pipeline instance uniquely.
            </p>
            <input
              className="tw-form-inputs tw-form-inputs-padding"
              data-testid="name"
              id="name"
              name="name"
              type="text"
              value={ingestionName}
              onChange={(e) => handleIngestionName(e.target.value)}
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
          'Ingest Sample Data',
          'Extract sample data from each profile'
        )}
        {getDebugLogToggle()}
        <div>
          <Field>
            <label className="tw-block tw-form-label tw-mb-1" htmlFor="name">
              Description
            </label>
            <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-sm">
              Description of the pipeline.
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
    handleDescription &&
      handleDescription(markdownRef.current?.getEditorContent() || '');
    onNext();
  };

  return (
    <Form
      className="p-x-xs"
      data-testid="configure-ingestion-container"
      layout="vertical">
      {getIngestionPipelineFields()}

      <Field className="tw-flex tw-justify-end">
        <Button
          className="tw-mr-2"
          data-testid="back-button"
          size="regular"
          theme="primary"
          variant="text"
          onClick={onCancel}>
          <span>Cancel</span>
        </Button>

        <Button
          data-testid="next-button"
          size="regular"
          theme="primary"
          variant="contained"
          onClick={handleNext}>
          <span>Next</span>
        </Button>
      </Field>
    </Form>
  );
};

export default ConfigureIngestion;
