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

import { Col, Form, Input, Typography } from 'antd';
import { isEmpty, isUndefined, omit, trim } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { STEPS_FOR_ADD_INGESTION } from '../../../../constants/Ingestions.constant';
import { DEFAULT_SCHEDULE_CRON_DAILY } from '../../../../constants/Schedular.constants';
import { useLimitStore } from '../../../../context/LimitsProvider/useLimitsStore';
import { LOADING_STATE } from '../../../../enums/common.enum';
import { FormSubmitType } from '../../../../enums/form.enum';
import {
  CreateIngestionPipeline,
  LogLevels,
  PipelineType,
} from '../../../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { IngestionPipeline } from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useFqn } from '../../../../hooks/useFqn';
import { IngestionWorkflowData } from '../../../../interface/service.interface';
import { generateFormFields } from '../../../../utils/formUtils';
import {
  getDefaultFilterPropertyValues,
  getSuccessMessage,
} from '../../../../utils/IngestionUtils';
import { cleanWorkFlowData } from '../../../../utils/IngestionWorkflowUtils';
import {
  getRaiseOnErrorFormField,
  getScheduleOptionsFromSchedules,
} from '../../../../utils/SchedularUtils';
import { getIngestionName } from '../../../../utils/ServiceUtils';
import { generateUUID } from '../../../../utils/StringsUtils';
import SuccessScreen from '../../../common/SuccessScreen/SuccessScreen';
import DeployIngestionLoaderModal from '../../../Modals/DeployIngestionLoaderModal/DeployIngestionLoaderModal';
import IngestionStepper from '../Ingestion/IngestionStepper/IngestionStepper.component';
import IngestionWorkflowForm from '../Ingestion/IngestionWorkflowForm/IngestionWorkflowForm';
import { AddIngestionProps } from './IngestionWorkflow.interface';
import ScheduleInterval from './Steps/ScheduleInterval';
import {
  IngestionExtraConfig,
  WorkflowExtraConfig,
} from './Steps/ScheduleInterval.interface';

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
  const { ingestionFQN } = useFqn();
  const { currentUser } = useApplicationStore();
  const { config: limitConfig } = useLimitStore();

  const isEditMode = !isEmpty(ingestionFQN);

  const { pipelineSchedules } =
    limitConfig?.limits?.config.featureLimits.find(
      (limit) => limit.name === 'ingestionPipeline'
    ) ?? {};

  const periodOptions = pipelineSchedules
    ? getScheduleOptionsFromSchedules(pipelineSchedules)
    : undefined;

  const filterProperties = useMemo(
    () =>
      getDefaultFilterPropertyValues({
        pipelineType,
        serviceCategory,
        ingestionData: data,
        serviceData,
        isEditMode,
      }),
    [pipelineType, serviceCategory, data, serviceData, isEditMode]
  );

  // lazy initialization to initialize the data only once
  const [workflowData, setWorkflowData] = useState<IngestionWorkflowData>(
    () => ({
      ...(data?.sourceConfig.config ?? {}),
      ...filterProperties,
      name: data?.name ?? generateUUID(),
      displayName:
        data?.displayName ?? getIngestionName(serviceData.name, pipelineType),
      processingEngine: data?.processingEngine,
      enableDebugLog: data?.loggerLevel === LogLevels.Debug,
      raiseOnError: data?.raiseOnError ?? true,
    })
  );

  const { ingestionName, retries } = useMemo(
    () => ({
      ingestionName:
        workflowData?.displayName ??
        getIngestionName(serviceData.name, pipelineType),
      retries: data?.airflowConfig.retries ?? 0,
    }),
    [data, pipelineType, serviceData, workflowData]
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

  const [saveState, setSaveState] = useState<LOADING_STATE>(
    LOADING_STATE.INITIAL
  );
  const [showDeployModal, setShowDeployModal] = useState(false);

  const handleDataChange = (data: IngestionWorkflowData) =>
    setWorkflowData(data);

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

  const createNewIngestion = (
    extraData: WorkflowExtraConfig & IngestionExtraConfig
  ) => {
    const {
      name = '',
      enableDebugLog,
      displayName,
      raiseOnError,
      processingEngine,
      ...rest
    } = workflowData ?? {};
    const ingestionName = trim(name);
    setSaveState(LOADING_STATE.WAITING);

    // below setting is required to trigger workflow which schedule with one day or more frequency
    const date = new Date(Date.now());
    date.setUTCHours(0, 0, 0, 0); // setting time to 00:00:00
    date.setDate(date.getDate() - 1); // subtracting 1 day from current date

    const ingestionDetails: CreateIngestionPipeline = {
      airflowConfig: {
        scheduleInterval: extraData.cron,
        startDate: date,
        retries: extraData.retries,
      },
      raiseOnError: extraData.raiseOnError ?? true,
      loggerLevel: enableDebugLog ? LogLevels.Debug : LogLevels.Info,
      name: ingestionName,
      displayName: displayName,
      processingEngine,
      owners: [
        {
          id: currentUser?.id ?? '',
          type: 'user',
        },
      ],
      pipelineType: pipelineType,
      service: {
        id: serviceData.id as string,
        type: serviceCategory.slice(0, -1),
      },
      sourceConfig: {
        // clean the data to remove empty fields
        config: { ...cleanWorkFlowData(rest) },
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

  const updateIngestion = (
    extraData: WorkflowExtraConfig & IngestionExtraConfig
  ) => {
    if (data) {
      const updatedData: IngestionPipeline = {
        ...data,
        airflowConfig: {
          ...data.airflowConfig,
          scheduleInterval: extraData.cron,
          retries: extraData.retries,
        },
        raiseOnError: extraData.raiseOnError ?? true,
        displayName: workflowData?.displayName,
        processingEngine: workflowData?.processingEngine,
        loggerLevel: workflowData?.enableDebugLog
          ? LogLevels.Debug
          : LogLevels.Info,
        sourceConfig: {
          config: {
            // clean the data to remove empty fields
            ...cleanWorkFlowData(
              omit(workflowData, [
                'name',
                'enableDebugLog',
                'displayName',
                'raiseOnError',
                'processingEngine',
              ]) ?? {}
            ),
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

  const handleScheduleIntervalDeployClick = (
    extraData: WorkflowExtraConfig & IngestionExtraConfig
  ) => {
    if (status === FormSubmitType.ADD) {
      createNewIngestion(extraData);
    } else {
      updateIngestion(extraData);
    }
  };

  const raiseOnErrorFormField = useMemo(
    () => getRaiseOnErrorFormField(onFocus),
    [onFocus]
  );

  return (
    <div data-testid="add-ingestion-container">
      <Typography.Title className="font-normal" level={5}>
        {heading}
      </Typography.Title>

      <IngestionStepper
        activeStep={activeIngestionStep}
        excludeSteps={[]}
        steps={STEPS_FOR_ADD_INGESTION}
      />

      <div className="p-t-lg">
        {activeIngestionStep === 1 && (
          <IngestionWorkflowForm
            okText={t('label.next')}
            operationType={status}
            pipeLineType={pipelineType}
            serviceCategory={serviceCategory}
            serviceData={serviceData}
            workflowData={workflowData}
            onCancel={handleCancelClick}
            onChange={handleDataChange}
            onFocus={onFocus}
            onSubmit={handleSubmit}
          />
        )}

        {activeIngestionStep === 2 && (
          <ScheduleInterval<IngestionExtraConfig>
            buttonProps={{
              okText: isUndefined(data)
                ? t('label.add-deploy')
                : t('label.submit'),
            }}
            defaultSchedule={DEFAULT_SCHEDULE_CRON_DAILY}
            disabled={pipelineType === PipelineType.DataInsight}
            includePeriodOptions={periodOptions}
            initialData={{
              cron: data?.airflowConfig.scheduleInterval,
              raiseOnError: data?.raiseOnError ?? true,
            }}
            isEditMode={isEditMode}
            status={saveState}
            onBack={() => handlePrev(1)}
            onDeploy={handleScheduleIntervalDeployClick}>
            <Col span={24}>
              <Form.Item
                colon={false}
                initialValue={retries}
                label={t('label.number-of-retries')}
                name="retries">
                <Input
                  min={0}
                  type="number"
                  onFocus={() => onFocus('root/retries')}
                />
              </Form.Item>
            </Col>
            <Col span={24}>{generateFormFields([raiseOnErrorFormField])}</Col>
          </ScheduleInterval>
        )}

        {activeIngestionStep > 2 && handleViewServiceClick && (
          <SuccessScreen
            handleDeployClick={handleDeployClick}
            handleViewServiceClick={handleViewServiceClick}
            name={ingestionName}
            showDeployButton={showDeployButton}
            showIngestionButton={false}
            state={status}
            successMessage={getSuccessMessage(
              ingestionName,
              status,
              showDeployButton
            )}
            viewServiceText={viewServiceText}
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
