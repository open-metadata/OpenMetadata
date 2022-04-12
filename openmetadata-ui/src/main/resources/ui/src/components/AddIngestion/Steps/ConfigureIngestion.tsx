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

import React from 'react';
import { FilterPatternType } from '../../../enums/filterPattern.enum';
import { getSeparator } from '../../../utils/CommonUtils';
import { Button } from '../../buttons/Button/Button';
import FilterPattern from '../../common/FilterPattern/FilterPattern';
import ToggleSwitchV1 from '../../common/toggle-switch/ToggleSwitchV1';
import { Field } from '../../Field/Field';
import { ConfigureIngestionProps } from '../addIngestion.interface';

const ConfigureIngestion = ({
  databaseFilterPattern,
  schemaFilterPattern,
  tableFilterPattern,
  viewFilterPattern,
  includeView,
  enableDataProfiler,
  ingestSampleData,
  showDatabaseFilter,
  showSchemaFilter,
  showTableFilter,
  showViewFilter,
  getExcludeValue,
  getIncludeValue,
  handleShowFilter,
  handleEnableDataProfiler,
  handleIncludeView,
  handleIngestSampleData,
  onCancel,
  onNext,
}: ConfigureIngestionProps) => {
  return (
    <div className="tw-px-2" data-testid="configure-ingestion-container">
      <div>
        <FilterPattern
          checked={showDatabaseFilter}
          excludePattern={databaseFilterPattern.exclude}
          getExcludeValue={getExcludeValue}
          getIncludeValue={getIncludeValue}
          handleChecked={(value) =>
            handleShowFilter(value, FilterPatternType.DATABASE)
          }
          includePattern={databaseFilterPattern.include}
          type={FilterPatternType.DATABASE}
        />
        <FilterPattern
          checked={showSchemaFilter}
          excludePattern={schemaFilterPattern.exclude}
          getExcludeValue={getExcludeValue}
          getIncludeValue={getIncludeValue}
          handleChecked={(value) =>
            handleShowFilter(value, FilterPatternType.SCHEMA)
          }
          includePattern={schemaFilterPattern.include}
          type={FilterPatternType.SCHEMA}
        />
        <FilterPattern
          checked={showTableFilter}
          excludePattern={tableFilterPattern.exclude}
          getExcludeValue={getExcludeValue}
          getIncludeValue={getIncludeValue}
          handleChecked={(value) =>
            handleShowFilter(value, FilterPatternType.TABLE)
          }
          includePattern={tableFilterPattern.include}
          type={FilterPatternType.TABLE}
        />
        <FilterPattern
          checked={showViewFilter}
          excludePattern={viewFilterPattern.exclude}
          getExcludeValue={getExcludeValue}
          getIncludeValue={getIncludeValue}
          handleChecked={(value) =>
            handleShowFilter(value, FilterPatternType.VIEW)
          }
          includePattern={viewFilterPattern.include}
          showSeparator={false}
          type={FilterPatternType.VIEW}
        />
      </div>
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
