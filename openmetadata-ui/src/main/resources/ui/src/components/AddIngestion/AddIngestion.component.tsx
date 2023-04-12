/*
 *  Copyright 2022 Collate.
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

import { LOADING_STATE } from 'enums/common.enum';
import { Connection } from 'generated/api/services/createDatabaseService';
import { isEmpty, isUndefined, omit, trim } from 'lodash';
import React, {
  Reducer,
  useCallback,
  useMemo,
  useReducer,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  DBT_CLASSIFICATION_DEFAULT_VALUE,
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
  getFilterTypes,
  getIngestionFrequency,
  reducerWithoutAction,
} from '../../utils/CommonUtils';
import { getSourceTypeFromConfig } from '../../utils/DBTConfigFormUtil';
import { escapeBackwardSlashChar } from '../../utils/JSONSchemaFormUtils';
import { getIngestionName } from '../../utils/ServiceUtils';
import DBTConfigFormBuilder from '../common/DBTConfigFormBuilder/DBTConfigFormBuilder';
import { DBT_SOURCES } from '../common/DBTConfigFormBuilder/DBTFormEnum';
import SuccessScreen from '../common/success-screen/SuccessScreen';
import IngestionStepper from '../IngestionStepper/IngestionStepper.component';
import DeployIngestionLoaderModal from '../Modals/DeployIngestionLoaderModal/DeployIngestionLoaderModal';
import {
  AddIngestionProps,
  AddIngestionState,
  ModifiedDbtConfig,
} from './addIngestion.interface';
import ConfigureIngestion from './Steps/ConfigureIngestion';
import MetadataToESConfigForm from './Steps/MetadataToESConfigForm/MetadataToESConfigForm';
import ScheduleInterval from './Steps/ScheduleInterval';

const AddIngestion = ({
  activeIngestionStep,
  data,
  handleCancelClick,
  handleViewServiceClick,
  heading,
  ingestionAction = '',
  ingestionProgress = 0,
  isIngestionCreated = false,
  isIngestionDeployed = false,
  onAddIngestionSave,
  onIngestionDeploy,
  onSuccessSave,
  onUpdateIngestion,
  pipelineType,
  serviceCategory,
  serviceData,
  setActiveIngestionStep,
  showDeployButton,
  showSuccessScreen = true,
  status,
}: AddIngestionProps) => {
  const { t } = useTranslation();
  const { sourceConfig, sourceConfigType } = useMemo(
    () => ({
      sourceConfig: data?.sourceConfig.config as ConfigClass,
      sourceConfigType: (data?.sourceConfig.config as ConfigClass)?.type,
    }),
    []
  );

  const {
    configData,
    usageIngestionType,
    lineageIngestionType,
    profilerIngestionType,
  } = useMemo(() => {
    return {
      configData: (data?.sourceConfig.config as DbtPipelineClass)
        ?.dbtConfigSource,
      usageIngestionType: sourceConfigType ?? ConfigType.DatabaseUsage,
      lineageIngestionType: sourceConfigType ?? ConfigType.DatabaseLineage,
      profilerIngestionType: sourceConfigType ?? ConfigType.Profiler,
    };
  }, [data]);

  const { isDatabaseService, isServiceTypeOpenMetadata } = useMemo(() => {
    return {
      isDatabaseService: serviceCategory === ServiceCategory.DATABASE_SERVICES,
      isServiceTypeOpenMetadata:
        serviceData.serviceType === MetadataServiceType.OpenMetadata,
    };
  }, [serviceCategory]);

  const showDBTConfig = useMemo(() => {
    return isDatabaseService && pipelineType === PipelineType.Dbt;
  }, [isDatabaseService, pipelineType]);

  const sourceTypeData = useMemo(
    () => getSourceTypeFromConfig(configData as DbtConfig | undefined),
    [configData]
  );
  const { database, ingestAllDatabases } = serviceData.connection
    .config as Connection;

  const initialState: AddIngestionState = useMemo(
    () => ({
      database,
      saveState: 'initial',
      showDeployModal: false,
      ingestionName:
        data?.name ?? getIngestionName(serviceData.name, pipelineType),
      ingestSampleData: sourceConfig?.generateSampleData ?? true,
      useFqnFilter: sourceConfig?.useFqnForFiltering ?? false,
      processPii: sourceConfig?.processPiiSensitive ?? false,
      databaseServiceNames: sourceConfig?.dbServiceNames ?? [],
      description: data?.description ?? '',
      repeatFrequency:
        data?.airflowConfig.scheduleInterval ??
        getIngestionFrequency(pipelineType),
      showDashboardFilter: !isUndefined(sourceConfig?.dashboardFilterPattern),
      showDatabaseFilter: Boolean(
        database || sourceConfig?.databaseFilterPattern
      ),
      isDatabaseFilterDisabled: ingestAllDatabases
        ? !ingestAllDatabases
        : Boolean(database),
      showSchemaFilter: !isUndefined(sourceConfig?.schemaFilterPattern),
      showTableFilter: !isUndefined(sourceConfig?.tableFilterPattern),
      showTopicFilter: !isUndefined(sourceConfig?.topicFilterPattern),
      showDataModelFilter: !isUndefined(sourceConfig?.dataModelFilterPattern),
      showChartFilter: !isUndefined(sourceConfig?.chartFilterPattern),
      showPipelineFilter: !isUndefined(sourceConfig?.pipelineFilterPattern),
      showMlModelFilter: !isUndefined(sourceConfig?.mlModelFilterPattern),
      showContainerFilter: !isUndefined(sourceConfig?.containerFilterPattern),
      dbtConfigSource: configData as ModifiedDbtConfig,
      gcsConfigType: showDBTConfig ? sourceTypeData.gcsType : undefined,
      chartFilterPattern:
        sourceConfig?.chartFilterPattern ?? INITIAL_FILTER_PATTERN,
      dbtConfigSourceType: sourceTypeData.sourceType || DBT_SOURCES.local,
      markDeletedTables: isDatabaseService
        ? Boolean(sourceConfig?.markDeletedTables ?? true)
        : undefined,
      dataModelFilterPattern:
        sourceConfig?.dataModelFilterPattern ?? INITIAL_FILTER_PATTERN,
      dashboardFilterPattern:
        sourceConfig?.dashboardFilterPattern ?? INITIAL_FILTER_PATTERN,
      containerFilterPattern:
        sourceConfig?.containerFilterPattern ?? INITIAL_FILTER_PATTERN,
      databaseFilterPattern: isUndefined(database)
        ? sourceConfig?.databaseFilterPattern ?? INITIAL_FILTER_PATTERN
        : {
            includes: [database],
            excludes: [],
          },
      markAllDeletedTables: isDatabaseService
        ? Boolean(sourceConfig?.markAllDeletedTables ?? false)
        : undefined,
      markDeletedDashboards: sourceConfig?.markDeletedDashboards ?? true,
      markDeletedTopics: sourceConfig?.markDeletedDashboards ?? true,
      markDeletedMlModels: sourceConfig?.markDeletedDashboards ?? true,
      markDeletedPipelines: sourceConfig?.markDeletedDashboards ?? true,
      includeView: Boolean(sourceConfig?.includeViews),
      includeTags: sourceConfig?.includeTags ?? true,
      includeDataModels: sourceConfig?.includeDataModels ?? true,
      overrideOwner: Boolean(sourceConfig?.overrideOwner),
      includeLineage: Boolean(sourceConfig?.includeLineage ?? true),
      enableDebugLog: data?.loggerLevel === LogLevels.Debug,
      profileSample: sourceConfig?.profileSample,
      profileSampleType:
        sourceConfig?.profileSampleType || ProfileSampleType.Percentage,
      threadCount: sourceConfig?.threadCount ?? 5,
      timeoutSeconds: sourceConfig?.timeoutSeconds ?? 43200,
      schemaFilterPattern:
        sourceConfig?.schemaFilterPattern ?? INITIAL_FILTER_PATTERN,
      tableFilterPattern:
        sourceConfig?.tableFilterPattern ?? INITIAL_FILTER_PATTERN,
      topicFilterPattern:
        sourceConfig?.topicFilterPattern ?? INITIAL_FILTER_PATTERN,
      pipelineFilterPattern:
        sourceConfig?.pipelineFilterPattern ?? INITIAL_FILTER_PATTERN,
      mlModelFilterPattern:
        sourceConfig?.mlModelFilterPattern ?? INITIAL_FILTER_PATTERN,
      queryLogDuration: sourceConfig?.queryLogDuration ?? 1,
      stageFileLocation: sourceConfig?.stageFileLocation ?? '/tmp/query_log',
      resultLimit: sourceConfig?.resultLimit ?? 1000,
      metadataToESConfig: undefined,
      dbtUpdateDescriptions: sourceConfig?.dbtUpdateDescriptions ?? false,
      confidence: sourceConfig?.confidence,
      dbtClassificationName:
        sourceConfig?.dbtClassificationName ?? DBT_CLASSIFICATION_DEFAULT_VALUE, // default value from Json Schema
    }),
    []
  );

  const [state, dispatch] = useReducer<
    Reducer<AddIngestionState, Partial<AddIngestionState>>
  >(reducerWithoutAction, initialState);

  const [saveState, setSaveState] = useState<LOADING_STATE>(
    LOADING_STATE.INITIAL
  );
  const [showDeployModal, setShowDeployModal] = useState(false);

  const handleStateChange = useCallback(
    (newState: Partial<AddIngestionState>) => {
      dispatch(newState);
    },
    []
  );

  const handleMetadataToESConfig = (data: ConfigClass) => {
    handleStateChange({
      metadataToESConfig: data,
    });
  };

  const getIncludeValue = (value: Array<string>, type: FilterPatternEnum) => {
    const pattern = getFilterTypes(type);

    return handleStateChange({
      [pattern]: {
        ...(state[pattern] as AddIngestionState),
        includes: value,
      },
    });
  };
  const getExcludeValue = (value: Array<string>, type: FilterPatternEnum) => {
    const pattern = getFilterTypes(type);

    return handleStateChange({
      [pattern]: {
        ...(state[pattern] as AddIngestionState),
        excludes: value,
      },
    });
  };

  // It takes a boolean and a string, and returns a function that takes an object and returns a new
  const handleShowFilter = (value: boolean, showFilter: string) =>
    handleStateChange({
      [showFilter]: value,
    });

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
    const {
      chartFilterPattern,
      dataModelFilterPattern,
      dashboardFilterPattern,
      databaseFilterPattern,
      databaseServiceNames,
      includeLineage,
      includeTags,
      includeView,
      includeDataModels,
      showContainerFilter,
      ingestSampleData,
      markAllDeletedTables,
      markDeletedTables,
      markDeletedDashboards,
      markDeletedTopics,
      markDeletedMlModels,
      markDeletedPipelines,
      mlModelFilterPattern,
      containerFilterPattern,
      pipelineFilterPattern,
      schemaFilterPattern,
      showChartFilter,
      showDashboardFilter,
      showDataModelFilter,
      showDatabaseFilter,
      showMlModelFilter,
      showPipelineFilter,
      showSchemaFilter,
      showTableFilter,
      showTopicFilter,
      tableFilterPattern,
      topicFilterPattern,
      useFqnFilter,
      overrideOwner,
    } = state;

    switch (serviceCategory) {
      case ServiceCategory.DATABASE_SERVICES: {
        return {
          useFqnForFiltering: useFqnFilter,
          includeViews: includeView,
          includeTags: includeTags,
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
          markDeletedTables: markDeletedTables,
          markAllDeletedTables: markAllDeletedTables,
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
          markDeletedTopics,
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
          dataModelFilterPattern: getFilterPatternData(
            dataModelFilterPattern,
            showDataModelFilter
          ),
          dbServiceNames: databaseServiceNames,
          overrideOwner,
          type: ConfigType.DashboardMetadata,
          markDeletedDashboards,
          includeTags,
          includeDataModels,
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
          markDeletedPipelines,
          includeTags,
        };
      }
      case ServiceCategory.ML_MODEL_SERVICES: {
        return {
          mlModelFilterPattern: getFilterPatternData(
            mlModelFilterPattern,
            showMlModelFilter
          ),
          type: ConfigType.MlModelMetadata,
          markDeletedMlModels,
        };
      }
      case ServiceCategory.STORAGE_SERVICES: {
        return {
          containerFilterPattern: getFilterPatternData(
            containerFilterPattern,
            showContainerFilter
          ),
          type: ConfigType.StorageMetadata,
        };
      }

      default: {
        return {};
      }
    }
  };

  const getConfigData = (type: PipelineType): ConfigClass => {
    const {
      databaseFilterPattern,
      dbtConfigSource,
      ingestSampleData,
      metadataToESConfig,
      profileSample,
      profileSampleType,
      queryLogDuration,
      resultLimit,
      schemaFilterPattern,
      showDatabaseFilter,
      showSchemaFilter,
      showTableFilter,
      stageFileLocation,
      tableFilterPattern,
      threadCount,
      timeoutSeconds,
      processPii,
      confidence,
    } = state;
    switch (type) {
      case PipelineType.Usage: {
        return {
          queryLogDuration: queryLogDuration,
          resultLimit: resultLimit,
          stageFileLocation: stageFileLocation,
          type: usageIngestionType,
        };
      }
      case PipelineType.Lineage: {
        return {
          queryLogDuration: queryLogDuration,
          resultLimit: resultLimit,
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
          confidence: processPii ? confidence : undefined,
          profileSampleType: profileSampleType,
          threadCount: threadCount,
          timeoutSeconds: timeoutSeconds,
          processPiiSensitive: processPii,
        };
      }

      case PipelineType.Dbt: {
        return {
          ...escapeBackwardSlashChar({
            dbtConfigSource: omit(dbtConfigSource, [
              'dbtUpdateDescriptions',
              'dbtClassificationName',
              'includeTags',
            ]),
          } as ConfigClass),
          type: ConfigType.Dbt,
          dbtUpdateDescriptions: dbtConfigSource?.dbtUpdateDescriptions,
          includeTags: dbtConfigSource?.includeTags,
          dbtClassificationName: dbtConfigSource?.dbtClassificationName,
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
    setSaveState(LOADING_STATE.WAITING);
    const { repeatFrequency, enableDebugLog, ingestionName } = state;
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
          setTimeout(() => setSaveState(LOADING_STATE.INITIAL), 500);
          setShowDeployModal(false);
        });
    }
  };

  const updateIngestion = () => {
    const { repeatFrequency, enableDebugLog } = state;
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
        setSaveState(LOADING_STATE.WAITING);
        setShowDeployModal(true);
        onUpdateIngestion(updatedData, data, data.id as string, data.name)
          .then(() => {
            setSaveState(LOADING_STATE.SUCCESS);
            if (showSuccessScreen) {
              handleNext();
            } else {
              onSuccessSave?.();
            }
          })
          .finally(() => {
            setTimeout(() => setSaveState(LOADING_STATE.INITIAL), 500);
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
      ? t('message.action-has-been-done-but-failed-to-deploy', {
          action: t('label.updated-lowercase'),
        })
      : t('message.action-has-been-done-but-deploy-successfully', {
          action: t('label.updated-lowercase'),
        });
    const createMessage = showDeployButton
      ? t('message.action-has-been-done-but-failed-to-deploy', {
          action: t('label.created-lowercase'),
        })
      : t('message.action-has-been-done-but-deploy-successfully', {
          action: t('label.created-lowercase'),
        });

    return (
      <span>
        <span className="tw-mr-1 tw-font-semibold">
          {`"${state.ingestionName}"`}
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
            data={state}
            formType={status}
            getExcludeValue={getExcludeValue}
            getIncludeValue={getIncludeValue}
            handleShowFilter={handleShowFilter}
            pipelineType={pipelineType}
            serviceCategory={serviceCategory}
            onCancel={handleCancelClick}
            onChange={handleStateChange}
            onNext={handleNext}
          />
        )}

        {activeIngestionStep === 2 && (
          <DBTConfigFormBuilder
            cancelText={t('label.cancel')}
            data={state}
            formType={status}
            okText={t('label.next')}
            onCancel={handleCancelClick}
            onChange={handleStateChange}
            onSubmit={(dbtConfigData) => {
              handleStateChange({
                dbtConfigSource: dbtConfigData,
              });
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
            includePeriodOptions={
              pipelineType === PipelineType.DataInsight ? ['day'] : undefined
            }
            repeatFrequency={state.repeatFrequency}
            status={saveState}
            submitButtonLabel={
              isUndefined(data) ? t('label.add-deploy') : t('label.submit')
            }
            onBack={handlePrev}
            onChange={handleStateChange}
            onDeploy={handleScheduleIntervalDeployClick}
          />
        )}

        {activeIngestionStep > 4 && handleViewServiceClick && (
          <SuccessScreen
            handleDeployClick={handleDeployClick}
            handleViewServiceClick={handleViewServiceClick}
            name={state.ingestionName}
            showDeployButton={showDeployButton}
            showIngestionButton={false}
            state={status}
            successMessage={getSuccessMessage()}
          />
        )}

        <DeployIngestionLoaderModal
          action={ingestionAction}
          ingestionName={state.ingestionName}
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
