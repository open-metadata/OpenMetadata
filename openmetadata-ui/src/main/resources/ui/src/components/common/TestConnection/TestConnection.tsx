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
import Loader from 'components/Loader/Loader';
import { CreateWorkflow } from 'generated/api/automations/createWorkflow';
import { ConfigClass } from 'generated/entity/automations/testServiceConnection';
import {
  StatusType,
  TestConnectionStepResult,
  Workflow,
  WorkflowStatus,
  WorkflowType,
} from 'generated/entity/automations/workflow';
import { TestConnectionStep } from 'generated/entity/services/connections/testConnectionDefinition';
import { toNumber } from 'lodash';
import React, { FC, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addWorkflow,
  deleteWorkflowById,
  getTestConnectionDefinitionByName,
  getWorkflowById,
  triggerWorkflowById,
} from 'rest/workflowAPI';
import { formatFormDataForSubmit } from 'utils/JSONSchemaFormUtils';
import {
  getServiceType,
  getTestConnectionName,
  shouldTestConnection,
} from 'utils/ServiceUtils';

import { ReactComponent as FailIcon } from 'assets/svg/fail-badge.svg';
import { ReactComponent as WarningIcon } from 'assets/svg/ic-warning.svg';
import { ReactComponent as SuccessIcon } from 'assets/svg/success-badge.svg';
import { Transi18next } from 'utils/CommonUtils';
import { TestConnectionProps, TestStatus } from './TestConnection.interface';
import TestConnectionModal from './TestConnectionModal/TestConnectionModal';

import {
  FETCHING_EXPIRY_TIME,
  FETCH_INTERVAL,
  WORKFLOW_COMPLETE_STATUS,
} from 'constants/Services.constant';
import { useAirflowStatus } from 'hooks/useAirflowStatus';
import { showErrorToast } from 'utils/ToastUtils';
import './test-connection.style.less';

const TestConnection: FC<TestConnectionProps> = ({
  isTestingDisabled,
  formData,
  serviceCategory,
  connectionType,
  serviceName,
  showDetails = true,
}) => {
  const { t } = useTranslation();
  const { isAirflowAvailable } = useAirflowStatus();

  const initialMessage = t(
    'message.test-your-connection-before-creating-service'
  );

  const successMessage = t('message.connection-test-successful');

  const failureMessage = t('message.connection-test-failed');

  const testingMessage = t(
    'message.testing-your-connection-may-take-two-minutes'
  );

  const infoMessage = t('message.test-connection-taking-too-long');

  const warningMessage = t('message.connection-test-warning');

  // local state
  const [isTestingConnection, setIsTestingConnection] =
    useState<boolean>(false);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);

  const [message, setMessage] = useState<string>(initialMessage);

  const [testConnectionStep, setTestConnectionStep] = useState<
    TestConnectionStep[]
  >([]);

  const [testConnectionStepResult, setTestConnectionStepResult] = useState<
    TestConnectionStepResult[]
  >([]);

  const [currentWorkflow, setCurrentWorkflow] = useState<Workflow>();
  const [testStatus, setTestStatus] = useState<TestStatus>();

  const [progress, setProgress] = useState<number>(0);

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
      const response = await getTestConnectionDefinitionByName(connectionType);

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
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    try {
      const response = await deleteWorkflowById(workflowId, true);
      setCurrentWorkflow(response);
    } catch (error) {
      // do not throw error for this API
    }
  };

  // handlers
  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setMessage(testingMessage);
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

      setProgress(10);

      // create the workflow
      const response = await addWorkflow(createWorkflowData);

      setProgress(20);

      // trigger the workflow
      const status = await triggerWorkflowById(response.id);

      setProgress(40);

      if (status !== 200) {
        setTestStatus(StatusType.Failed);
        setMessage(failureMessage);
        setIsTestingConnection(false);

        return;
      }

      /**
       * fetch workflow repeatedly with 2s interval
       * until status is either Failed or Successful
       */
      intervalId = toNumber(
        setInterval(async () => {
          setProgress((prev) => prev + 1);
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

          setProgress(90);
          if (isTestConnectionSuccess) {
            setTestStatus(StatusType.Successful);
            setMessage(successMessage);
          } else {
            const isMandatoryStepsFailing = steps.some(
              (step) => step.mandatory && !step.passed
            );
            setTestStatus(
              isMandatoryStepsFailing ? StatusType.Failed : 'Warning'
            );
            setMessage(
              isMandatoryStepsFailing ? failureMessage : warningMessage
            );
          }

          // clear the current interval
          clearInterval(intervalId);

          // set testing connection to false
          setIsTestingConnection(false);

          // delete the workflow once it's finished
          await handleDeleteWorkflow(workflowResponse.id);
          setProgress(100);
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
          setMessage(infoMessage);
        }

        setIsTestingConnection(false);
        setProgress(100);
      }, FETCHING_EXPIRY_TIME);
    } catch (error) {
      setProgress(100);
      clearInterval(intervalId);
      setIsTestingConnection(false);
      setMessage(failureMessage);
      setTestStatus(StatusType.Failed);
      showErrorToast(error as AxiosError);
    }
  };

  useEffect(() => {
    currentWorkflowRef.current = currentWorkflow; // update ref with latest value of currentWorkflow state variable
  }, [currentWorkflow]);

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
              {message}{' '}
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
        isOpen={dialogOpen}
        isTestingConnection={isTestingConnection}
        progress={progress}
        testConnectionStep={testConnectionStep}
        testConnectionStepResult={testConnectionStepResult}
        onCancel={() => setDialogOpen(false)}
        onConfirm={() => setDialogOpen(false)}
      />
    </>
  );
};

export default TestConnection;
