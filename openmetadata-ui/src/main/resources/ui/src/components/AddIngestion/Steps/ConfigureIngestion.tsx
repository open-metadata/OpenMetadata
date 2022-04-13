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

import React, { Fragment } from 'react';
import { FilterPatternEnum } from '../../../enums/filterPattern.enum';
import { ServiceCategory } from '../../../enums/service.enum';
import { getSeparator } from '../../../utils/CommonUtils';
import { Button } from '../../buttons/Button/Button';
import FilterPattern from '../../common/FilterPattern/FilterPattern';
import ToggleSwitchV1 from '../../common/toggle-switch/ToggleSwitchV1';
import { Field } from '../../Field/Field';
import { ConfigureIngestionProps } from '../addIngestion.interface';

const ConfigureIngestion = ({
  dashboardFilterPattern,
  schemaFilterPattern,
  tableFilterPattern,
  topicFilterPattern,
  chartFilterPattern,
  includeView,
  serviceCategory,
  enableDataProfiler,
  ingestSampleData,
  showDashboardFilter,
  showSchemaFilter,
  showTableFilter,
  showTopicFilter,
  showChartFilter,
  getExcludeValue,
  getIncludeValue,
  handleShowFilter,
  handleEnableDataProfiler,
  handleIncludeView,
  handleIngestSampleData,
  onCancel,
  onNext,
}: ConfigureIngestionProps) => {
  const getFilterPatternField = () => {
    switch (serviceCategory) {
      case ServiceCategory.DATABASE_SERVICES:
        return (
          <Fragment>
            <FilterPattern
              checked={showSchemaFilter}
              excludePattern={schemaFilterPattern.exclude}
              getExcludeValue={getExcludeValue}
              getIncludeValue={getIncludeValue}
              handleChecked={(value) =>
                handleShowFilter(value, FilterPatternEnum.SCHEMA)
              }
              includePattern={schemaFilterPattern.include}
              type={FilterPatternEnum.SCHEMA}
            />
            <FilterPattern
              checked={showTableFilter}
              excludePattern={tableFilterPattern.exclude}
              getExcludeValue={getExcludeValue}
              getIncludeValue={getIncludeValue}
              handleChecked={(value) =>
                handleShowFilter(value, FilterPatternEnum.TABLE)
              }
              includePattern={tableFilterPattern.include}
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
              excludePattern={dashboardFilterPattern.exclude}
              getExcludeValue={getExcludeValue}
              getIncludeValue={getIncludeValue}
              handleChecked={(value) =>
                handleShowFilter(value, FilterPatternEnum.DASHBOARD)
              }
              includePattern={dashboardFilterPattern.include}
              type={FilterPatternEnum.DASHBOARD}
            />
            <FilterPattern
              checked={showChartFilter}
              excludePattern={chartFilterPattern.exclude}
              getExcludeValue={getExcludeValue}
              getIncludeValue={getIncludeValue}
              handleChecked={(value) =>
                handleShowFilter(value, FilterPatternEnum.CHART)
              }
              includePattern={chartFilterPattern.include}
              showSeparator={false}
              type={FilterPatternEnum.CHART}
            />
          </Fragment>
        );

      case ServiceCategory.MESSAGING_SERVICES:
        return (
          <FilterPattern
            checked={showTopicFilter}
            excludePattern={topicFilterPattern.exclude}
            getExcludeValue={getExcludeValue}
            getIncludeValue={getIncludeValue}
            handleChecked={(value) =>
              handleShowFilter(value, FilterPatternEnum.TOPIC)
            }
            includePattern={topicFilterPattern.include}
            showSeparator={false}
            type={FilterPatternEnum.TOPIC}
          />
        );
      default:
        return <></>;
    }
  };

  return (
    <div className="tw-px-2" data-testid="configure-ingestion-container">
      <div>{getFilterPatternField()}</div>
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
      </div>

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
          onClick={onNext}>
          <span>Next</span>
        </Button>
      </Field>
    </div>
  );
};

export default ConfigureIngestion;
