import classNames from 'classnames';
import React, { useState } from 'react';
import { FilterPatternType } from '../../../enums/filterPattern.enum';
import { getSeparator } from '../../../utils/CommonUtils';
import { Button } from '../../buttons/Button/Button';
import FilterPattern from '../../common/FilterPattern/FilterPattern';
import { Field } from '../../Field/Field';

type ConfigureIngestionProps = {
  ingestionName: string;
};

type PatternType = {
  include: Array<string>;
  exclude: Array<string>;
};

const ConfigureIngestion = ({ ingestionName }: ConfigureIngestionProps) => {
  const [showDatabaseFilter, setShowDatabaseFilter] = useState(false);
  const [showSchemaFilter, setShowSchemaFilter] = useState(false);
  const [showTableFilter, setShowTableFilter] = useState(false);
  const [showViewFilter, setShowViewFilter] = useState(false);
  const [includeView, setIncludeView] = useState(false);
  const [enableDataProfiler, setEnableDataProfiler] = useState(true);
  const [ingestSampleData, setIngestSampleData] = useState(true);
  const [databaseFilterPattern, setDatabaseFilterPattern] =
    useState<PatternType>({
      include: [],
      exclude: [],
    });
  const [schemaFilterPattern, setSchemaFilterPattern] = useState<PatternType>({
    include: [],
    exclude: [],
  });
  const [tableFilterPattern, setTableFilterPattern] = useState<PatternType>({
    include: [],
    exclude: [],
  });
  const [viewFilterPattern, setViewFilterPattern] = useState<PatternType>({
    include: [],
    exclude: [],
  });

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
          getExcludeValue={getExcludeValue}
          getIncludeValue={getIncludeValue}
          handleChecked={(value) => setShowDatabaseFilter(value)}
          type={FilterPatternType.DATABASE}
        />
        <FilterPattern
          checked={showSchemaFilter}
          getExcludeValue={getExcludeValue}
          getIncludeValue={getIncludeValue}
          handleChecked={(value) => setShowSchemaFilter(value)}
          type={FilterPatternType.SCHEMA}
        />
        <FilterPattern
          checked={showTableFilter}
          getExcludeValue={getExcludeValue}
          getIncludeValue={getIncludeValue}
          handleChecked={(value) => setShowTableFilter(value)}
          type={FilterPatternType.TABLE}
        />
        <FilterPattern
          checked={showViewFilter}
          getExcludeValue={getExcludeValue}
          getIncludeValue={getIncludeValue}
          handleChecked={(value) => setShowViewFilter(value)}
          showSeparator={false}
          type={FilterPatternType.VIEW}
        />
      </div>
      {getSeparator('')}
      <div>
        <Field>
          <div className="tw-flex tw-gap-1">
            <label>Include views</label>
            <div
              className={classNames(
                'toggle-switch',
                includeView ? 'open' : null
              )}
              data-testid="include-views"
              onClick={() => setIncludeView((pre) => !pre)}>
              <div className="switch" />
            </div>
          </div>
          <p className="tw-text-grey-muted tw-mt-3">
            Enable extracting views from the data source
          </p>
          {getSeparator('')}
        </Field>
        <Field>
          <div className="tw-flex tw-gap-1">
            <label>Enable Data Profiler</label>
            <div
              className={classNames(
                'toggle-switch',
                enableDataProfiler ? 'open' : null
              )}
              data-testid="include-views"
              onClick={() => setEnableDataProfiler((pre) => !pre)}>
              <div className="switch" />
            </div>
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
            <div
              className={classNames(
                'toggle-switch',
                ingestSampleData ? 'open' : null
              )}
              data-testid="include-views"
              onClick={() => setIngestSampleData((pre) => !pre)}>
              <div className="switch" />
            </div>
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
          //   onClick={onBack}
        >
          <span>Back</span>
        </Button>

        <Button
          data-testid="next-button"
          size="regular"
          theme="primary"
          variant="contained"
          //   onClick={() => onNext(markdownRef.current?.getEditorContent() || '')}
        >
          <span>Next</span>
        </Button>
      </Field>
    </div>
  );
};

export default ConfigureIngestion;
