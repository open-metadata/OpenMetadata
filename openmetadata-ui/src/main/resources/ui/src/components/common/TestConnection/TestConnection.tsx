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
import { Button, Space } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty, toNumber } from 'lodash';
import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FailIcon from '../../../assets/svg/fail-badge.svg?react';
import WarningIcon from '../../../assets/svg/ic-warning.svg?react';
import SuccessIcon from '../../../assets/svg/success-badge.svg?react';
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
import {
  StatusType,
  TestConnectionStepResult,
  Workflow,
  WorkflowStatus,
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
import { Transi18next } from '../../../utils/CommonUtils';
import { formatFormDataForSubmit } from '../../../utils/JSONSchemaFormUtils';
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import {
  getServiceType,
  shouldTestConnection,
} from '../../../utils/ServiceUtils';
import { getErrorText } from '../../../utils/StringsUtils';
import Loader from '../Loader/Loader';
import './test-connection.style.less';
import { TestConnectionProps, TestStatus } from './TestConnection.interface';
import TestConnectionModal from './TestConnectionModal/TestConnectionModal';

const TestConnection: FC<TestConnectionProps> = ({
  isTestingDisabled,
  getData,
  serviceCategory,
  connectionType,
  serviceName,
  onValidateFormRequiredFields,
  shouldValidateForm = true,
  showDetails = true,
  onTestConnection,
  hostIp,
}) => {
  const { t } = useTranslation();
  const { isAirflowAvailable } = useAirflowStatus();

  // local state
  const [isTestingConnection, setIsTestingConnection] =
    useState<boolean>(false);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);

  const [message, setMessage] = useState<string>(
    TEST_CONNECTION_INITIAL_MESSAGE
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

  // data fetch handlers

  const fetchConnectionDefinition = async () => {
    try {
      // Test Connection FQN is built as <connectionType>.testConnectionDefinition. E.g., Mysql.testConnectionDefinition
      const response = await getTestConnectionDefinitionByName(
        `${connectionType}.testConnectionDefinition`
      );

      setTestConnectionStep(response.steps);
      setDialogOpen(true);
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
    isTestConnectionSuccess: boolean,
    steps: TestConnectionStepResult[]
  ) => {
    setProgress(TEST_CONNECTION_PROGRESS_PERCENTAGE.HUNDRED);
    if (isTestConnectionSuccess) {
      setTestStatus(StatusType.Successful);
      setMessage(TEST_CONNECTION_SUCCESS_MESSAGE);
    } else {
      const isMandatoryStepsFailing = steps.some(
        (step) => step.mandatory && !step.passed
      );
      setTestStatus(isMandatoryStepsFailing ? StatusType.Failed : 'Warning');
      setMessage(
        isMandatoryStepsFailing
          ? TEST_CONNECTION_FAILURE_MESSAGE
          : TEST_CONNECTION_WARNING_MESSAGE
      );
    }
  };

  const handleWorkflowPolling = async (
    response: Workflow,
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
          setProgress((prev) => prev + TEST_CONNECTION_PROGRESS_PERCENTAGE.ONE);
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
            await handleCompletionStatus(isTestConnectionSuccess, steps);

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
    setMessage(TEST_CONNECTION_TESTING_MESSAGE);
    handleResetState();

    const updatedFormData = formatFormDataForSubmit(getData());

    // current interval id
    const intervalObject: {
      intervalId?: number;
      timeoutId?: number;
    } = {};

    try {
      const createWorkflowData: CreateWorkflow =
        serviceUtilClassBase.getAddWorkflowData(
          connectionType,
          serviceType,
          serviceName,
          updatedFormData
        );

      // fetch the connection steps for current connectionType
      await fetchConnectionDefinition();

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
        setMessage(TEST_CONNECTION_FAILURE_MESSAGE);
        setIsTestingConnection(false);

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
      }, FETCHING_EXPIRY_TIME);

      intervalObject.timeoutId = Number(timeoutId);

      // Handle workflow polling and completion
      await handleWorkflowPolling(response, intervalObject);
    } catch (error) {
      setProgress(TEST_CONNECTION_PROGRESS_PERCENTAGE.HUNDRED);
      clearInterval(intervalObject.intervalId);
      setIsTestingConnection(false);
      setMessage(TEST_CONNECTION_FAILURE_MESSAGE);
      setTestStatus(StatusType.Failed);
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
    } finally {
      onTestConnection?.();
    }
  };

  const handleCloseErrorMessage = () => {
    setErrorMessage(undefined);
  };

  const handleTestConnection = () => {
    if (shouldValidateForm) {
      const isFormValid =
        onValidateFormRequiredFields && onValidateFormRequiredFields();
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
        <Space className="w-full justify-between bg-white border border-main rounded-4 p-sm mt-4">
          <Space
            align={testStatus ? 'start' : 'center'}
            data-testid="message-container"
            size={8}>
            {isTestingConnection && <Loader size="small" />}
            {testStatus === StatusType.Successful && (
              <SuccessIcon
                className="status-icon"
                data-testid="success-badge"
              />
            )}
            {testStatus === StatusType.Failed && (
              <FailIcon className="status-icon" data-testid="fail-badge" />
            )}
            {testStatus === 'Warning' && (
              <WarningIcon
                className="status-icon"
                data-testid="warning-badge"
              />
            )}
            <div data-testid="messag-text">
              {isAirflowAvailable ? (
                message
              ) : (
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
              )}{' '}
              {(testStatus || isTestingConnection) && (
                <Transi18next
                  i18nKey="message.click-text-to-view-details"
                  renderElement={
                    <Button
                      className="p-0 test-connection-message-btn"
                      data-testid="test-connection-details-btn"
                      type="link"
                      onClick={() => setDialogOpen(true)}
                    />
                  }
                  values={{
                    text: t('label.here-lowercase'),
                  }}
                />
              )}
            </div>
          </Space>
          <Button
            className={classNames({
              'text-primary': !isTestConnectionDisabled,
            })}
            data-testid="test-connection-btn"
            disabled={isTestConnectionDisabled}
            loading={isTestingConnection}
            size="middle"
            type="default"
            onClick={handleTestConnection}>
            {t('label.test-entity', { entity: t('label.connection') })}
          </Button>
        </Space>
      ) : (
        <Button
          data-testid="test-connection-button"
          disabled={isTestConnectionDisabled}
          loading={isTestingConnection}
          type="primary"
          onClick={handleTestConnection}>
          {t('label.test-entity', {
            entity: t('label.connection'),
          })}
        </Button>
      )}
      <TestConnectionModal
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
