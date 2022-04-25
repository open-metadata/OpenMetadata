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
import React, { Fragment, useRef } from 'react';
import { FilterPatternEnum } from '../../../enums/filterPattern.enum';
import { ServiceCategory } from '../../../enums/service.enum';
import { PipelineType } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { getSeparator } from '../../../utils/CommonUtils';
import { Button } from '../../buttons/Button/Button';
import FilterPattern from '../../common/FilterPattern/FilterPattern';
import RichTextEditor from '../../common/rich-text-editor/RichTextEditor';
import ToggleSwitchV1 from '../../common/toggle-switch/ToggleSwitchV1';
import { Field } from '../../Field/Field';
import { ConfigureIngestionProps } from '../addIngestion.interface';

const ConfigureIngestion = ({
  ingestionName,
  description = '',
  dashboardFilterPattern,
  schemaFilterPattern,
  tableFilterPattern,
  topicFilterPattern,
  chartFilterPattern,
  fqnFilterPattern,
  includeView,
  markDeletedTables,
  serviceCategory,
  enableDataProfiler,
  ingestSampleData,
  pipelineType,
  showDashboardFilter,
  showSchemaFilter,
  showTableFilter,
  showTopicFilter,
  showChartFilter,
  showFqnFilter,
  queryLogDuration,
  stageFileLocation,
  resultLimit,
  getExcludeValue,
  getIncludeValue,
  handleIngestionName,
  handleDescription,
  handleShowFilter,
  handleEnableDataProfiler,
  handleIncludeView,
  handleMarkDeletedTables,
  handleIngestSampleData,
  handleQueryLogDuration,
  handleStageFileLocation,
  handleResultLimit,
  onCancel,
  onNext,
}: ConfigureIngestionProps) => {
  const markdownRef = useRef<EditorContentRef>();

  const getMetadataFilterPatternField = () => {
    switch (serviceCategory) {
      case ServiceCategory.DATABASE_SERVICES:
        return (
          <Fragment>
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
          </Fragment>
        );

      case ServiceCategory.MESSAGING_SERVICES:
        return (
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
        {getSeparator('')}
        <div>
          <Field>
            <div className="tw-flex tw-gap-1">
              <label>Include views</label>
              <ToggleSwitchV1
                checked={includeView}
                handleCheck={handleIncludeView}
              />
            </div>
            <p className="tw-text-grey-muted tw-mt-3">
              Enable extracting views from the data source
            </p>
            {getSeparator('')}
          </Field>
          <Field>
            <div className="tw-flex tw-gap-1">
              <label>Enable Data Profiler</label>
              <ToggleSwitchV1
                checked={enableDataProfiler}
                handleCheck={handleEnableDataProfiler}
              />
            </div>
            <p className="tw-text-grey-muted tw-mt-3">
              Slowdown metadata extraction by calculate the metrics and
              distribution of data in the table
            </p>
            {getSeparator('')}
          </Field>
          <Field>
            <div className="tw-flex tw-gap-1">
              <label>Ingest Sample Data</label>
              <ToggleSwitchV1
                checked={ingestSampleData}
                handleCheck={handleIngestSampleData}
              />
            </div>
            <p className="tw-text-grey-muted tw-mt-3">
              Extract sample data from each table
            </p>
            {getSeparator('')}
          </Field>
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
                />
              </div>
              <p className="tw-text-grey-muted tw-mt-3">
                Configuration to soft delete tables in OpenMetadata if the
                source tables are deleted.
              </p>
              {getSeparator('')}
            </Field>
          )}
        </div>
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
            className="tw-form-inputs tw-px-3 tw-py-1"
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
            className="tw-form-inputs tw-px-3 tw-py-1"
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
            className="tw-form-inputs tw-px-3 tw-py-1"
            data-testid="result-limit"
            id="result-limit"
            name="result-limit"
            type="number"
            value={resultLimit}
            onChange={(e) => handleResultLimit(parseInt(e.target.value))}
          />
          {getSeparator('')}
        </Field>
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
              className="tw-form-inputs tw-px-3 tw-py-1"
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
