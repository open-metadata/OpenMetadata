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
import { LoadingState } from 'Models';
import React, { useMemo, useState } from 'react';
import {
  INGESTION_SCHEDULER_INITIAL_VALUE,
  INITIAL_FILTER_PATTERN,
  STEPS_FOR_ADD_INGESTION,
} from '../../constants/ingestion.constant';
import { FilterPatternEnum } from '../../enums/filterPattern.enum';
import { FormSubmitType } from '../../enums/form.enum';
import { ServiceCategory } from '../../enums/service.enum';
import {
  ConfigClass,
  CreateIngestionPipeline,
  LogLevels,
  PipelineType,
} from '../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import {
  ConfigType,
  FilterPattern,
  IngestionPipeline,
} from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import {
  DatabaseServiceMetadataPipelineClass,
  DbtConfigSource,
} from '../../generated/metadataIngestion/databaseServiceMetadataPipeline';
import { getCurrentDate, getCurrentUserId } from '../../utils/CommonUtils';
import { getSourceTypeFromConfig } from '../../utils/DBTConfigFormUtil';
import { escapeBackwardSlashChar } from '../../utils/JSONSchemaFormUtils';
import { getIngestionName } from '../../utils/ServiceUtils';
import DBTConfigFormBuilder from '../common/DBTConfigFormBuilder/DBTConfigFormBuilder';
import {
  DBT_SOURCES,
  GCS_CONFIG,
} from '../common/DBTConfigFormBuilder/DBTFormEnum';
import SuccessScreen from '../common/success-screen/SuccessScreen';
import IngestionStepper from '../IngestionStepper/IngestionStepper.component';
import DeployIngestionLoaderModal from '../Modals/DeployIngestionLoaderModal/DeployIngestionLoaderModal';
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
  ingestionProgress = 0,
  isIngestionCreated = false,
  isIngestionDeployed = false,
  ingestionAction = '',
  showDeployButton,
  setActiveIngestionStep,
  onIngestionDeploy,
  onUpdateIngestion,
  onSuccessSave,
  onAddIngestionSave,
  handleCancelClick,
  handleViewServiceClick,
}: AddIngestionProps) => {
  const isDatabaseService = useMemo(() => {
    return serviceCategory === ServiceCategory.DATABASE_SERVICES;
  }, [serviceCategory]);
  const showDBTConfig = useMemo(() => {
    return isDatabaseService && pipelineType === PipelineType.Metadata;
  }, [isDatabaseService, pipelineType]);

  const [saveState, setSaveState] = useState<LoadingState>('initial');
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [ingestionName, setIngestionName] = useState(
    data?.name ?? getIngestionName(serviceData.name, pipelineType)
  );
  const [description, setDescription] = useState(data?.description ?? '');
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
  const [showDatabaseFilter, setShowDatabaseFilter] = useState(
    !isUndefined(
      (data?.source.sourceConfig.config as ConfigClass)?.databaseFilterPattern
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
  const [showFqnFilter, setShowFqnFilter] = useState(
    !isUndefined(
      (data?.source.sourceConfig.config as ConfigClass)?.fqnFilterPattern
    )
  );
  const configData = useMemo(
    () =>
      (data?.source.sourceConfig.config as DatabaseServiceMetadataPipelineClass)
        ?.dbtConfigSource,
    [data]
  );
  const [dbtConfigSource, setDbtConfigSource] = useState<
    DbtConfigSource | undefined
  >(showDBTConfig ? (configData as DbtConfigSource) : undefined);

  const sourceTypeData = useMemo(
    () => getSourceTypeFromConfig(configData as DbtConfigSource | undefined),
    [configData]
  );
  const [dbtConfigSourceType, setDbtConfigSourceType] = useState<
    DBT_SOURCES | undefined
  >(showDBTConfig ? sourceTypeData.sourceType : undefined);
  const [gcsConfigType, setGcsConfigType] = useState<GCS_CONFIG | undefined>(
    showDBTConfig ? sourceTypeData.gcsType : undefined
  );
  const [markDeletedTables, setMarkDeletedTables] = useState(
    isDatabaseService
      ? Boolean(
          (data?.source.sourceConfig.config as ConfigClass)
            ?.markDeletedTables ?? true
        )
      : undefined
  );
  const [includeView, setIncludeView] = useState(
    Boolean((data?.source.sourceConfig.config as ConfigClass)?.includeViews)
  );
  const [enableDataProfiler, setEnableDataProfiler] = useState(
    (data?.source.sourceConfig.config as ConfigClass)?.enableDataProfiler ??
      true
  );
  const [ingestSampleData, setIngestSampleData] = useState(
    (data?.source.sourceConfig.config as ConfigClass)?.generateSampleData ??
      true
  );
  const [enableDebugLog, setEnableDebugLog] = useState(
    data?.loggerLevel === LogLevels.Debug
  );
  const [dashboardFilterPattern, setDashboardFilterPattern] =
    useState<FilterPattern>(
      (data?.source.sourceConfig.config as ConfigClass)
        ?.dashboardFilterPattern ?? INITIAL_FILTER_PATTERN
    );
  const [databaseFilterPattern, setDatabaseFilterPattern] =
    useState<FilterPattern>(
      (data?.source.sourceConfig.config as ConfigClass)
        ?.databaseFilterPattern ?? INITIAL_FILTER_PATTERN
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
  const [fqnFilterPattern, setFqnFilterPattern] = useState<FilterPattern>(
    (data?.source.sourceConfig.config as ConfigClass)?.fqnFilterPattern ??
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
  const usageIngestionType = useMemo(() => {
    return (
      (data?.source.sourceConfig.config as ConfigClass)?.type ??
      ConfigType.DatabaseUsage
    );
  }, [data]);
  const profilerIngestionType = useMemo(() => {
    return (
      (data?.source.sourceConfig.config as ConfigClass)?.type ??
      ConfigType.Profiler
    );
  }, [data]);

  const getIncludeValue = (value: Array<string>, type: FilterPatternEnum) => {
    switch (type) {
      case FilterPatternEnum.DASHBOARD:
        setDashboardFilterPattern({
          ...dashboardFilterPattern,
          includes: value,
        });

        break;
      case FilterPatternEnum.DATABASE:
        setDatabaseFilterPattern({ ...databaseFilterPattern, includes: value });

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
      case FilterPatternEnum.FQN:
        setFqnFilterPattern({ ...fqnFilterPattern, includes: value });

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
      case FilterPatternEnum.DATABASE:
        setDatabaseFilterPattern({ ...databaseFilterPattern, excludes: value });

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
      case FilterPatternEnum.FQN:
        setFqnFilterPattern({ ...fqnFilterPattern, excludes: value });

        break;
    }
  };

  const handleShowFilter = (value: boolean, type: FilterPatternEnum) => {
    switch (type) {
      case FilterPatternEnum.DASHBOARD:
        setShowDashboardFilter(value);

        break;
      case FilterPatternEnum.DATABASE:
        setShowDatabaseFilter(value);

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
      case FilterPatternEnum.FQN:
        setShowFqnFilter(value);

        break;
    }
  };

  const handleNext = () => {
    let nextStep;
    if (!showDBTConfig && activeIngestionStep === 1) {
      nextStep = activeIngestionStep + 2;
    } else {
      nextStep = activeIngestionStep + 1;
    }
    setActiveIngestionStep(nextStep);
  };

  const handlePrev = () => {
    let prevStep;
    if (!showDBTConfig && activeIngestionStep === 3) {
      prevStep = activeIngestionStep - 2;
    } else {
      prevStep = activeIngestionStep - 1;
    }
    setActiveIngestionStep(prevStep);
  };

  const getFilterPatternData = (data: FilterPattern, isVisible: boolean) => {
    if (!isVisible) {
      return undefined;
    }

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

  const getMetadataIngestionFields = () => {
    switch (serviceCategory) {
      case ServiceCategory.DATABASE_SERVICES: {
        const DatabaseConfigData = {
          ...(showDBTConfig
            ? escapeBackwardSlashChar({ dbtConfigSource } as ConfigClass)
            : undefined),
        };

        return {
          enableDataProfiler: enableDataProfiler,
          generateSampleData: ingestSampleData,
          includeViews: includeView,
          databaseFilterPattern: getFilterPatternData(
            databaseFilterPattern,
            showDatabaseFilter
          ),
          schemaFilterPattern: getFilterPatternData(
            schemaFilterPattern,
            showSchemaFilter
          ),
          tableFilterPattern: getFilterPatternData(
            tableFilterPattern,
            showTableFilter
          ),
          markDeletedTables,
          ...DatabaseConfigData,
          type: ConfigType.DatabaseMetadata,
        };
      }
      case ServiceCategory.MESSAGING_SERVICES: {
        return {
          topicFilterPattern: getFilterPatternData(
            topicFilterPattern,
            showTopicFilter
          ),
          type: ConfigType.MessagingMetadata,
        };
      }
      case ServiceCategory.DASHBOARD_SERVICES: {
        return {
          chartFilterPattern: getFilterPatternData(
            chartFilterPattern,
            showChartFilter
          ),
          dashboardFilterPattern: getFilterPatternData(
            dashboardFilterPattern,
            showDashboardFilter
          ),
          type: ConfigType.DashboardMetadata,
        };
      }
      default: {
        return {};
      }
    }
  };

  const getConfigData = (type: PipelineType): ConfigClass => {
    switch (type) {
      case PipelineType.Usage: {
        return {
          queryLogDuration,
          resultLimit,
          stageFileLocation,
          type: usageIngestionType,
        };
      }
      case PipelineType.Profiler: {
        return {
          fqnFilterPattern: getFilterPatternData(
            fqnFilterPattern,
            showFqnFilter
          ),
          type: profilerIngestionType,
        };
      }
      case PipelineType.Metadata:
      default: {
        return getMetadataIngestionFields();
      }
    }
  };

  const createNewIngestion = () => {
    const ingestionDetails: CreateIngestionPipeline = {
      airflowConfig: {
        startDate: startDate as unknown as Date,
        endDate: isEmpty(endDate) ? undefined : (endDate as unknown as Date),
        scheduleInterval: repeatFrequency,
      },
      loggerLevel: enableDebugLog ? LogLevels.Debug : LogLevels.Info,
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
        config: getConfigData(pipelineType),
      },
    };

    if (onAddIngestionSave) {
      setShowDeployModal(true);
      onAddIngestionSave(ingestionDetails)
        .then(() => {
          if (showSuccessScreen) {
            handleNext();
          } else {
            onSuccessSave?.();
          }
        })
        .catch(() => {
          // ignore since error is displayed in toast in the parent promise
        })
        .finally(() => {
          setTimeout(() => setShowDeployModal(false), 500);
        });
    }
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
        loggerLevel: enableDebugLog ? LogLevels.Debug : LogLevels.Info,
        source: {
          ...data.source,
          sourceConfig: {
            config: {
              ...(data.source.sourceConfig.config as ConfigClass),
              ...getConfigData(pipelineType),
            },
          },
        },
      };

      if (onUpdateIngestion) {
        setSaveState('waiting');
        setShowDeployModal(true);
        onUpdateIngestion(updatedData, data, data.id as string, data.name)
          .then(() => {
            setSaveState('success');
            if (showSuccessScreen) {
              handleNext();
            } else {
              onSuccessSave?.();
            }
          })
          .finally(() => {
            setTimeout(() => setSaveState('initial'), 500);
            setTimeout(() => setShowDeployModal(false), 500);
          });
      }
    }
  };

  const handleDeployClick = () => {
    setShowDeployModal(true);
    onIngestionDeploy?.().finally(() => {
      setTimeout(() => setShowDeployModal(false), 500);
    });
  };

  const handleScheduleIntervalDeployClick = () => {
    if (status === FormSubmitType.ADD) {
      createNewIngestion();
    } else {
      updateIngestion();
    }
  };

  const getSuccessMessage = () => {
    const updateMessage = showDeployButton
      ? 'has been updated, but failed to deploy'
      : 'has been updated and deployed successfully';
    const createMessage = showDeployButton
      ? 'has been created, but failed to deploy'
      : 'has been created and deployed successfully';

    return (
      <span>
        <span className="tw-mr-1 tw-font-semibold">
          &quot;{ingestionName}&quot;
        </span>
        <span>
          {status === FormSubmitType.ADD ? createMessage : updateMessage}
        </span>
      </span>
    );
  };

  return (
    <div data-testid="add-ingestion-container">
      <h6 className="tw-heading tw-text-base">{heading}</h6>

      <IngestionStepper
        activeStep={activeIngestionStep}
        className="tw-justify-between tw-w-10/12 tw-mx-auto"
        excludeSteps={!showDBTConfig ? [2] : undefined}
        stepperLineClassName="add-ingestion-line"
        steps={STEPS_FOR_ADD_INGESTION}
      />

      <div className="tw-pt-7">
        {activeIngestionStep === 1 && (
          <ConfigureIngestion
            chartFilterPattern={chartFilterPattern}
            dashboardFilterPattern={dashboardFilterPattern}
            databaseFilterPattern={databaseFilterPattern}
            description={description}
            enableDataProfiler={enableDataProfiler}
            enableDebugLog={enableDebugLog}
            fqnFilterPattern={fqnFilterPattern}
            getExcludeValue={getExcludeValue}
            getIncludeValue={getIncludeValue}
            handleDescription={(val) => setDescription(val)}
            handleEnableDataProfiler={() =>
              setEnableDataProfiler((pre) => !pre)
            }
            handleEnableDebugLog={() => setEnableDebugLog((pre) => !pre)}
            handleIncludeView={() => setIncludeView((pre) => !pre)}
            handleIngestSampleData={() => setIngestSampleData((pre) => !pre)}
            handleIngestionName={(val) => setIngestionName(val)}
            handleMarkDeletedTables={() => setMarkDeletedTables((pre) => !pre)}
            handleQueryLogDuration={(val) => setQueryLogDuration(val)}
            handleResultLimit={(val) => setResultLimit(val)}
            handleShowFilter={handleShowFilter}
            handleStageFileLocation={(val) => setStageFileLocation(val)}
            includeView={includeView}
            ingestSampleData={ingestSampleData}
            ingestionName={ingestionName}
            markDeletedTables={markDeletedTables}
            pipelineType={pipelineType}
            queryLogDuration={queryLogDuration}
            resultLimit={resultLimit}
            schemaFilterPattern={schemaFilterPattern}
            serviceCategory={serviceCategory}
            showChartFilter={showChartFilter}
            showDashboardFilter={showDashboardFilter}
            showDatabaseFilter={showDatabaseFilter}
            showFqnFilter={showFqnFilter}
            showSchemaFilter={showSchemaFilter}
            showTableFilter={showTableFilter}
            showTopicFilter={showTopicFilter}
            stageFileLocation={stageFileLocation}
            tableFilterPattern={tableFilterPattern}
            topicFilterPattern={topicFilterPattern}
            onCancel={handleCancelClick}
            onNext={handleNext}
          />
        )}

        {activeIngestionStep === 2 && (
          <DBTConfigFormBuilder
            cancelText="Back"
            data={dbtConfigSource || {}}
            gcsType={gcsConfigType}
            handleGcsTypeChange={(type) => setGcsConfigType(type)}
            handleSourceChange={(src) => setDbtConfigSourceType(src)}
            okText="Next"
            source={dbtConfigSourceType}
            onCancel={handlePrev}
            onSubmit={(dbtConfigData) => {
              setDbtConfigSource(dbtConfigData);
              handleNext();
            }}
          />
        )}

        {activeIngestionStep === 3 && (
          <ScheduleInterval
            endDate={endDate as string}
            handleEndDateChange={(value: string) => setEndDate(value)}
            handleRepeatFrequencyChange={(value: string) =>
              setRepeatFrequency(value)
            }
            handleStartDateChange={(value: string) => setStartDate(value)}
            repeatFrequency={repeatFrequency}
            startDate={startDate as string}
            status={saveState}
            submitButtonLabel={isUndefined(data) ? 'Add & Deploy' : 'Submit'}
            onBack={handlePrev}
            onDeploy={handleScheduleIntervalDeployClick}
          />
        )}

        {activeIngestionStep > 3 && handleViewServiceClick && (
          <SuccessScreen
            handleDeployClick={handleDeployClick}
            handleViewServiceClick={handleViewServiceClick}
            name={ingestionName}
            showDeployButton={showDeployButton}
            showIngestionButton={false}
            state={status}
            successMessage={getSuccessMessage()}
          />
        )}

        {showDeployModal && (
          <DeployIngestionLoaderModal
            action={ingestionAction}
            ingestionName={ingestionName}
            isDeployed={isIngestionDeployed}
            isIngestionCreated={isIngestionCreated}
            progress={ingestionProgress}
          />
        )}
      </div>
    </div>
  );
};

export default AddIngestion;
