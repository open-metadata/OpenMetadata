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
import { isEmpty, toNumber } from 'lodash';
import React, { FC, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Loader from '../../../components/Loader/Loader';
import { CreateWorkflow } from '../../../generated/api/automations/createWorkflow';
import { ConfigClass } from '../../../generated/entity/automations/testServiceConnection';
import {
  StatusType,
  TestConnectionStepResult,
  Workflow,
  WorkflowStatus,
  WorkflowType,
} from '../../../generated/entity/automations/workflow';
import { TestConnectionStep } from '../../../generated/entity/services/connections/testConnectionDefinition';
import {
  addWorkflow,
  deleteWorkflowById,
  getTestConnectionDefinitionByName,
  getWorkflowById,
  triggerWorkflowById,
} from '../../../rest/workflowAPI';
import { formatFormDataForSubmit } from '../../../utils/JSONSchemaFormUtils';
import {
  getServiceType,
  getTestConnectionName,
  shouldTestConnection,
} from '../../../utils/ServiceUtils';

import { ReactComponent as FailIcon } from '../../../assets/svg/fail-badge.svg';
import { ReactComponent as WarningIcon } from '../../../assets/svg/ic-warning.svg';
import { ReactComponent as SuccessIcon } from '../../../assets/svg/success-badge.svg';
import { Transi18next } from '../../../utils/CommonUtils';
import { TestConnectionProps, TestStatus } from './TestConnection.interface';
import TestConnectionModal from './TestConnectionModal/TestConnectionModal';

import { AIRFLOW_DOCS } from '../../../constants/docs.constants';
import {
  FETCHING_EXPIRY_TIME,
  FETCH_INTERVAL,
  TEST_CONNECTION_FAILURE_MESSAGE,
  TEST_CONNECTION_INFO_MESSAGE,
  TEST_CONNECTION_INITIAL_MESSAGE,
  TEST_CONNECTION_PROGRESS_PERCENTAGE,
  TEST_CONNECTION_SUCCESS_MESSAGE,
  TEST_CONNECTION_TESTING_MESSAGE,
  TEST_CONNECTION_WARNING_MESSAGE,
  WORKFLOW_COMPLETE_STATUS,
} from '../../../constants/Services.constant';
import { useAirflowStatus } from '../../../hooks/useAirflowStatus';
import { showErrorToast } from '../../../utils/ToastUtils';
import './test-connection.style.less';

const TestConnection: FC<TestConnectionProps> = ({
  isTestingDisabled,
  formData,
  serviceCategory,
  connectionType,
  serviceName,
  onValidateFormRequiredFields,
  shouldValidateForm = true,
  showDetails = true,
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

  // derived variables
  const updatedFormData = useMemo(() => {
    return formatFormDataForSubmit(formData);
  }, [formData]);

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
    } catch (error) {
      throw t('message.test-connection-cannot-be-triggered');
    }
  };

  const getWorkflowData = async (workflowId: string) => {
    try {
      const response = await getWorkflowById(workflowId);
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
    setProgress(0);
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    if (isEmpty(workflowId)) {
      return;
    }

    try {
      await deleteWorkflowById(workflowId, true);
    } catch (error) {
      // do not throw error for this API
    }
  };

  // handlers
  const testConnection = async () => {
    setIsTestingConnection(true);
    setMessage(TEST_CONNECTION_TESTING_MESSAGE);
    handleResetState();

    // current interval id
    let intervalId: number | undefined;

    try {
      const createWorkflowData: CreateWorkflow = {
        name: getTestConnectionName(connectionType),
        workflowType: WorkflowType.TestConnection,
        request: {
          connection: { config: updatedFormData as ConfigClass },
          serviceType,
          connectionType,
          serviceName,
        },
      };

      // fetch the connection steps for current connectionType
      await fetchConnectionDefinition();

      setProgress(TEST_CONNECTION_PROGRESS_PERCENTAGE.TEN);

      // create the workflow
      const response = await addWorkflow(createWorkflowData);

      setProgress(TEST_CONNECTION_PROGRESS_PERCENTAGE.TWENTY);

      // trigger the workflow
      const status = await triggerWorkflowById(response.id);

      setProgress(TEST_CONNECTION_PROGRESS_PERCENTAGE.FORTY);

      if (status !== 200) {
        setTestStatus(StatusType.Failed);
        setMessage(TEST_CONNECTION_FAILURE_MESSAGE);
        setIsTestingConnection(false);

        // delete the workflow if workflow is not triggered successfully
        await handleDeleteWorkflow(response.id);

        return;
      }

      /**
       * fetch workflow repeatedly with 2s interval
       * until status is either Failed or Successful
       */
      intervalId = toNumber(
        setInterval(async () => {
          setProgress((prev) => prev + TEST_CONNECTION_PROGRESS_PERCENTAGE.ONE);
          const workflowResponse = await getWorkflowData(response.id);
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

          setProgress(TEST_CONNECTION_PROGRESS_PERCENTAGE.HUNDRED);
          if (isTestConnectionSuccess) {
            setTestStatus(StatusType.Successful);
            setMessage(TEST_CONNECTION_SUCCESS_MESSAGE);
          } else {
            const isMandatoryStepsFailing = steps.some(
              (step) => step.mandatory && !step.passed
            );
            setTestStatus(
              isMandatoryStepsFailing ? StatusType.Failed : 'Warning'
            );
            setMessage(
              isMandatoryStepsFailing
                ? TEST_CONNECTION_FAILURE_MESSAGE
                : TEST_CONNECTION_WARNING_MESSAGE
            );
          }

          // clear the current interval
          clearInterval(intervalId);

          // set testing connection to false
          setIsTestingConnection(false);

          // delete the workflow once it's finished
          await handleDeleteWorkflow(workflowResponse.id);
        }, FETCH_INTERVAL)
      );

      // stop fetching the workflow after 2 minutes
      setTimeout(() => {
        // clear the current interval
        clearInterval(intervalId);

        // using reference to ensure call back should have latest value
        const currentWorkflowStatus = currentWorkflowRef.current
          ?.status as WorkflowStatus;

        const isWorkflowCompleted = WORKFLOW_COMPLETE_STATUS.includes(
          currentWorkflowStatus
        );

        if (!isWorkflowCompleted) {
          setMessage(TEST_CONNECTION_INFO_MESSAGE);
          setIsConnectionTimeout(true);
        }

        setIsTestingConnection(false);
        setProgress(TEST_CONNECTION_PROGRESS_PERCENTAGE.HUNDRED);
      }, FETCHING_EXPIRY_TIME);
    } catch (error) {
      setProgress(TEST_CONNECTION_PROGRESS_PERCENTAGE.HUNDRED);
      clearInterval(intervalId);
      setIsTestingConnection(false);
      setMessage(TEST_CONNECTION_FAILURE_MESSAGE);
      setTestStatus(StatusType.Failed);
      showErrorToast(error as AxiosError);

      // delete the workflow if there is an exception
      const workflowId = currentWorkflowRef.current?.id;
      if (workflowId) {
        await handleDeleteWorkflow(workflowId);
      }
    }
  };

  const handleTestConnection = () => {
    if (shouldValidateForm) {
      const isFormValid =
        onValidateFormRequiredFields && onValidateFormRequiredFields();
      if (isFormValid) {
        testConnection();
      }
    } else {
      testConnection();
    }
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
            className="text-primary"
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
        isConnectionTimeout={isConnectionTimeout}
        isOpen={dialogOpen}
        isTestingConnection={isTestingConnection}
        progress={progress}
        testConnectionStep={testConnectionStep}
        testConnectionStepResult={testConnectionStepResult}
        onCancel={() => setDialogOpen(false)}
        onConfirm={() => setDialogOpen(false)}
        onTestConnection={handleTestConnection}
      />
    </>
  );
};

export default TestConnection;
