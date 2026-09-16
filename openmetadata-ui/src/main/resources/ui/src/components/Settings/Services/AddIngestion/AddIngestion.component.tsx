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

import { Typography } from '@openmetadata/ui-core-components';
import { isEmpty, isUndefined, omit, trim } from 'lodash';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { STEPS_FOR_ADD_INGESTION } from '../../../../constants/Ingestions.constant';
import { DEFAULT_SCHEDULE_CRON_DAILY } from '../../../../constants/Schedular.constants';
import { useLimitStore } from '../../../../context/LimitsProvider/useLimitsStore';
import { ResourceEntity } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { LOADING_STATE } from '../../../../enums/common.enum';
import { FormSubmitType } from '../../../../enums/form.enum';
import {
  CreateIngestionPipeline,
  LogLevels,
  PipelineType,
} from '../../../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { IngestionPipeline } from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { EntityReference } from '../../../../generated/entity/type';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useEntityPermissions } from '../../../../hooks/useEntityPermissions/useEntityPermissions';
import { useFqn } from '../../../../hooks/useFqn';
import {
  IngestionWorkflowData,
  IngestionWorkflowFormHandle,
} from '../../../../interface/service.interface';
import { getScheduleOptionsFromSchedules } from '../../../../utils/CronExpressionUtils';
import { translateWithNestedKeys } from '../../../../utils/i18next/LocalUtil';
import { getDefaultFilterPropertyValues } from '../../../../utils/IngestionConfigUtils';
import { getSuccessMessage } from '../../../../utils/IngestionUtils';
import { cleanWorkFlowData } from '../../../../utils/IngestionWorkflowUtils';
import { getIngestionName } from '../../../../utils/ServicePureUtils';
import { generateUUID } from '../../../../utils/StringUtils';
import SuccessScreen from '../../../common/SuccessScreen/SuccessScreen';
import DeployIngestionLoaderModal from '../../../Modals/DeployIngestionLoaderModal/DeployIngestionLoaderModal';
import ServiceFlowStepper from '../AddService/ServiceFlowStepper/ServiceFlowStepper';
import IngestionWorkflowForm from '../Ingestion/IngestionWorkflowForm/IngestionWorkflowForm';
import IngestionNameCard from './IngestionNameCard/IngestionNameCard';
import IngestionOwnersField from './IngestionOwnersField/IngestionOwnersField';
import {
  AddIngestionHandle,
  AddIngestionProps,
} from './IngestionWorkflow.interface';
import {
  IngestionExtraConfig,
  ScheduleIntervalHandle,
  WorkflowExtraConfig,
} from './Steps/ScheduleInterval.types';
import ScheduleIntervalStep from './Steps/ScheduleIntervalStep';

const AddIngestion = forwardRef<AddIngestionHandle, AddIngestionProps>(
  function AddIngestion(
    {
      activeIngestionStep,
      data,
      handleCancelClick,
      handleViewServiceClick,
      heading,
      hideFooter = false,
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
      onStepReadyChange,
    }: Readonly<AddIngestionProps>,
    ref
  ) {
    const workflowFormRef = useRef<IngestionWorkflowFormHandle>(null);
    const scheduleIntervalRef = useRef<ScheduleIntervalHandle>(null);
    const { t } = useTranslation();
    const { ingestionFQN } = useFqn();
    const { currentUser } = useApplicationStore();
    const { config: limitConfig } = useLimitStore();

    const isEditMode = !isEmpty(ingestionFQN);

    const { canEditOwners } = useEntityPermissions(
      ResourceEntity.INGESTION_PIPELINE,
      ingestionFQN,
      { enabled: isEditMode }
    );

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

    const translatedSteps = useMemo(
      () =>
        STEPS_FOR_ADD_INGESTION.map((step) => ({
          ...step,
          name: translateWithNestedKeys(step.name, step.nameData),
        })),
      []
    );

    // lazy initialization to initialize the data only once
    const [workflowData, setWorkflowData] = useState<IngestionWorkflowData>(
      () => ({
        ...(data?.sourceConfig.config ?? {}),
        ...filterProperties,
        name: data?.name ?? generateUUID(),
        displayName:
          data?.displayName ?? getIngestionName(serviceData.name, pipelineType),
        enableDebugLog: data?.loggerLevel === LogLevels.Debug,
        raiseOnError: data?.raiseOnError ?? true,
        rootProcessingEngine: data?.processingEngine,
      })
    );

    // Owners is a pipeline-entity field, not a sourceConfig one, so it is held
    // outside `workflowData` — everything left in there is funnelled into
    // `sourceConfig.config` by `cleanWorkFlowData`.
    // Safe to seed lazily: both pages gate rendering on their own `isLoading`,
    // so this never mounts before `data`/`serviceData` have resolved.
    const [owners, setOwners] = useState<EntityReference[]>(() => {
      // Prefer what is saved, then the service's owners, then the current user.
      // Edit has to fall back too, not just create: pipelines created through
      // the API carry no owners, and a mandatory field starting empty would
      // make those impossible to save at all.
      const savedOwners = data?.owners ?? [];

      if (!isEmpty(savedOwners)) {
        return savedOwners;
      }

      const serviceOwners = serviceData?.owners ?? [];

      if (!isEmpty(serviceOwners)) {
        return serviceOwners;
      }

      return currentUser ? [{ id: currentUser.id, type: 'user' }] : [];
    });
    const [isOwnersInvalid, setIsOwnersInvalid] = useState(false);

    const handleOwnersChange = useCallback((updated?: EntityReference[]) => {
      setOwners(updated ?? []);
      setIsOwnersInvalid(false);
    }, []);

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

    const { canEditPipelineOwners, effectiveOwners, isOwnersRequired } =
      useMemo(() => {
        // Only the edit flow needs EditOwners: it saves through a JSON patch and
        // the server authorizes an `/owners` op as EditOwners. Create carries
        // owners in the POST body, which the Create permission already covers.
        const canEdit = !isEditMode || canEditOwners;

        return {
          canEditPipelineOwners: canEdit,
          // Without EditOwners the field is read-only, so it shows what is
          // saved — the seeded service/current-user fallback would otherwise
          // misreport an ownerless pipeline as owned by someone the user never
          // chose.
          effectiveOwners: canEdit ? owners : data?.owners ?? [],
          // Settings pipelines (Data Insight / Search Index) have no parent
          // service to inherit owners from, so requiring owners there would
          // block those flows. A user who cannot edit owners cannot satisfy the
          // gate either, so it is lifted for them rather than making the agent
          // impossible to save.
          isOwnersRequired: !isSettingsPipeline && canEdit,
        };
      }, [isEditMode, canEditOwners, isSettingsPipeline, owners, data]);

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
    const [isWorkflowFormReady, setIsWorkflowFormReady] = useState(false);

    const handleWorkflowFormReady = useCallback(
      () => setIsWorkflowFormReady(true),
      []
    );

    // Step 1's RJSF form loads its templates lazily, so its imperative submit()
    // is a no-op until it mounts. Only step 1 has to wait for that signal.
    useEffect(() => {
      onStepReadyChange?.(
        activeIngestionStep === 1 ? isWorkflowFormReady : true
      );
    }, [activeIngestionStep, isWorkflowFormReady, onStepReadyChange]);

    const handleDataChange = (data: IngestionWorkflowData) =>
      setWorkflowData(data);

    const handleNext = (step: number) => {
      setActiveIngestionStep(step);
    };

    const handlePrev = (step: number) => {
      setActiveIngestionStep(step);
    };

    const handleSubmit = (data: IngestionWorkflowData) => {
      // The RJSF form validates only its own schema, and the name card sits
      // outside it, so the owners gate has to run here.
      if (isOwnersRequired && isEmpty(effectiveOwners)) {
        setIsOwnersInvalid(true);

        return;
      }

      setWorkflowData((prev) => ({ ...data, displayName: prev?.displayName }));
      handleNext(2);
    };

    const createNewIngestion = (
      extraData: WorkflowExtraConfig & IngestionExtraConfig
    ) => {
      const {
        name = '',
        enableDebugLog,
        displayName,
        raiseOnError: _raiseOnError,
        rootProcessingEngine,
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
        owners: effectiveOwners,
        pipelineType: pipelineType,
        service: {
          id: serviceData.id as string,
          type: serviceCategory.slice(0, -1),
        },
        sourceConfig: {
          // clean the data to remove empty fields
          config: { ...cleanWorkFlowData(rest) },
        },
        processingEngine: rootProcessingEngine,
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
          // Omitted rather than echoed back when the user cannot edit owners:
          // `compare` against the saved pipeline must not emit an `/owners` op
          // at all, since the server authorizes one as EditOwners and 403s.
          ...(canEditPipelineOwners ? { owners } : {}),
          loggerLevel: workflowData?.enableDebugLog
            ? LogLevels.Debug
            : LogLevels.Info,
          processingEngine: workflowData?.rootProcessingEngine,
          sourceConfig: {
            config: {
              // clean the data to remove empty fields
              ...cleanWorkFlowData(
                omit(workflowData, [
                  'name',
                  'enableDebugLog',
                  'displayName',
                  'raiseOnError',
                  'rootProcessingEngine',
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

    // Exposes submit to the parent card footer, dispatching to the active step's form when hideFooter is true.
    useImperativeHandle(
      ref,
      () => ({
        submit: () => {
          if (activeIngestionStep === 1) {
            workflowFormRef.current?.submit();
          } else if (activeIngestionStep === 2) {
            scheduleIntervalRef.current?.submit();
          }
        },
      }),
      [activeIngestionStep]
    );

    return (
      <div data-testid="add-ingestion-container">
        <Typography className="tw:m-0" size="text-xl" weight="semibold">
          {heading}
        </Typography>

        <ServiceFlowStepper
          activeStep={activeIngestionStep}
          className="tw:mt-6"
          steps={translatedSteps}
        />

        <div className="p-t-lg">
          {activeIngestionStep === 1 && (
            <div className="tw:flex tw:flex-col tw:gap-4">
              <IngestionNameCard
                displayName={workflowData?.displayName ?? ''}
                onDisplayNameChange={(value) =>
                  handleDataChange({ ...workflowData, displayName: value })
                }
                onFocus={onFocus}>
                <IngestionOwnersField
                  canEdit={canEditPipelineOwners}
                  isInvalid={isOwnersInvalid}
                  isRequired={isOwnersRequired}
                  owners={effectiveOwners}
                  onChange={handleOwnersChange}
                />
              </IngestionNameCard>
              <IngestionWorkflowForm
                hideFooter={hideFooter}
                okText={t('label.next')}
                pipeLineType={pipelineType}
                ref={workflowFormRef}
                serviceCategory={serviceCategory}
                serviceData={serviceData}
                workflowData={workflowData}
                onCancel={handleCancelClick}
                onChange={handleDataChange}
                onFocus={onFocus}
                onReady={handleWorkflowFormReady}
                onSubmit={handleSubmit}
              />
            </div>
          )}

          {activeIngestionStep === 2 && (
            <ScheduleIntervalStep
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
                retries,
              }}
              isEditMode={isEditMode}
              ref={scheduleIntervalRef}
              showActionButtons={!hideFooter}
              status={saveState}
              onBack={() => handlePrev(1)}
              onDeploy={handleScheduleIntervalDeployClick}
              onFocus={onFocus}
            />
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
  }
);

AddIngestion.displayName = 'AddIngestion';

export default AddIngestion;
