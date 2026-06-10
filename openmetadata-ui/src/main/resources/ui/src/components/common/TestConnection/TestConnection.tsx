/*
 *  Copyright 2023 Collate.
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
import { Button, Tooltip } from '@openmetadata/ui-core-components';
import { AlertTriangle, CheckCircle, XCircle, Zap } from '@untitledui/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty, toNumber } from 'lodash';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AIRFLOW_DOCS } from '../../../constants/docs.constants';
import {
  FETCHING_EXPIRY_TIME,
  FETCH_INTERVAL,
  TEST_CONNECTION_FAILURE_MESSAGE,
  TEST_CONNECTION_INITIAL_MESSAGE,
  TEST_CONNECTION_PROGRESS_PERCENTAGE,
  TEST_CONNECTION_SUCCESS_MESSAGE,
  TEST_CONNECTION_TESTING_MESSAGE,
  TEST_CONNECTION_WARNING_MESSAGE,
  WORKFLOW_COMPLETE_STATUS,
} from '../../../constants/Services.constant';
import { useAirflowStatus } from '../../../context/AirflowStatusProvider/AirflowStatusProvider';
import { CreateWorkflow } from '../../../generated/api/automations/createWorkflow';
import { ConfigObject } from '../../../generated/entity/automations/testServiceConnection';
import {
  StatusType,
  TestConnectionStepResult,
  Workflow,
  WorkflowStatus,
  WorkflowType,
} from '../../../generated/entity/automations/workflow';
import { TestConnectionStep } from '../../../generated/entity/services/connections/testConnectionDefinition';
import useAbortController from '../../../hooks/AbortController/useAbortController';
import {
  addWorkflow,
  deleteWorkflowById,
  getTestConnectionDefinitionByName,
  getWorkflowById,
  triggerWorkflowById,
} from '../../../rest/workflowAPI';
import { Transi18next } from '../../../utils/i18next/LocalUtil';
import { formatFormDataForSubmit } from '../../../utils/JSONSchemaFormUtils';
import { getSnowflakeAccountDisplayHost } from '../../../utils/ServiceConnectionUtils';
import {
  getServiceType,
  getTestConnectionName,
  shouldTestConnection,
} from '../../../utils/ServiceUtils';
import { getErrorText } from '../../../utils/StringUtils';
import Loader from '../Loader/Loader';
import { TestConnectionProps, TestStatus } from './TestConnection.interface';
import TestConnectionModal from './TestConnectionModal/TestConnectionModal';

const getAreRequiredStepsPassing = (
  resultSteps: TestConnectionStepResult[],
  definitionSteps: TestConnectionStep[]
) => {
  const requiredDefinitionSteps = definitionSteps.filter(
    (step) => step.mandatory
  );

  if (requiredDefinitionSteps.length > 0) {
    const resultByName = new Map(
      resultSteps.map((result) => [result.name, result])
    );

    return requiredDefinitionSteps.every(
      (step) => resultByName.get(step.name)?.passed
    );
  }

  return (
    resultSteps.length > 0 &&
    !resultSteps.some((step) => step.mandatory && !step.passed)
  );
};

const getHasOptionalStepsFailing = (
  resultSteps: TestConnectionStepResult[],
  definitionSteps: TestConnectionStep[]
) => {
  const optionalDefinitionSteps = definitionSteps.filter(
    (step) => !step.mandatory
  );

  if (optionalDefinitionSteps.length > 0) {
    const resultByName = new Map(
      resultSteps.map((result) => [result.name, result])
    );

    return optionalDefinitionSteps.some(
      (step) => resultByName.get(step.name)?.passed === false
    );
  }

  return resultSteps.some((step) => !step.mandatory && !step.passed);
};

const TestConnection: FC<TestConnectionProps> = ({
  isTestingDisabled,
  getData,
  serviceCategory,
  connectionType,
  serviceName,
  onValidateFormRequiredFields,
  onTestConnectionStatusChange,
  shouldValidateForm = true,
  showDetails = true,
  missingRequiredFieldsCount = 0,
  hostIp,
  extraInfo,
}) => {
  const { t } = useTranslation();
  const { isAirflowAvailable } = useAirflowStatus();

  // local state
  const [isTestingConnection, setIsTestingConnection] =
    useState<boolean>(false);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);

  const [message, setMessage] = useState<string>(
    t(TEST_CONNECTION_INITIAL_MESSAGE)
  );

  const [errorMessage, setErrorMessage] = useState<{
    description?: string;
    subDescription?: string;
  }>();

  const [testConnectionStep, setTestConnectionStep] = useState<
    TestConnectionStep[]
  >([]);

  const [testConnectionStepResult, setTestConnectionStepResult] = useState<
    TestConnectionStepResult[]
  >([]);

  const [currentWorkflow, setCurrentWorkflow] = useState<Workflow>();
  const [testStatus, setTestStatus] = useState<TestStatus>();

  const [progress, setProgress] = useState<number>(
    TEST_CONNECTION_PROGRESS_PERCENTAGE.ZERO
  );

  const [isConnectionTimeout, setIsConnectionTimeout] =
    useState<boolean>(false);

  /**
   * Current workflow reference
   */
  const currentWorkflowRef = useRef(currentWorkflow);

  const { controller } = useAbortController();

  const serviceType = useMemo(() => {
    return getServiceType(serviceCategory);
  }, [serviceCategory]);

  const allowTestConn = useMemo(() => {
    return shouldTestConnection(connectionType);
  }, [connectionType]);

  const isTestConnectionDisabled =
    isTestingConnection ||
    isTestingDisabled ||
    !allowTestConn ||
    !isAirflowAvailable;

  const isReadyToTestCard =
    !isTestConnectionDisabled &&
    !testStatus &&
    missingRequiredFieldsCount === 0;

  const connectionDisplayName = (() => {
    const formData = getData();
    const connectionData = (formData ?? {}) as Record<string, unknown>;
    const account = connectionData.account;

    if (
      connectionType === 'Snowflake' &&
      typeof account === 'string' &&
      account.trim()
    ) {
      return getSnowflakeAccountDisplayHost(account);
    }

    const displayFields = [
      'hostPort',
      'host',
      'hostname',
      'server',
      'endpointURL',
      'brokerEndpoint',
      'database',
      'projectId',
      'account',
    ];

    for (const field of displayFields) {
      const value = connectionData[field];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return serviceName || connectionType;
  })();

  // data fetch handlers

  const fetchConnectionDefinition = async () => {
    try {
      // Test Connection FQN is built as <connectionType>.testConnectionDefinition. E.g., Mysql.testConnectionDefinition
      const response = await getTestConnectionDefinitionByName(
        `${connectionType}.testConnectionDefinition`
      );
      const steps = response.steps ?? [];

      setTestConnectionStep(steps);
      setDialogOpen(true);

      return steps;
    } catch {
      throw t('message.test-connection-cannot-be-triggered');
    }
  };

  const getWorkflowData = async (
    workflowId: string,
    apiCancelSignal: AbortSignal
  ) => {
    try {
      const response = await getWorkflowById(workflowId, apiCancelSignal);
      const testConnectionStepResult = response.response?.steps ?? [];

      setTestConnectionStepResult(testConnectionStepResult);

      setCurrentWorkflow(response);

      return response;
    } catch (error) {
      throw error as AxiosError;
    }
  };

  const handleResetState = () => {
    // reset states for workflow ans steps result
    setCurrentWorkflow(undefined);
    setTestConnectionStepResult([]);
    setTestStatus(undefined);
    setIsConnectionTimeout(false);
    setProgress(TEST_CONNECTION_PROGRESS_PERCENTAGE.ZERO);
    onTestConnectionStatusChange?.(false);
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    if (isEmpty(workflowId)) {
      return;
    }

    try {
      await deleteWorkflowById(workflowId, true);
      setCurrentWorkflow(undefined);
    } catch {
      // do not throw error for this API
    }
  };

  const handleCompletionStatus = async (
    isWorkflowSuccessful: boolean,
    steps: TestConnectionStepResult[],
    definitionSteps: TestConnectionStep[]
  ) => {
    setProgress(TEST_CONNECTION_PROGRESS_PERCENTAGE.HUNDRED);
    const areRequiredStepsPassing = getAreRequiredStepsPassing(
      steps,
      definitionSteps
    );
    const hasOptionalStepsFailing = getHasOptionalStepsFailing(
      steps,
      definitionSteps
    );

    if (
      areRequiredStepsPassing &&
      isWorkflowSuccessful &&
      !hasOptionalStepsFailing
    ) {
      setTestStatus(StatusType.Successful);
      setMessage(t(TEST_CONNECTION_SUCCESS_MESSAGE));
      onTestConnectionStatusChange?.(true);
    } else if (areRequiredStepsPassing) {
      setTestStatus('Warning');
      setMessage(t(TEST_CONNECTION_WARNING_MESSAGE));
      onTestConnectionStatusChange?.(true);
    } else {
      setTestStatus(StatusType.Failed);
      setMessage(t(TEST_CONNECTION_FAILURE_MESSAGE));
      onTestConnectionStatusChange?.(false);
    }
  };
  const updateProgress = useCallback(
    (prev: number) => prev + TEST_CONNECTION_PROGRESS_PERCENTAGE.ONE,
    []
  );

  const handleWorkflowPolling = async (
    response: Workflow,
    definitionSteps: TestConnectionStep[],
    intervalObject: {
      intervalId?: number;
      timeoutId?: number;
    }
  ) => {
    // return a promise that wraps the interval and handles errors inside it
    return new Promise<void>((resolve, reject) => {
      /**
       * fetch workflow repeatedly with 2s interval
       * until status is either Failed or Successful
       */
      intervalObject.intervalId = toNumber(
        setInterval(async () => {
          setProgress(updateProgress);
          try {
            const workflowResponse = await getWorkflowData(
              response.id,
              controller.signal
            );
            const { response: testConnectionResponse } = workflowResponse;
            const { status: testConnectionStatus, steps = [] } =
              testConnectionResponse || {};

            const isWorkflowCompleted = WORKFLOW_COMPLETE_STATUS.includes(
              workflowResponse.status as WorkflowStatus
            );

            const isTestConnectionSuccess =
              testConnectionStatus === StatusType.Successful;

            if (!isWorkflowCompleted) {
              return;
            }

            // Handle completion status
            await handleCompletionStatus(
              isTestConnectionSuccess,
              steps,
              definitionSteps
            );

            // clear the current interval
            clearInterval(intervalObject.intervalId);
            clearTimeout(intervalObject.timeoutId);

            // set testing connection to false
            setIsTestingConnection(false);

            // delete the workflow once it's finished
            await handleDeleteWorkflow(workflowResponse.id);

            resolve();
          } catch (error) {
            reject(error as AxiosError);
          }
        }, FETCH_INTERVAL)
      );
    });
  };

  // handlers
  const testConnection = async () => {
    setIsTestingConnection(true);
    onTestConnectionStatusChange?.(false);
    setMessage(t(TEST_CONNECTION_TESTING_MESSAGE));
    handleResetState();

    const updatedFormData = formatFormDataForSubmit(getData());

    // current interval id
    const intervalObject: {
      intervalId?: number;
      timeoutId?: number;
    } = {};

    const { ingestionRunner, ...rest } = updatedFormData as ConfigObject & {
      ingestionRunner?: string;
    };

    try {
      const ingestionRunnerValue = extraInfo ?? ingestionRunner;

      const createWorkflowData: CreateWorkflow = {
        name: getTestConnectionName(connectionType),
        workflowType: WorkflowType.TestConnection,
        request: {
          connection: { config: rest },
          serviceType,
          connectionType,
          serviceName,
          ...(ingestionRunnerValue && {
            ingestionRunner: ingestionRunnerValue,
          }),
        },
      };

      // fetch the connection steps for current connectionType
      const definitionSteps = await fetchConnectionDefinition();

      setProgress(TEST_CONNECTION_PROGRESS_PERCENTAGE.TEN);

      // create the workflow
      const response = await addWorkflow(createWorkflowData, controller.signal);

      setCurrentWorkflow(response);

      setProgress(TEST_CONNECTION_PROGRESS_PERCENTAGE.TWENTY);

      // trigger the workflow
      const status = await triggerWorkflowById(response.id, controller.signal);

      setProgress(TEST_CONNECTION_PROGRESS_PERCENTAGE.FORTY);

      if (status !== 200) {
        setTestStatus(StatusType.Failed);
        setMessage(t(TEST_CONNECTION_FAILURE_MESSAGE));
        setIsTestingConnection(false);
        onTestConnectionStatusChange?.(false);

        // delete the workflow if workflow is not triggered successfully
        await handleDeleteWorkflow(response.id);

        return;
      }

      // stop fetching the workflow after 2 minutes
      const timeoutId = setTimeout(() => {
        // clear the current interval
        clearInterval(intervalObject.intervalId);

        // using reference to ensure call back should have latest value
        const currentWorkflowStatus = currentWorkflowRef.current
          ?.status as WorkflowStatus;

        const isWorkflowCompleted = WORKFLOW_COMPLETE_STATUS.includes(
          currentWorkflowStatus
        );

        if (!isWorkflowCompleted) {
          let message = t('message.test-connection-taking-too-long.default', {
            service_type: serviceType,
          });
          if (hostIp) {
            message += t('message.test-connection-taking-too-long.withIp', {
              ip: hostIp,
            });
          }
          setMessage(message);
          setIsConnectionTimeout(true);
        }

        setIsTestingConnection(false);
        setProgress(TEST_CONNECTION_PROGRESS_PERCENTAGE.HUNDRED);
        onTestConnectionStatusChange?.(false);
      }, FETCHING_EXPIRY_TIME);

      intervalObject.timeoutId = Number(timeoutId);

      // Handle workflow polling and completion
      await handleWorkflowPolling(response, definitionSteps, intervalObject);
    } catch (error) {
      setProgress(TEST_CONNECTION_PROGRESS_PERCENTAGE.HUNDRED);
      clearInterval(intervalObject.intervalId);
      setIsTestingConnection(false);
      setMessage(t(TEST_CONNECTION_FAILURE_MESSAGE));
      setTestStatus(StatusType.Failed);
      onTestConnectionStatusChange?.(false);
      if ((error as AxiosError)?.status === 500) {
        setErrorMessage({
          description: t('server.unexpected-response'),
        });
      } else {
        setErrorMessage({
          description: getErrorText(
            error as AxiosError,
            t('server.unexpected-error')
          ),
        });
      }

      // delete the workflow if there is an exception
      const workflowId = currentWorkflowRef.current?.id;
      if (workflowId) {
        await handleDeleteWorkflow(workflowId);
      }
    }
  };

  const handleCloseErrorMessage = () => {
    setErrorMessage(undefined);
  };

  const handleTestConnection = () => {
    if (shouldValidateForm) {
      const isFormValid = onValidateFormRequiredFields?.();
      handleCloseErrorMessage();
      if (isFormValid) {
        testConnection();
      }
    } else {
      testConnection();
    }
  };

  const handleCancelTestConnectionModal = () => {
    controller.abort();
    setDialogOpen(false);
  };

  const buttonTooltipTitle = useMemo(() => {
    let title = t('label.test-entity', { entity: t('label.connection') });

    if (!isAirflowAvailable) {
      title = t('label.platform-service-client-unavailable');
    }

    return title;
  }, [isAirflowAvailable]);

  const connectionCardTitle = useMemo(() => {
    if (!isAirflowAvailable) {
      return t('label.platform-service-client-unavailable');
    }

    if (isTestingConnection) {
      return t('message.testing-connection');
    }

    if (isReadyToTestCard) {
      return t('message.ready-to-test-connection');
    }

    if (testStatus === StatusType.Successful) {
      return t('message.test-connection-verified');
    }

    if (testStatus) {
      return message;
    }

    return t('message.test-your-connection-to-continue');
  }, [
    isAirflowAvailable,
    isReadyToTestCard,
    isTestingConnection,
    message,
    t,
    testStatus,
  ]);

  const connectionCardDescription = useMemo(() => {
    if (!isAirflowAvailable) {
      return (
        <Transi18next
          i18nKey="message.configure-airflow"
          renderElement={
            <a
              data-testid="airflow-doc-link"
              href={AIRFLOW_DOCS}
              rel="noopener noreferrer"
              target="_blank"
            />
          }
          values={{
            text: t('label.documentation-lowercase'),
          }}
        />
      );
    }

    if (isTestingConnection) {
      return t(TEST_CONNECTION_TESTING_MESSAGE);
    }

    if (testStatus === StatusType.Successful) {
      const passedCount = testConnectionStepResult.filter(
        (step) => step.passed
      ).length;

      return t('message.test-connection-ready-count', {
        count: passedCount,
      });
    }

    if (testStatus) {
      return t('message.test-connection-view-details');
    }

    if (missingRequiredFieldsCount > 0) {
      return t(
        missingRequiredFieldsCount === 1
          ? 'message.fill-one-required-field-then-test-connection'
          : 'message.fill-required-fields-then-test-connection',
        { count: missingRequiredFieldsCount }
      );
    }

    return t('message.test-connection-unlocks-next-step');
  }, [
    isAirflowAvailable,
    isTestingConnection,
    missingRequiredFieldsCount,
    t,
    testConnectionStepResult,
    testStatus,
  ]);

  const connectionButtonLabel = useMemo(() => {
    if (testStatus && !isTestingConnection) {
      return t('label.re-test-connection');
    }

    return t('label.test-entity', { entity: t('label.connection') });
  }, [isTestingConnection, t, testStatus]);

  useEffect(() => {
    currentWorkflowRef.current = currentWorkflow; // update ref with latest value of currentWorkflow state variable
  }, [currentWorkflow]);

  useEffect(() => {
    return () => {
      /**
       * if workflow is present then delete the workflow when component unmount
       */
      const workflowId = currentWorkflowRef.current?.id;
      if (workflowId) {
        handleDeleteWorkflow(workflowId);
      }
    };
  }, []);

  // rendering

  return (
    <>
      {showDetails ? (
        <div
          className={classNames(
            'tw:flex tw:w-full tw:items-center tw:justify-between tw:gap-5 tw:mt-3.5 tw:border tw:border-gray-200 tw:rounded-xl tw:bg-primary tw:p-[14px_20px]',
            {
              'tw:border-utility-success-200 tw:bg-utility-success-50':
                testStatus === StatusType.Successful,
              'tw:border-utility-error-200 tw:bg-utility-error-50':
                testStatus === StatusType.Failed,
              'tw:border-utility-warning-200 tw:bg-utility-warning-50':
                testStatus === 'Warning',
              'tw:border-utility-brand-200 tw:bg-utility-brand-50':
                isTestingConnection,
              'tw:border-utility-brand-300 tw:bg-utility-brand-50 tw:p-[22px_24px] tw:shadow-[0_0_0_6px_#e8f4ff]':
                isReadyToTestCard,
            }
          )}
          data-testid="test-connection-card">
          <div
            className="tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:gap-3"
            data-testid="message-container">
            {(isTestingConnection || testStatus || isReadyToTestCard) && (
              <div
                className={classNames(
                  'tw:flex tw:size-8 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-[10px] tw:border tw:border-utility-brand-200 tw:bg-utility-brand-50 tw:text-utility-brand-600',
                  {
                    'tw:border-utility-success-200 tw:bg-utility-success-100 tw:text-utility-success-600':
                      testStatus === StatusType.Successful,
                    'tw:border-utility-error-200 tw:bg-utility-error-50 tw:text-utility-error-600':
                      testStatus === StatusType.Failed,
                    'tw:border-utility-warning-200 tw:bg-utility-warning-50 tw:text-utility-warning-600':
                      testStatus === 'Warning',
                    'tw:size-12 tw:basis-12 tw:rounded-xl tw:border-[#c9e4ff] tw:bg-[#dbeeff] tw:text-[#2563eb]':
                      isReadyToTestCard,
                  }
                )}>
                {isTestingConnection && <Loader size="small" />}
                {isReadyToTestCard && (
                  <Zap
                    className="tw:size-[18px]"
                    data-testid="ready-badge"
                    size={20}
                  />
                )}
                {testStatus === StatusType.Successful && (
                  <CheckCircle
                    className="tw:size-[18px]"
                    data-testid="success-badge"
                    size={18}
                  />
                )}
                {testStatus === StatusType.Failed && (
                  <XCircle
                    className="tw:size-[18px]"
                    data-testid="fail-badge"
                    size={18}
                  />
                )}
                {testStatus === 'Warning' && (
                  <AlertTriangle
                    className="tw:size-[18px]"
                    data-testid="warning-badge"
                    size={18}
                  />
                )}
              </div>
            )}
            <div className="tw:min-w-0" data-testid="messag-text">
              <div
                className={classNames(
                  'tw:text-sm tw:font-medium tw:leading-6 tw:text-primary',
                  {
                    'tw:text-base tw:font-bold tw:leading-6': isReadyToTestCard,
                  }
                )}>
                {connectionCardTitle}
              </div>
              <div
                className={classNames(
                  'tw:mt-0.5 tw:flex tw:flex-wrap tw:items-center tw:gap-1.5 tw:text-sm tw:leading-[18px] tw:text-quaternary',
                  {
                    'tw:text-utility-success-700 tw:font-medium':
                      testStatus === StatusType.Successful,
                    'tw:text-utility-warning-700': testStatus === 'Warning',
                    'tw:text-utility-error-700':
                      testStatus === StatusType.Failed,
                    'tw:text-sm tw:leading-6 tw:text-[#2563eb]':
                      isReadyToTestCard,
                  }
                )}>
                {connectionCardDescription}
                {(testStatus || isTestingConnection) && (
                  <Button
                    className="p-0 [&>span]:tw:underline"
                    color="link-color"
                    data-testid="test-connection-details-btn"
                    size="sm"
                    onClick={() => setDialogOpen(true)}>
                    {t('label.view')}
                  </Button>
                )}
              </div>
            </div>
          </div>
          <Tooltip title={buttonTooltipTitle}>
            <Button
              color="primary"
              data-testid="test-connection-btn"
              isDisabled={isTestConnectionDisabled}
              isLoading={isTestingConnection}
              size="md"
              onClick={handleTestConnection}>
              {connectionButtonLabel}
            </Button>
          </Tooltip>
        </div>
      ) : (
        <Tooltip title={buttonTooltipTitle}>
          <Button
            color="primary"
            data-testid="test-connection-button"
            isDisabled={isTestConnectionDisabled}
            isLoading={isTestingConnection}
            size="sm"
            onClick={handleTestConnection}>
            {t('label.test-entity', {
              entity: t('label.connection'),
            })}
          </Button>
        </Tooltip>
      )}
      <TestConnectionModal
        connectionDisplayName={connectionDisplayName}
        connectionType={connectionType}
        errorMessage={errorMessage}
        handleCloseErrorMessage={handleCloseErrorMessage}
        hostIp={hostIp}
        isConnectionTimeout={isConnectionTimeout}
        isOpen={dialogOpen}
        isTestingConnection={isTestingConnection}
        progress={progress}
        serviceType={serviceType}
        testConnectionStep={testConnectionStep}
        testConnectionStepResult={testConnectionStepResult}
        onCancel={handleCancelTestConnectionModal}
        onConfirm={() => setDialogOpen(false)}
        onTestConnection={handleTestConnection}
      />
    </>
  );
};

export default TestConnection;
