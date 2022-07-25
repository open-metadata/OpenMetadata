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

import { isNil } from 'lodash';
import { EditorContentRef } from 'Models';
import React, { Fragment, useRef, useState } from 'react';
import { FilterPatternEnum } from '../../../enums/filterPattern.enum';
import { ServiceCategory } from '../../../enums/service.enum';
import { PipelineType } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { getSeparator, errorMsg } from '../../../utils/CommonUtils';
import { Button } from '../../buttons/Button/Button';
import FilterPattern from '../../common/FilterPattern/FilterPattern';
import RichTextEditor from '../../common/rich-text-editor/RichTextEditor';
import ToggleSwitchV1 from '../../common/toggle-switch/ToggleSwitchV1';
import { Field } from '../../Field/Field';
import { ConfigureIngestionProps } from '../addIngestion.interface';

const ConfigureIngestion = ({
  ingestionName,
  description = '',
  databaseServiceName,
  databaseFilterPattern,
  dashboardFilterPattern,
  schemaFilterPattern,
  tableFilterPattern,
  topicFilterPattern,
  chartFilterPattern,
  pipelineFilterPattern,
  fqnFilterPattern,
  includeLineage,
  includeView,
  includeTags,
  markDeletedTables,
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
  showFqnFilter,
  queryLogDuration,
  stageFileLocation,
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
  handleIngestSampleData,
  handleDatasetServiceName,
  handleQueryLogDuration,
  handleProfileSample,
  handleStageFileLocation,
  handleResultLimit,
  onCancel,
  onNext,
}: ConfigureIngestionProps) => {
  const markdownRef = useRef<EditorContentRef>();

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

  const [profileSampleError, setProfileSampleError] = useState(false);

  const handleProfileSampleValidation = (profileSampleValue: number) => {
    let errMsg;
    if (profileSampleValue < 0 || profileSampleValue > 99) {
      errMsg = true;
    } else {
      errMsg = false;
    }
    setProfileSampleError(errMsg);
    handleProfileSample(profileSampleValue);
  };

  const getProfileSample = () => {
    return (
      <div>
        <label>Profile Sample</label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-sm">
          This is an optional percentage used to compute the table profile. Should be
          between 0 and 99.
        </p>
        <input
          className="tw-form-inputs tw-form-inputs-padding tw-w-24"
          data-testid="profileSample"
          id="profileSample"
          name="profileSample"
          placeholder="75"
          type="number"
          value={profileSample}
          onChange={(e) =>
            handleProfileSampleValidation(parseInt(e.target.value))
          }
        />
        {profileSampleError && errorMsg('Value must be between 0 and 99.')}
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
          value={databaseServiceName}
          onChange={(e) => handleDatasetServiceName(e.target.value)}
        />
        {getSeparator('')}
      </Field>
    );
  };

  const getMetadataFilterPatternField = () => {
    switch (serviceCategory) {
      case ServiceCategory.DATABASE_SERVICES:
        return (
          <Fragment>
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
            {getSeparator('')}
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
      default:
        return <></>;
    }
  };

  const getProfilerFilterPatternField = () => {
    return (
      <Fragment>
        <FilterPattern
          checked={showFqnFilter}
          excludePattern={fqnFilterPattern?.excludes ?? []}
          getExcludeValue={getExcludeValue}
          getIncludeValue={getIncludeValue}
          handleChecked={(value) =>
            handleShowFilter(value, FilterPatternEnum.FQN)
          }
          includePattern={fqnFilterPattern?.includes ?? []}
          type={FilterPatternEnum.FQN}
        />
      </Fragment>
    );
  };

  const getMetadataFields = () => {
    return (
      <>
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
        <div>{getProfilerFilterPatternField()}</div>
        {getSeparator('')}
        {getProfileSample()}
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
    <div className="tw-px-2" data-testid="configure-ingestion-container">
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
    </div>
  );
};

export default ConfigureIngestion;
