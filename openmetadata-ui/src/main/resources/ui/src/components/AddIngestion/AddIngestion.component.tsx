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
import { FilterPatternEnum } from '../../enums/filterPattern.enum';
import {
  CreateIngestionPipeline,
  PipelineType,
} from '../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { getCurrentDate, getCurrentUserId } from '../../utils/CommonUtils';
import SuccessScreen from '../common/success-screen/SuccessScreen';
import IngestionStepper from '../IngestionStepper/IngestionStepper.component';
import { AddIngestionProps, PatternType } from './addIngestion.interface';
import ConfigureIngestion from './Steps/ConfigureIngestion';
import ScheduleInterval from './Steps/ScheduleInterval';

const AddIngestion = ({
  serviceData,
  serviceCategory,
  onAddIngestionSave,
  handleAddIngestion,
  handleViewServiceClick,
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

  const [showDashboardFilter, setShowDashboardFilter] = useState(false);
  const [showSchemaFilter, setShowSchemaFilter] = useState(false);
  const [showTableFilter, setShowTableFilter] = useState(false);
  const [showTopicFilter, setShowTopicFilter] = useState(false);
  const [showChartFilter, setShowChartFilter] = useState(false);
  const [includeView, setIncludeView] = useState(false);
  const [enableDataProfiler, setEnableDataProfiler] = useState(true);
  const [ingestSampleData, setIngestSampleData] = useState(true);
  const [dashboardFilterPattern, setDashboardFilterPattern] =
    useState<PatternType>(INITIAL_FILTER_PATTERN);
  const [schemaFilterPattern, setSchemaFilterPattern] = useState<PatternType>(
    INITIAL_FILTER_PATTERN
  );
  const [tableFilterPattern, setTableFilterPattern] = useState<PatternType>(
    INITIAL_FILTER_PATTERN
  );
  const [topicFilterPattern, setTopicFilterPattern] = useState<PatternType>(
    INITIAL_FILTER_PATTERN
  );
  const [chartFilterPattern, setChartFilterPattern] = useState<PatternType>(
    INITIAL_FILTER_PATTERN
  );

  const getIncludeValue = (value: Array<string>, type: FilterPatternEnum) => {
    switch (type) {
      case FilterPatternEnum.DASHBOARD:
        setDashboardFilterPattern({
          ...dashboardFilterPattern,
          include: value,
        });

        break;
      case FilterPatternEnum.SCHEMA:
        setSchemaFilterPattern({ ...schemaFilterPattern, include: value });

        break;
      case FilterPatternEnum.TABLE:
        setTableFilterPattern({ ...tableFilterPattern, include: value });

        break;
      case FilterPatternEnum.TOPIC:
        setTopicFilterPattern({ ...topicFilterPattern, include: value });

        break;
      case FilterPatternEnum.CHART:
        setChartFilterPattern({ ...topicFilterPattern, include: value });

        break;
    }
  };
  const getExcludeValue = (value: Array<string>, type: FilterPatternEnum) => {
    switch (type) {
      case FilterPatternEnum.DASHBOARD:
        setDashboardFilterPattern({
          ...dashboardFilterPattern,
          exclude: value,
        });

        break;
      case FilterPatternEnum.SCHEMA:
        setSchemaFilterPattern({ ...schemaFilterPattern, exclude: value });

        break;
      case FilterPatternEnum.TABLE:
        setTableFilterPattern({ ...tableFilterPattern, exclude: value });

        break;
      case FilterPatternEnum.TOPIC:
        setTopicFilterPattern({ ...topicFilterPattern, exclude: value });

        break;
      case FilterPatternEnum.CHART:
        setChartFilterPattern({ ...topicFilterPattern, exclude: value });

        break;
    }
  };

  const handleShowFilter = (value: boolean, type: FilterPatternEnum) => {
    switch (type) {
      case FilterPatternEnum.DASHBOARD:
        setShowDashboardFilter(value);

        break;
      case FilterPatternEnum.SCHEMA:
        setShowSchemaFilter(value);

        break;
      case FilterPatternEnum.TABLE:
        setShowTableFilter(value);

        break;
      case FilterPatternEnum.TOPIC:
        setShowTopicFilter(value);

        break;
      case FilterPatternEnum.CHART:
        setShowChartFilter(value);

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

  const getFilterPatternData = (data: PatternType) => {
    const { include, exclude } = data;

    return include.length === 0 && exclude.length === 0
      ? undefined
      : {
          includes: include.length > 0 ? include : undefined,
          excludes: exclude.length > 0 ? exclude : undefined,
        };
  };

  const handleScheduleIntervalDeployClick = () => {
    const ingestionDetails: CreateIngestionPipeline = {
      airflowConfig: {
        startDate: startDate as unknown as Date,
        endDate: startDate as unknown as Date,
        scheduleInterval: repeatFrequency,
        forceDeploy: true,
      },
      name: ingestionName,
      displayName: ingestionName,
      owner: {
        id: getCurrentUserId(),
        type: 'user',
      },
      pipelineType: PipelineType.Metadata,
      service: {
        id: serviceData.id as string,
        type: serviceCategory.slice(0, -1),
      },
      sourceConfig: {
        config: {
          enableDataProfiler: enableDataProfiler,
          generateSampleData: ingestSampleData,
          includeViews: includeView,
          schemaFilterPattern: getFilterPatternData(schemaFilterPattern),
          tableFilterPattern: getFilterPatternData(tableFilterPattern),
          chartFilterPattern: getFilterPatternData(chartFilterPattern),
          dashboardFilterPattern: getFilterPatternData(dashboardFilterPattern),
          topicFilterPattern: getFilterPatternData(topicFilterPattern),
        },
      },
    };

    onAddIngestionSave(ingestionDetails).then(() => {
      setActiveStepperStep(3);
    });
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
            chartFilterPattern={chartFilterPattern}
            dashboardFilterPattern={dashboardFilterPattern}
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
            serviceCategory={serviceCategory}
            showChartFilter={showChartFilter}
            showDashboardFilter={showDashboardFilter}
            showSchemaFilter={showSchemaFilter}
            showTableFilter={showTableFilter}
            showTopicFilter={showTopicFilter}
            tableFilterPattern={tableFilterPattern}
            topicFilterPattern={topicFilterPattern}
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
          <SuccessScreen
            handleViewServiceClick={handleViewServiceClick}
            name={ingestionName}
            showIngestionButton={false}
          />
        )}
      </div>
    </div>
  );
};

export default AddIngestion;
