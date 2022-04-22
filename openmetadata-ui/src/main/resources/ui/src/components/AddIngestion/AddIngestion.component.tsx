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

import { isEmpty, isUndefined } from 'lodash';
import React, { useState } from 'react';
import {
  INGESTION_SCHEDULER_INITIAL_VALUE,
  INITIAL_FILTER_PATTERN,
  STEPS_FOR_ADD_INGESTION,
} from '../../constants/ingestion.constant';
import { FilterPatternEnum } from '../../enums/filterPattern.enum';
import { FormSubmitType } from '../../enums/form.enum';
import {
  ConfigClass,
  CreateIngestionPipeline,
  PipelineType,
} from '../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import {
  ConfigType,
  FilterPattern,
  IngestionPipeline,
} from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { getCurrentDate, getCurrentUserId } from '../../utils/CommonUtils';
import SuccessScreen from '../common/success-screen/SuccessScreen';
import IngestionStepper from '../IngestionStepper/IngestionStepper.component';
import { AddIngestionProps } from './addIngestion.interface';
import ConfigureIngestion from './Steps/ConfigureIngestion';
import ScheduleInterval from './Steps/ScheduleInterval';

const AddIngestion = ({
  activeIngestionStep,
  heading,
  status,
  pipelineType,
  data,
  serviceData,
  serviceCategory,
  showSuccessScreen = true,
  setActiveIngestionStep,
  onUpdateIngestion,
  onSuccessSave,
  onAddIngestionSave,
  handleCancelClick,
  handleViewServiceClick,
}: AddIngestionProps) => {
  const [ingestionName] = useState(
    data?.name ?? `${serviceData.name}_${pipelineType}`
  );
  const [repeatFrequency, setRepeatFrequency] = useState(
    data?.airflowConfig.scheduleInterval ?? INGESTION_SCHEDULER_INITIAL_VALUE
  );
  const [startDate, setStartDate] = useState(
    data?.airflowConfig.startDate ?? getCurrentDate()
  );
  const [endDate, setEndDate] = useState(data?.airflowConfig?.endDate ?? '');

  const [showDashboardFilter, setShowDashboardFilter] = useState(
    !isUndefined(
      (data?.source.sourceConfig.config as ConfigClass)?.dashboardFilterPattern
    )
  );
  const [showSchemaFilter, setShowSchemaFilter] = useState(
    !isUndefined(
      (data?.source.sourceConfig.config as ConfigClass)?.schemaFilterPattern
    )
  );
  const [showTableFilter, setShowTableFilter] = useState(
    !isUndefined(
      (data?.source.sourceConfig.config as ConfigClass)?.tableFilterPattern
    )
  );
  const [showTopicFilter, setShowTopicFilter] = useState(
    !isUndefined(
      (data?.source.sourceConfig.config as ConfigClass)?.topicFilterPattern
    )
  );
  const [showChartFilter, setShowChartFilter] = useState(
    !isUndefined(
      (data?.source.sourceConfig.config as ConfigClass)?.chartFilterPattern
    )
  );
  const [includeView, setIncludeView] = useState(
    (data?.source.sourceConfig.config as ConfigClass)?.includeViews ?? false
  );
  const [enableDataProfiler, setEnableDataProfiler] = useState(
    (data?.source.sourceConfig.config as ConfigClass)?.enableDataProfiler ??
      true
  );
  const [ingestSampleData, setIngestSampleData] = useState(
    (data?.source.sourceConfig.config as ConfigClass)?.generateSampleData ??
      true
  );
  const [dashboardFilterPattern, setDashboardFilterPattern] =
    useState<FilterPattern>(
      (data?.source.sourceConfig.config as ConfigClass)
        ?.dashboardFilterPattern ?? INITIAL_FILTER_PATTERN
    );
  const [schemaFilterPattern, setSchemaFilterPattern] = useState<FilterPattern>(
    (data?.source.sourceConfig.config as ConfigClass)?.schemaFilterPattern ??
      INITIAL_FILTER_PATTERN
  );
  const [tableFilterPattern, setTableFilterPattern] = useState<FilterPattern>(
    (data?.source.sourceConfig.config as ConfigClass)?.tableFilterPattern ??
      INITIAL_FILTER_PATTERN
  );
  const [topicFilterPattern, setTopicFilterPattern] = useState<FilterPattern>(
    (data?.source.sourceConfig.config as ConfigClass)?.topicFilterPattern ??
      INITIAL_FILTER_PATTERN
  );
  const [chartFilterPattern, setChartFilterPattern] = useState<FilterPattern>(
    (data?.source.sourceConfig.config as ConfigClass)?.chartFilterPattern ??
      INITIAL_FILTER_PATTERN
  );

  const [queryLogDuration, setQueryLogDuration] = useState<number>(
    (data?.source.sourceConfig.config as ConfigClass)?.queryLogDuration ?? 1
  );
  const [stageFileLocation, setStageFileLocation] = useState<string>(
    (data?.source.sourceConfig.config as ConfigClass)?.stageFileLocation ??
      '/tmp/query_log'
  );
  const [resultLimit, setResultLimit] = useState<number>(
    (data?.source.sourceConfig.config as ConfigClass)?.resultLimit ?? 100
  );
  const [usageIngestionType] = useState<ConfigType>(
    (data?.source.sourceConfig.config as ConfigClass)?.type ??
      ConfigType.DatabaseUsage
  );

  const getIncludeValue = (value: Array<string>, type: FilterPatternEnum) => {
    switch (type) {
      case FilterPatternEnum.DASHBOARD:
        setDashboardFilterPattern({
          ...dashboardFilterPattern,
          includes: value,
        });

        break;
      case FilterPatternEnum.SCHEMA:
        setSchemaFilterPattern({ ...schemaFilterPattern, includes: value });

        break;
      case FilterPatternEnum.TABLE:
        setTableFilterPattern({ ...tableFilterPattern, includes: value });

        break;
      case FilterPatternEnum.TOPIC:
        setTopicFilterPattern({ ...topicFilterPattern, includes: value });

        break;
      case FilterPatternEnum.CHART:
        setChartFilterPattern({ ...topicFilterPattern, includes: value });

        break;
    }
  };
  const getExcludeValue = (value: Array<string>, type: FilterPatternEnum) => {
    switch (type) {
      case FilterPatternEnum.DASHBOARD:
        setDashboardFilterPattern({
          ...dashboardFilterPattern,
          excludes: value,
        });

        break;
      case FilterPatternEnum.SCHEMA:
        setSchemaFilterPattern({ ...schemaFilterPattern, excludes: value });

        break;
      case FilterPatternEnum.TABLE:
        setTableFilterPattern({ ...tableFilterPattern, excludes: value });

        break;
      case FilterPatternEnum.TOPIC:
        setTopicFilterPattern({ ...topicFilterPattern, excludes: value });

        break;
      case FilterPatternEnum.CHART:
        setChartFilterPattern({ ...topicFilterPattern, excludes: value });

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
    handleCancelClick();
  };

  const handleConfigureIngestionNextClick = () => {
    setActiveIngestionStep(2);
  };

  const handleScheduleIntervalBackClick = () => {
    setActiveIngestionStep(1);
  };

  const getFilterPatternData = (data: FilterPattern) => {
    const { includes, excludes } = data;

    const filterPattern =
      (!isUndefined(includes) && includes.length) ||
      (!isUndefined(excludes) && excludes.length)
        ? {
            includes: includes && includes.length > 0 ? includes : undefined,
            excludes: excludes && excludes.length > 0 ? excludes : undefined,
          }
        : undefined;

    return filterPattern;
  };

  const createNewIngestion = () => {
    const ingestionDetails: CreateIngestionPipeline = {
      airflowConfig: {
        startDate: startDate as unknown as Date,
        endDate: isEmpty(endDate) ? undefined : (endDate as unknown as Date),
        scheduleInterval: repeatFrequency,
        forceDeploy: true,
      },
      name: ingestionName,
      displayName: ingestionName,
      owner: {
        id: getCurrentUserId(),
        type: 'user',
      },
      pipelineType: pipelineType,
      service: {
        id: serviceData.id as string,
        type: serviceCategory.slice(0, -1),
      },
      sourceConfig: {
        config:
          pipelineType === PipelineType.Usage
            ? {
                queryLogDuration,
                resultLimit,
                stageFileLocation,
                type: usageIngestionType,
              }
            : {
                enableDataProfiler: enableDataProfiler,
                generateSampleData: ingestSampleData,
                includeViews: includeView,
                schemaFilterPattern: getFilterPatternData(schemaFilterPattern),
                tableFilterPattern: getFilterPatternData(tableFilterPattern),
                chartFilterPattern: getFilterPatternData(chartFilterPattern),
                dashboardFilterPattern: getFilterPatternData(
                  dashboardFilterPattern
                ),
                topicFilterPattern: getFilterPatternData(topicFilterPattern),
              },
      },
    };

    onAddIngestionSave &&
      onAddIngestionSave(ingestionDetails).then(() => {
        if (showSuccessScreen) {
          setActiveIngestionStep(3);
        } else {
          onSuccessSave?.();
        }
      });
  };

  const updateIngestion = () => {
    if (data) {
      const updatedData: IngestionPipeline = {
        ...data,
        airflowConfig: {
          ...data.airflowConfig,
          startDate: startDate as unknown as Date,
          endDate: (endDate as unknown as Date) || null,
          scheduleInterval: repeatFrequency,
        },
        source: {
          ...data.source,
          sourceConfig: {
            config: {
              ...(data.source.sourceConfig.config as ConfigClass),
              ...(pipelineType === PipelineType.Usage
                ? {
                    queryLogDuration,
                    resultLimit,
                    stageFileLocation,
                    type: usageIngestionType,
                  }
                : {
                    enableDataProfiler: enableDataProfiler,
                    generateSampleData: ingestSampleData,
                    includeViews: includeView,
                    schemaFilterPattern:
                      getFilterPatternData(schemaFilterPattern),
                    tableFilterPattern:
                      getFilterPatternData(tableFilterPattern),
                    chartFilterPattern:
                      getFilterPatternData(chartFilterPattern),
                    dashboardFilterPattern: getFilterPatternData(
                      dashboardFilterPattern
                    ),
                    topicFilterPattern:
                      getFilterPatternData(topicFilterPattern),
                  }),
            },
          },
        },
      };

      onUpdateIngestion &&
        onUpdateIngestion(updatedData, data, data.id as string, data.name).then(
          () => {
            onSuccessSave?.();
          }
        );
    }
  };

  const handleScheduleIntervalDeployClick = () => {
    if (status === FormSubmitType.ADD) {
      createNewIngestion();
    } else {
      updateIngestion();
    }
  };

  return (
    <div data-testid="add-ingestion-container">
      <h6 className="tw-heading tw-text-base">{heading}</h6>

      <IngestionStepper
        activeStep={activeIngestionStep}
        className="tw-justify-between tw-w-10/12 tw-mx-auto"
        stepperLineClassName="add-ingestion-line"
        steps={STEPS_FOR_ADD_INGESTION}
      />

      <div className="tw-pt-7">
        {activeIngestionStep === 1 && (
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
            handleQueryLogDuration={(val) => setQueryLogDuration(val)}
            handleResultLimit={(val) => setResultLimit(val)}
            handleShowFilter={handleShowFilter}
            handleStageFileLocation={(val) => setStageFileLocation(val)}
            includeView={includeView}
            ingestSampleData={ingestSampleData}
            ingestionName={ingestionName}
            pipelineType={pipelineType}
            queryLogDuration={queryLogDuration}
            resultLimit={resultLimit}
            schemaFilterPattern={schemaFilterPattern}
            serviceCategory={serviceCategory}
            showChartFilter={showChartFilter}
            showDashboardFilter={showDashboardFilter}
            showSchemaFilter={showSchemaFilter}
            showTableFilter={showTableFilter}
            showTopicFilter={showTopicFilter}
            stageFileLocation={stageFileLocation}
            tableFilterPattern={tableFilterPattern}
            topicFilterPattern={topicFilterPattern}
            onCancel={handleConfigureIngestionCancelClick}
            onNext={handleConfigureIngestionNextClick}
          />
        )}

        {activeIngestionStep === 2 && (
          <ScheduleInterval
            endDate={endDate as string}
            handleEndDateChange={(value: string) => setEndDate(value)}
            handleRepeatFrequencyChange={(value: string) =>
              setRepeatFrequency(value)
            }
            handleStartDateChange={(value: string) => setStartDate(value)}
            repeatFrequency={repeatFrequency}
            startDate={startDate as string}
            onBack={handleScheduleIntervalBackClick}
            onDeloy={handleScheduleIntervalDeployClick}
          />
        )}

        {activeIngestionStep > 2 && handleViewServiceClick && (
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
