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

import IngestionWorkflowForm from 'components/IngestionWorkflowForm/IngestionWorkflowForm';
import { LOADING_STATE } from 'enums/common.enum';
import { Connection } from 'generated/api/services/createDatabaseService';
import { isEmpty, isUndefined, trim } from 'lodash';
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
  DEFAULT_PARSING_TIMEOUT_LIMIT,
  INITIAL_FILTER_PATTERN,
  STEPS_FOR_ADD_INGESTION,
} from '../../constants/Ingestions.constant';
import { FormSubmitType } from '../../enums/form.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { MetadataServiceType } from '../../generated/api/services/createMetadataService';
import {
  CreateIngestionPipeline,
  LogLevels,
  PipelineType,
} from '../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import {
  IngestionPipeline,
  Pipeline,
} from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { ProfileSampleType } from '../../generated/metadataIngestion/databaseServiceProfilerPipeline';

import { DbtPipeline } from 'generated/metadataIngestion/dbtPipeline';
import { IngestionWorkflowData } from 'interface/service.interface';
import {
  getCurrentUserId,
  getIngestionFrequency,
  reducerWithoutAction,
} from '../../utils/CommonUtils';
import { getSourceTypeFromConfig } from '../../utils/DBTConfigFormUtil';
import { getIngestionName } from '../../utils/ServiceUtils';
import { DBT_SOURCES } from '../common/DBTConfigFormBuilder/DBTFormEnum';
import SuccessScreen from '../common/success-screen/SuccessScreen';
import IngestionStepper from '../IngestionStepper/IngestionStepper.component';
import DeployIngestionLoaderModal from '../Modals/DeployIngestionLoaderModal/DeployIngestionLoaderModal';
import {
  AddIngestionProps,
  AddIngestionState,
  ModifiedDBTConfigurationSource,
} from './addIngestion.interface';
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
  onFocus,
}: AddIngestionProps) => {
  const { t } = useTranslation();
  const { sourceConfig } = useMemo(
    () => ({
      sourceConfig: data?.sourceConfig.config as Pipeline,
      sourceConfigType: (data?.sourceConfig.config as Pipeline)?.type,
    }),
    []
  );

  const isSettingsPipeline = useMemo(
    () =>
      pipelineType === PipelineType.DataInsight ||
      pipelineType === PipelineType.ElasticSearchReindex,
    [pipelineType]
  );

  const viewServiceText = useMemo(
    () =>
      isSettingsPipeline
        ? t('label.view-entity', {
            entity: t('label.pipeline-detail-plural'),
          })
        : undefined,

    [isSettingsPipeline]
  );

  const { configData } = useMemo(() => {
    return {
      configData: (data?.sourceConfig.config as DbtPipeline)?.dbtConfigSource,
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
    () => getSourceTypeFromConfig(configData),
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
      dbtConfigSource: configData as ModifiedDBTConfigurationSource,
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
      includeOwners: Boolean(sourceConfig?.includeOwners),
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
      metadataToESConfig: {
        caCerts: sourceConfig?.caCerts,
        regionName: sourceConfig?.regionName,
        timeout: sourceConfig?.timeout,
        useAwsCredentials: Boolean(sourceConfig?.useAwsCredentials),
        useSSL: Boolean(sourceConfig?.useSSL),
        verifyCerts: Boolean(sourceConfig?.verifyCerts),
        batchSize: sourceConfig?.batchSize,
        searchIndexMappingLanguage: sourceConfig?.searchIndexMappingLanguage,
        recreateIndex: sourceConfig?.recreateIndex,
      },
      dbtUpdateDescriptions: sourceConfig?.dbtUpdateDescriptions ?? false,
      confidence: sourceConfig?.confidence,
      dbtClassificationName:
        sourceConfig?.dbtClassificationName ?? DBT_CLASSIFICATION_DEFAULT_VALUE, // default value from Json Schema
      parsingTimeoutLimit:
        sourceConfig?.parsingTimeoutLimit ?? DEFAULT_PARSING_TIMEOUT_LIMIT,
      viewParsingTimeoutLimit:
        sourceConfig?.viewParsingTimeoutLimit ?? DEFAULT_PARSING_TIMEOUT_LIMIT,
      filterCondition: sourceConfig?.filterCondition ?? '',
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

  const [workflowData, setWorkflowData] = useState<IngestionWorkflowData>();

  const handleStateChange = useCallback(
    (newState: Partial<AddIngestionState>) => {
      dispatch(newState);
    },
    []
  );

  const handleNext = (step: number) => {
    setActiveIngestionStep(step);
  };

  const handlePrev = (step: number) => {
    setActiveIngestionStep(step);
  };

  const handleSubmit = (data: IngestionWorkflowData) => {
    setWorkflowData(data);
    handleNext(2);
  };

  const createNewIngestion = () => {
    const { name = '', ...rest } = workflowData ?? {};
    setSaveState(LOADING_STATE.WAITING);
    const { repeatFrequency, enableDebugLog, ingestionName } = state;
    // below setting is required to trigger workflow which schedule with one day or more frequency
    const date = new Date(Date.now());
    date.setUTCHours(0, 0, 0, 0); // setting time to 00:00:00
    date.setDate(date.getDate() - 1); // subtracting 1 day from current date

    const ingestionDetails: CreateIngestionPipeline = {
      airflowConfig: {
        scheduleInterval: isEmpty(repeatFrequency)
          ? undefined
          : repeatFrequency,
        startDate: date,
      },
      loggerLevel: enableDebugLog ? LogLevels.Debug : LogLevels.Info,
      name: trim(name || ingestionName),
      displayName: trim(name || ingestionName),
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
        config: { ...rest },
      },
    };

    if (onAddIngestionSave) {
      setShowDeployModal(true);
      onAddIngestionSave(ingestionDetails)
        .then(() => {
          if (showSuccessScreen) {
            handleNext(3);
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
          config: {},
        },
      };

      if (onUpdateIngestion) {
        setSaveState(LOADING_STATE.WAITING);
        setShowDeployModal(true);
        onUpdateIngestion(updatedData, data, data.id as string, data.name)
          .then(() => {
            setSaveState(LOADING_STATE.SUCCESS);
            if (showSuccessScreen) {
              handleNext(3);
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
          <IngestionWorkflowForm
            cancelText={t('label.cancel')}
            okText={t('label.next')}
            pipeLineType={pipelineType}
            serviceCategory={serviceCategory}
            workflowName={state.ingestionName}
            onCancel={handleCancelClick}
            onFocus={onFocus}
            onSubmit={handleSubmit}
          />
        )}

        {activeIngestionStep === 2 && (
          <ScheduleInterval
            disabledCronChange={pipelineType === PipelineType.DataInsight}
            includePeriodOptions={
              pipelineType === PipelineType.DataInsight ? ['day'] : undefined
            }
            repeatFrequency={state.repeatFrequency}
            status={saveState}
            submitButtonLabel={
              isUndefined(data) ? t('label.add-deploy') : t('label.submit')
            }
            onBack={() => handlePrev(1)}
            onChange={handleStateChange}
            onDeploy={handleScheduleIntervalDeployClick}
          />
        )}

        {activeIngestionStep > 2 && handleViewServiceClick && (
          <SuccessScreen
            handleDeployClick={handleDeployClick}
            handleViewServiceClick={handleViewServiceClick}
            name={state.ingestionName}
            showDeployButton={showDeployButton}
            showIngestionButton={false}
            state={status}
            successMessage={getSuccessMessage()}
            viewServiceText={viewServiceText}
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
