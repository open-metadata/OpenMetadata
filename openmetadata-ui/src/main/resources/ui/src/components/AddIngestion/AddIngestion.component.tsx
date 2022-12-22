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

import { isEmpty, isUndefined, trim } from 'lodash';
import { LoadingState } from 'Models';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  INITIAL_FILTER_PATTERN,
  STEPS_FOR_ADD_INGESTION,
} from '../../constants/Ingestions.constant';
import { FilterPatternEnum } from '../../enums/filterPattern.enum';
import { FormSubmitType } from '../../enums/form.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { MetadataServiceType } from '../../generated/api/services/createMetadataService';
import {
  CreateIngestionPipeline,
  LogLevels,
  PipelineType,
} from '../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import {
  ConfigClass,
  ConfigType,
  FilterPattern,
  IngestionPipeline,
} from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { ProfileSampleType } from '../../generated/metadataIngestion/databaseServiceProfilerPipeline';
import {
  DbtConfig,
  DbtPipelineClass,
} from '../../generated/metadataIngestion/dbtPipeline';
import {
  getCurrentUserId,
  getIngestionFrequency,
} from '../../utils/CommonUtils';
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
import MetadataToESConfigForm from './Steps/MetadataToESConfigForm/MetadataToESConfigForm';
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
  isAirflowSetup,
  setActiveIngestionStep,
  onIngestionDeploy,
  onUpdateIngestion,
  onSuccessSave,
  onAddIngestionSave,
  onAirflowStatusCheck,
  handleCancelClick,
  handleViewServiceClick,
}: AddIngestionProps) => {
  const { t } = useTranslation();
  const isDatabaseService = useMemo(() => {
    return serviceCategory === ServiceCategory.DATABASE_SERVICES;
  }, [serviceCategory]);
  const isServiceTypeOpenMetadata = useMemo(() => {
    return serviceData.serviceType === MetadataServiceType.OpenMetadata;
  }, [serviceCategory]);
  const showDBTConfig = useMemo(() => {
    return isDatabaseService && pipelineType === PipelineType.Dbt;
  }, [isDatabaseService, pipelineType]);

  const [saveState, setSaveState] = useState<LoadingState>('initial');
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [ingestionName, setIngestionName] = useState(
    data?.name ?? getIngestionName(serviceData.name, pipelineType)
  );
  const [ingestSampleData, setIngestSampleData] = useState(
    (data?.sourceConfig.config as ConfigClass)?.generateSampleData ?? true
  );
  const [useFqnFilter, setUseFqnFilter] = useState(
    (data?.sourceConfig.config as ConfigClass)?.useFqnForFiltering ?? false
  );
  const [databaseServiceNames, setDatabaseServiceNames] = useState(
    (data?.sourceConfig.config as ConfigClass)?.dbServiceNames ?? []
  );
  const [description, setDescription] = useState(data?.description ?? '');
  const [repeatFrequency, setRepeatFrequency] = useState(
    data?.airflowConfig.scheduleInterval ?? getIngestionFrequency(pipelineType)
  );
  const [showDashboardFilter, setShowDashboardFilter] = useState(
    !isUndefined(
      (data?.sourceConfig.config as ConfigClass)?.dashboardFilterPattern
    )
  );
  const [showDatabaseFilter, setShowDatabaseFilter] = useState(
    !isUndefined(
      (data?.sourceConfig.config as ConfigClass)?.databaseFilterPattern
    )
  );
  const [showSchemaFilter, setShowSchemaFilter] = useState(
    !isUndefined(
      (data?.sourceConfig.config as ConfigClass)?.schemaFilterPattern
    )
  );
  const [showTableFilter, setShowTableFilter] = useState(
    !isUndefined((data?.sourceConfig.config as ConfigClass)?.tableFilterPattern)
  );
  const [showTopicFilter, setShowTopicFilter] = useState(
    !isUndefined((data?.sourceConfig.config as ConfigClass)?.topicFilterPattern)
  );
  const [showChartFilter, setShowChartFilter] = useState(
    !isUndefined((data?.sourceConfig.config as ConfigClass)?.chartFilterPattern)
  );
  const [showPipelineFilter, setShowPipelineFilter] = useState(
    !isUndefined(
      (data?.sourceConfig.config as ConfigClass)?.pipelineFilterPattern
    )
  );
  const [showMlModelFilter, setShowMlModelFilter] = useState(
    !isUndefined(
      (data?.sourceConfig.config as ConfigClass)?.mlModelFilterPattern
    )
  );
  const configData = useMemo(
    () => (data?.sourceConfig.config as DbtPipelineClass)?.dbtConfigSource,
    [data]
  );
  const [dbtConfigSource, setDbtConfigSource] = useState<DbtConfig | undefined>(
    configData as DbtConfig
  );

  const sourceTypeData = useMemo(
    () => getSourceTypeFromConfig(configData as DbtConfig | undefined),
    [configData]
  );
  const [dbtConfigSourceType, setDbtConfigSourceType] = useState<DBT_SOURCES>(
    sourceTypeData.sourceType
  );

  const [gcsConfigType, setGcsConfigType] = useState<GCS_CONFIG | undefined>(
    showDBTConfig ? sourceTypeData.gcsType : undefined
  );
  const [markDeletedTables, setMarkDeletedTables] = useState(
    isDatabaseService
      ? Boolean(
          (data?.sourceConfig.config as ConfigClass)?.markDeletedTables ?? true
        )
      : undefined
  );
  const [markAllDeletedTables, setMarkAllDeletedTables] = useState(
    isDatabaseService
      ? Boolean(
          (data?.sourceConfig.config as ConfigClass)?.markAllDeletedTables ??
            false
        )
      : undefined
  );
  const [includeView, setIncludeView] = useState(
    Boolean((data?.sourceConfig.config as ConfigClass)?.includeViews)
  );
  const [includeTag, setIncludeTags] = useState(
    Boolean((data?.sourceConfig.config as ConfigClass)?.includeTags)
  );
  const [includeLineage, setIncludeLineage] = useState(
    Boolean((data?.sourceConfig.config as ConfigClass)?.includeLineage ?? true)
  );
  const [enableDebugLog, setEnableDebugLog] = useState(
    data?.loggerLevel === LogLevels.Debug
  );
  const [profileSample, setProfileSample] = useState(
    (data?.sourceConfig.config as ConfigClass)?.profileSample
  );
  const [profileSampleType, setProfileSampleType] = useState(
    (data?.sourceConfig.config as ConfigClass)?.profileSampleType ||
      ProfileSampleType.Percentage
  );
  const [threadCount, setThreadCount] = useState(
    (data?.sourceConfig.config as ConfigClass)?.threadCount ?? 5
  );
  const [timeoutSeconds, setTimeoutSeconds] = useState(
    (data?.sourceConfig.config as ConfigClass)?.timeoutSeconds ?? 43200
  );
  const [dashboardFilterPattern, setDashboardFilterPattern] =
    useState<FilterPattern>(
      (data?.sourceConfig.config as ConfigClass)?.dashboardFilterPattern ??
        INITIAL_FILTER_PATTERN
    );
  const [databaseFilterPattern, setDatabaseFilterPattern] =
    useState<FilterPattern>(
      (data?.sourceConfig.config as ConfigClass)?.databaseFilterPattern ??
        INITIAL_FILTER_PATTERN
    );
  const [schemaFilterPattern, setSchemaFilterPattern] = useState<FilterPattern>(
    (data?.sourceConfig.config as ConfigClass)?.schemaFilterPattern ??
      INITIAL_FILTER_PATTERN
  );
  const [tableFilterPattern, setTableFilterPattern] = useState<FilterPattern>(
    (data?.sourceConfig.config as ConfigClass)?.tableFilterPattern ??
      INITIAL_FILTER_PATTERN
  );
  const [topicFilterPattern, setTopicFilterPattern] = useState<FilterPattern>(
    (data?.sourceConfig.config as ConfigClass)?.topicFilterPattern ??
      INITIAL_FILTER_PATTERN
  );
  const [chartFilterPattern, setChartFilterPattern] = useState<FilterPattern>(
    (data?.sourceConfig.config as ConfigClass)?.chartFilterPattern ??
      INITIAL_FILTER_PATTERN
  );
  const [pipelineFilterPattern, setPipelineFilterPattern] =
    useState<FilterPattern>(
      (data?.sourceConfig.config as ConfigClass)?.pipelineFilterPattern ??
        INITIAL_FILTER_PATTERN
    );

  const [mlModelFilterPattern, setMlModelFilterPattern] =
    useState<FilterPattern>(
      (data?.sourceConfig.config as ConfigClass)?.mlModelFilterPattern ??
        INITIAL_FILTER_PATTERN
    );

  const [queryLogDuration, setQueryLogDuration] = useState<number>(
    (data?.sourceConfig.config as ConfigClass)?.queryLogDuration ?? 1
  );
  const [stageFileLocation, setStageFileLocation] = useState<string>(
    (data?.sourceConfig.config as ConfigClass)?.stageFileLocation ??
      '/tmp/query_log'
  );
  const [resultLimit, setResultLimit] = useState<number>(
    (data?.sourceConfig.config as ConfigClass)?.resultLimit ?? 1000
  );
  const [metadataToESConfig, SetMetadataToESConfig] = useState<ConfigClass>();

  const usageIngestionType = useMemo(() => {
    return (
      (data?.sourceConfig.config as ConfigClass)?.type ??
      ConfigType.DatabaseUsage
    );
  }, [data]);
  const lineageIngestionType = useMemo(() => {
    return (
      (data?.sourceConfig.config as ConfigClass)?.type ??
      ConfigType.DatabaseLineage
    );
  }, [data]);
  const profilerIngestionType = useMemo(() => {
    return (
      (data?.sourceConfig.config as ConfigClass)?.type ?? ConfigType.Profiler
    );
  }, [data]);

  const handleMetadataToESConfig = (data: ConfigClass) => {
    SetMetadataToESConfig(data);
  };

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
        setChartFilterPattern({ ...chartFilterPattern, includes: value });

        break;
      case FilterPatternEnum.PIPELINE:
        setPipelineFilterPattern({ ...pipelineFilterPattern, includes: value });

        break;
      case FilterPatternEnum.MLMODEL:
        setMlModelFilterPattern({ ...mlModelFilterPattern, includes: value });

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
        setChartFilterPattern({ ...chartFilterPattern, excludes: value });

        break;
      case FilterPatternEnum.PIPELINE:
        setPipelineFilterPattern({ ...pipelineFilterPattern, excludes: value });

        break;
      case FilterPatternEnum.MLMODEL:
        setMlModelFilterPattern({ ...mlModelFilterPattern, excludes: value });

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
      case FilterPatternEnum.PIPELINE:
        setShowPipelineFilter(value);

        break;
      case FilterPatternEnum.MLMODEL:
        setShowMlModelFilter(value);

        break;
    }
  };

  const handleNext = () => {
    let nextStep;
    if (!showDBTConfig && activeIngestionStep === 1) {
      nextStep = activeIngestionStep + 3;
      if (isServiceTypeOpenMetadata) {
        nextStep = activeIngestionStep + 2;
      }
    } else if (showDBTConfig && activeIngestionStep === 2) {
      nextStep = activeIngestionStep + 2;
    } else {
      nextStep = activeIngestionStep + 1;
    }
    setActiveIngestionStep(nextStep);
  };

  const handlePrev = () => {
    let prevStep;
    if (!showDBTConfig && activeIngestionStep === 4) {
      prevStep = activeIngestionStep - 3;
      if (isServiceTypeOpenMetadata) {
        prevStep = activeIngestionStep - 1;
      }
    } else if (
      !showDBTConfig &&
      isServiceTypeOpenMetadata &&
      activeIngestionStep === 3
    ) {
      prevStep = activeIngestionStep - 2;
    } else if (showDBTConfig && activeIngestionStep === 4) {
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
        return {
          useFqnForFiltering: useFqnFilter,
          includeViews: includeView,
          includeTags: includeTag,
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
          markAllDeletedTables,
          type: ConfigType.DatabaseMetadata,
        };
      }
      case ServiceCategory.MESSAGING_SERVICES: {
        return {
          topicFilterPattern: getFilterPatternData(
            topicFilterPattern,
            showTopicFilter
          ),
          generateSampleData: ingestSampleData,
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
          dbServiceNames: databaseServiceNames,
          type: ConfigType.DashboardMetadata,
        };
      }
      case ServiceCategory.PIPELINE_SERVICES: {
        return {
          includeLineage: includeLineage,
          pipelineFilterPattern: getFilterPatternData(
            pipelineFilterPattern,
            showPipelineFilter
          ),
          type: ConfigType.PipelineMetadata,
        };
      }
      case ServiceCategory.ML_MODEL_SERVICES: {
        return {
          mlModelFilterPattern: getFilterPatternData(
            mlModelFilterPattern,
            showMlModelFilter
          ),
          type: ConfigType.MlModelMetadata,
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
      case PipelineType.Lineage: {
        return {
          queryLogDuration,
          resultLimit,
          type: lineageIngestionType,
        };
      }
      case PipelineType.Profiler: {
        return {
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

          type: profilerIngestionType,
          generateSampleData: ingestSampleData,
          profileSample: profileSample,
          profileSampleType: profileSampleType,
          threadCount: threadCount,
          timeoutSeconds: timeoutSeconds,
        };
      }

      case PipelineType.Dbt: {
        return {
          ...escapeBackwardSlashChar({
            dbtConfigSource,
          } as ConfigClass),
          type: ConfigType.Dbt,
        };
      }

      case PipelineType.ElasticSearchReindex:
      case PipelineType.DataInsight: {
        return metadataToESConfig
          ? {
              ...metadataToESConfig,
              type: ConfigType.MetadataToElasticSearch,
            }
          : {};
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
        scheduleInterval: isEmpty(repeatFrequency)
          ? undefined
          : repeatFrequency,
      },
      loggerLevel: enableDebugLog ? LogLevels.Debug : LogLevels.Info,
      name: trim(ingestionName),
      displayName: trim(ingestionName),
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
        config: getConfigData(
          pipelineType
        ) as CreateIngestionPipeline['sourceConfig']['config'],
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
          scheduleInterval: isEmpty(repeatFrequency)
            ? undefined
            : repeatFrequency,
        },
        loggerLevel: enableDebugLog ? LogLevels.Debug : LogLevels.Info,
        sourceConfig: {
          config: {
            ...(data.sourceConfig.config as ConfigClass),
            ...getConfigData(pipelineType),
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
  const getExcludedSteps = () => {
    const excludedSteps = [];
    if (showDBTConfig) {
      excludedSteps.push(1);
    } else {
      excludedSteps.push(2);
    }
    if (!isServiceTypeOpenMetadata) {
      excludedSteps.push(3);
    }

    return excludedSteps;
  };

  return (
    <div data-testid="add-ingestion-container">
      <h6 className="tw-heading tw-text-base">{heading}</h6>

      <IngestionStepper
        activeStep={activeIngestionStep}
        excludeSteps={getExcludedSteps()}
        steps={STEPS_FOR_ADD_INGESTION}
      />

      <div className="tw-pt-7">
        {activeIngestionStep === 1 && (
          <ConfigureIngestion
            chartFilterPattern={chartFilterPattern}
            dashboardFilterPattern={dashboardFilterPattern}
            databaseFilterPattern={databaseFilterPattern}
            databaseServiceNames={databaseServiceNames}
            description={description}
            enableDebugLog={enableDebugLog}
            formType={status}
            getExcludeValue={getExcludeValue}
            getIncludeValue={getIncludeValue}
            handleDatasetServiceName={(val) => setDatabaseServiceNames(val)}
            handleDescription={(val) => setDescription(val)}
            handleEnableDebugLog={() => setEnableDebugLog((pre) => !pre)}
            handleIncludeLineage={() => setIncludeLineage((pre) => !pre)}
            handleIncludeTags={() => setIncludeTags((pre) => !pre)}
            handleIncludeView={() => setIncludeView((pre) => !pre)}
            handleIngestSampleData={() => setIngestSampleData((pre) => !pre)}
            handleIngestionName={(val) => setIngestionName(val)}
            handleMarkAllDeletedTables={() =>
              setMarkAllDeletedTables((pre) => !pre)
            }
            handleMarkDeletedTables={() => setMarkDeletedTables((pre) => !pre)}
            handleProfileSample={(val) => setProfileSample(val)}
            handleProfileSampleType={(val) => setProfileSampleType(val)}
            handleQueryLogDuration={(val) => setQueryLogDuration(val)}
            handleResultLimit={setResultLimit}
            handleShowFilter={handleShowFilter}
            handleStageFileLocation={(val) => setStageFileLocation(val)}
            handleThreadCount={setThreadCount}
            handleTimeoutSeconds={setTimeoutSeconds}
            includeLineage={includeLineage}
            includeTags={includeTag}
            includeView={includeView}
            ingestSampleData={ingestSampleData}
            ingestionName={ingestionName}
            markAllDeletedTables={markAllDeletedTables}
            markDeletedTables={markDeletedTables}
            mlModelFilterPattern={mlModelFilterPattern}
            pipelineFilterPattern={pipelineFilterPattern}
            pipelineType={pipelineType}
            profileSample={profileSample}
            profileSampleType={profileSampleType}
            queryLogDuration={queryLogDuration}
            resultLimit={resultLimit}
            schemaFilterPattern={schemaFilterPattern}
            serviceCategory={serviceCategory}
            showChartFilter={showChartFilter}
            showDashboardFilter={showDashboardFilter}
            showDatabaseFilter={showDatabaseFilter}
            showMlModelFilter={showMlModelFilter}
            showPipelineFilter={showPipelineFilter}
            showSchemaFilter={showSchemaFilter}
            showTableFilter={showTableFilter}
            showTopicFilter={showTopicFilter}
            stageFileLocation={stageFileLocation}
            tableFilterPattern={tableFilterPattern}
            threadCount={threadCount}
            timeoutSeconds={timeoutSeconds}
            topicFilterPattern={topicFilterPattern}
            useFqnFilter={useFqnFilter}
            onCancel={handleCancelClick}
            onNext={handleNext}
            onUseFqnFilterClick={() => setUseFqnFilter((pre) => !pre)}
          />
        )}

        {activeIngestionStep === 2 && (
          <DBTConfigFormBuilder
            cancelText={t('label.cancel')}
            data={dbtConfigSource || {}}
            formType={status}
            gcsType={gcsConfigType}
            handleGcsTypeChange={(type) => setGcsConfigType(type)}
            handleIngestionName={(val) => setIngestionName(val)}
            handleSourceChange={(src) => setDbtConfigSourceType(src)}
            ingestionName={ingestionName}
            okText={t('label.next')}
            source={dbtConfigSourceType}
            onCancel={handleCancelClick}
            onSubmit={(dbtConfigData) => {
              setDbtConfigSource(dbtConfigData);
              handleNext();
            }}
          />
        )}

        {activeIngestionStep === 3 && isServiceTypeOpenMetadata && (
          <MetadataToESConfigForm
            handleMetadataToESConfig={handleMetadataToESConfig}
            handleNext={handleNext}
            handlePrev={handlePrev}
          />
        )}

        {activeIngestionStep === 4 && (
          <ScheduleInterval
            handleRepeatFrequencyChange={(value: string) =>
              setRepeatFrequency(value)
            }
            includePeriodOptions={
              pipelineType === PipelineType.DataInsight ? ['day'] : undefined
            }
            repeatFrequency={repeatFrequency}
            status={saveState}
            submitButtonLabel={
              isUndefined(data) ? t('label.add-deploy') : t('label.submit')
            }
            onBack={handlePrev}
            onDeploy={handleScheduleIntervalDeployClick}
          />
        )}

        {activeIngestionStep > 4 && handleViewServiceClick && (
          <SuccessScreen
            handleDeployClick={handleDeployClick}
            handleViewServiceClick={handleViewServiceClick}
            isAirflowSetup={isAirflowSetup}
            name={ingestionName}
            showDeployButton={showDeployButton}
            showIngestionButton={false}
            state={status}
            successMessage={getSuccessMessage()}
            onCheckAirflowStatus={onAirflowStatusCheck}
          />
        )}

        <DeployIngestionLoaderModal
          action={ingestionAction}
          ingestionName={ingestionName}
          isDeployed={isIngestionDeployed}
          isIngestionCreated={isIngestionCreated}
          progress={ingestionProgress}
          visible={showDeployModal}
        />
      </div>
    </div>
  );
};

export default AddIngestion;
