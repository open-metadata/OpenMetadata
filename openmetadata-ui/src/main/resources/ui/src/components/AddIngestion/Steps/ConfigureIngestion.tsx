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

import { isUndefined } from 'lodash';
import React, { useState } from 'react';
import { FilterPatternType } from '../../../enums/filterPattern.enum';
import { getSeparator } from '../../../utils/CommonUtils';
import { Button } from '../../buttons/Button/Button';
import FilterPattern from '../../common/FilterPattern/FilterPattern';
import ToggleSwitchV1 from '../../common/toggle-switch/ToggleSwitchV1';
import { Field } from '../../Field/Field';
import { ConfigureIngestionStep, PatternType } from '../addIngestion.interface';

type ConfigureIngestionProps = {
  initialData?: ConfigureIngestionStep;
  ingestionName: string;
  onCancel: () => void;
  onNext: (data: ConfigureIngestionStep) => void;
};

const isFilterPatternPresent = (data?: PatternType) => {
  return (
    !isUndefined(data) && (data.exclude.length > 0 || data.include.length > 0)
  );
};

const INITIAL_FILTER_PATTERN: PatternType = {
  include: [],
  exclude: [],
};

const ConfigureIngestion = ({
  initialData,
  ingestionName,
  onCancel,
  onNext,
}: ConfigureIngestionProps) => {
  const [showDatabaseFilter, setShowDatabaseFilter] = useState(
    isFilterPatternPresent(initialData?.databaseFilterPattern)
  );
  const [showSchemaFilter, setShowSchemaFilter] = useState(
    isFilterPatternPresent(initialData?.schemaFilterPattern)
  );
  const [showTableFilter, setShowTableFilter] = useState(
    isFilterPatternPresent(initialData?.tableFilterPattern)
  );
  const [showViewFilter, setShowViewFilter] = useState(
    isFilterPatternPresent(initialData?.viewFilterPattern)
  );
  const [includeView, setIncludeView] = useState(
    initialData?.includeView ?? false
  );
  const [enableDataProfiler, setEnableDataProfiler] = useState(
    initialData?.enableDataProfiler ?? true
  );
  const [ingestSampleData, setIngestSampleData] = useState(
    initialData?.ingestSampleData ?? true
  );
  const [databaseFilterPattern, setDatabaseFilterPattern] =
    useState<PatternType>(
      initialData?.databaseFilterPattern ?? INITIAL_FILTER_PATTERN
    );
  const [schemaFilterPattern, setSchemaFilterPattern] = useState<PatternType>(
    initialData?.schemaFilterPattern ?? INITIAL_FILTER_PATTERN
  );
  const [tableFilterPattern, setTableFilterPattern] = useState<PatternType>(
    initialData?.tableFilterPattern ?? INITIAL_FILTER_PATTERN
  );
  const [viewFilterPattern, setViewFilterPattern] = useState<PatternType>(
    initialData?.viewFilterPattern ?? INITIAL_FILTER_PATTERN
  );

  const getIncludeValue = (value: Array<string>, type: FilterPatternType) => {
    switch (type) {
      case FilterPatternType.DATABASE:
        setDatabaseFilterPattern({ ...databaseFilterPattern, include: value });

        break;
      case FilterPatternType.SCHEMA:
        setSchemaFilterPattern({ ...schemaFilterPattern, include: value });

        break;
      case FilterPatternType.TABLE:
        setTableFilterPattern({ ...tableFilterPattern, include: value });

        break;
      case FilterPatternType.VIEW:
        setViewFilterPattern({ ...viewFilterPattern, include: value });

        break;
    }
  };
  const getExcludeValue = (value: Array<string>, type: FilterPatternType) => {
    switch (type) {
      case FilterPatternType.DATABASE:
        setDatabaseFilterPattern({ ...databaseFilterPattern, exclude: value });

        break;
      case FilterPatternType.SCHEMA:
        setSchemaFilterPattern({ ...schemaFilterPattern, exclude: value });

        break;
      case FilterPatternType.TABLE:
        setTableFilterPattern({ ...tableFilterPattern, exclude: value });

        break;
      case FilterPatternType.VIEW:
        setViewFilterPattern({ ...viewFilterPattern, exclude: value });

        break;
    }
  };

  const handleNextClick = () => {
    onNext({
      databaseFilterPattern,
      schemaFilterPattern,
      tableFilterPattern,
      viewFilterPattern,
      includeView,
      enableDataProfiler,
      ingestSampleData,
    });
  };

  return (
    <div className="tw-px-2">
      <Field>
        <p>
          Ingestion Name{' '}
          <span className="tw-font-semibold">{ingestionName}</span>
        </p>
      </Field>
      <div className="tw-pt-2">
        <FilterPattern
          checked={showDatabaseFilter}
          excludePattern={databaseFilterPattern.exclude}
          getExcludeValue={getExcludeValue}
          getIncludeValue={getIncludeValue}
          handleChecked={(value) => setShowDatabaseFilter(value)}
          includePattern={databaseFilterPattern.include}
          type={FilterPatternType.DATABASE}
        />
        <FilterPattern
          checked={showSchemaFilter}
          excludePattern={schemaFilterPattern.exclude}
          getExcludeValue={getExcludeValue}
          getIncludeValue={getIncludeValue}
          handleChecked={(value) => setShowSchemaFilter(value)}
          includePattern={schemaFilterPattern.include}
          type={FilterPatternType.SCHEMA}
        />
        <FilterPattern
          checked={showTableFilter}
          excludePattern={tableFilterPattern.exclude}
          getExcludeValue={getExcludeValue}
          getIncludeValue={getIncludeValue}
          handleChecked={(value) => setShowTableFilter(value)}
          includePattern={tableFilterPattern.include}
          type={FilterPatternType.TABLE}
        />
        <FilterPattern
          checked={showViewFilter}
          excludePattern={viewFilterPattern.exclude}
          getExcludeValue={getExcludeValue}
          getIncludeValue={getIncludeValue}
          handleChecked={(value) => setShowViewFilter(value)}
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
              handleCheck={() => setIncludeView((pre) => !pre)}
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
              handleCheck={() => setEnableDataProfiler((pre) => !pre)}
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
              handleCheck={() => setIngestSampleData((pre) => !pre)}
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
          onClick={handleNextClick}>
          <span>Next</span>
        </Button>
      </Field>
    </div>
  );
};

export default ConfigureIngestion;
