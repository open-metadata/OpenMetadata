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

import React, { useState } from 'react';
import {
  INGESTION_SCHEDULER_INITIAL_VALUE,
  INITIAL_FILTER_PATTERN,
  STEPS_FOR_ADD_INGESTION,
} from '../../constants/ingestion.constant';
import { FilterPatternType } from '../../enums/filterPattern.enum';
import { PipelineType } from '../../generated/api/operations/pipelines/createAirflowPipeline';
import { getCurrentDate } from '../../utils/CommonUtils';
import SuccessScreen from '../common/success-screen/SuccessScreen';
import IngestionStepper from '../IngestionStepper/IngestionStepper.component';
import { AddIngestionProps, PatternType } from './addIngestion.interface';
import ConfigureIngestion from './Steps/ConfigureIngestion';
import ScheduleInterval from './Steps/ScheduleInterval';

const AddIngestion = ({
  serviceData,
  handleAddIngestion,
}: AddIngestionProps) => {
  const [activeStepperStep, setActiveStepperStep] = useState(1);
  const [ingestionName] = useState(
    `${serviceData.name}_${PipelineType.Metadata}`
  );
  const [repeatFrequency, setRepeatFrequency] = useState(
    INGESTION_SCHEDULER_INITIAL_VALUE
  );
  const [startDate, setStartDate] = useState(getCurrentDate());
  const [endDate, setEndDate] = useState('');

  const [showDatabaseFilter, setShowDatabaseFilter] = useState(false);
  const [showSchemaFilter, setShowSchemaFilter] = useState(false);
  const [showTableFilter, setShowTableFilter] = useState(false);
  const [showViewFilter, setShowViewFilter] = useState(false);
  const [includeView, setIncludeView] = useState(false);
  const [enableDataProfiler, setEnableDataProfiler] = useState(true);
  const [ingestSampleData, setIngestSampleData] = useState(true);
  const [databaseFilterPattern, setDatabaseFilterPattern] =
    useState<PatternType>(INITIAL_FILTER_PATTERN);
  const [schemaFilterPattern, setSchemaFilterPattern] = useState<PatternType>(
    INITIAL_FILTER_PATTERN
  );
  const [tableFilterPattern, setTableFilterPattern] = useState<PatternType>(
    INITIAL_FILTER_PATTERN
  );
  const [viewFilterPattern, setViewFilterPattern] = useState<PatternType>(
    INITIAL_FILTER_PATTERN
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

  const handleShowFilter = (value: boolean, type: FilterPatternType) => {
    switch (type) {
      case FilterPatternType.DATABASE:
        setShowDatabaseFilter(value);

        break;
      case FilterPatternType.SCHEMA:
        setShowSchemaFilter(value);

        break;
      case FilterPatternType.TABLE:
        setShowTableFilter(value);

        break;
      case FilterPatternType.VIEW:
        setShowViewFilter(value);

        break;
    }
  };

  const handleConfigureIngestionCancelClick = () => {
    handleAddIngestion(false);
  };

  const handleConfigureIngestionNextClick = () => {
    setActiveStepperStep(2);
  };

  const handleScheduleIntervalBackClick = () => {
    setActiveStepperStep(1);
  };

  const handleScheduleIntervalDeployClick = () => {
    setActiveStepperStep(3);
  };

  return (
    <div data-testid="add-ingestion-container">
      <h6 className="tw-heading tw-text-base">Add New Ingestion</h6>

      <IngestionStepper
        activeStep={activeStepperStep}
        className="tw-justify-between tw-w-10/12 tw-mx-auto"
        stepperLineClassName="add-ingestion-line"
        steps={STEPS_FOR_ADD_INGESTION}
      />

      <div className="tw-pt-7">
        {activeStepperStep === 1 && (
          <ConfigureIngestion
            databaseFilterPattern={databaseFilterPattern}
            enableDataProfiler={enableDataProfiler}
            getExcludeValue={getExcludeValue}
            getIncludeValue={getIncludeValue}
            handleEnableDataProfiler={() =>
              setEnableDataProfiler((pre) => !pre)
            }
            handleIncludeView={() => setIncludeView((pre) => !pre)}
            handleIngestSampleData={() => setIngestSampleData((pre) => !pre)}
            handleShowFilter={handleShowFilter}
            includeView={includeView}
            ingestSampleData={ingestSampleData}
            ingestionName={ingestionName}
            schemaFilterPattern={schemaFilterPattern}
            showDatabaseFilter={showDatabaseFilter}
            showSchemaFilter={showSchemaFilter}
            showTableFilter={showTableFilter}
            showViewFilter={showViewFilter}
            tableFilterPattern={tableFilterPattern}
            viewFilterPattern={viewFilterPattern}
            onCancel={handleConfigureIngestionCancelClick}
            onNext={handleConfigureIngestionNextClick}
          />
        )}

        {activeStepperStep === 2 && (
          <ScheduleInterval
            endDate={endDate}
            handleEndDateChange={(value: string) => setEndDate(value)}
            handleRepeatFrequencyChange={(value: string) =>
              setRepeatFrequency(value)
            }
            handleStartDateChange={(value: string) => setStartDate(value)}
            repeatFrequency={repeatFrequency}
            startDate={startDate}
            onBack={handleScheduleIntervalBackClick}
            onDeloy={handleScheduleIntervalDeployClick}
          />
        )}

        {activeStepperStep > 2 && (
          <SuccessScreen name={ingestionName} showIngestionButton={false} />
        )}
      </div>
    </div>
  );
};

export default AddIngestion;
