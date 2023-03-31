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
import { ReactComponent as SuccessIcon } from 'assets/svg/success-badge.svg';
import { Transi18next } from 'utils/CommonUtils';
import { TestConnectionProps, TestStatus } from './TestConnection.interface';
import TestConnectionModal from './TestConnectionModal/TestConnectionModal';

import {
  FETCHING_EXPIRY_TIME,
  FETCH_INTERVAL,
  WORKFLOW_COMPLETE_STATUS,
} from 'constants/Services.constant';
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

  const initialMessage = t(
    'message.test-your-connection-before-creating-service'
  );

  const successMessage = t('message.connection-test-successful');

  const failureMessage = t('message.connection-test-failed');

  const testingMessage = t(
    'message.testing-your-connection-may-take-two-minutes'
  );

  const infoMessage = t('message.test-connection-taking-too-long');

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
    isTestingConnection || isTestingDisabled || !allowTestConn;

  // data fetch handlers

  const fetchConnectionDefinition = async () => {
    try {
      const response = await getTestConnectionDefinitionByName(connectionType);

      setTestConnectionStep(response.steps);
    } catch (error) {
      // we will not throw error for this API
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

      setDialogOpen(true);

      // create the workflow
      const response = await addWorkflow(createWorkflowData);

      // trigger the workflow
      const status = await triggerWorkflowById(response.id);

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
          const workflowResponse = await getWorkflowData(response.id);
          const { response: testConnectionResponse } = workflowResponse;
          const { status: testConnectionStatus } = testConnectionResponse || {};

          const isWorkflowCompleted = WORKFLOW_COMPLETE_STATUS.includes(
            workflowResponse.status as WorkflowStatus
          );

          const isTestConnectionSuccess =
            testConnectionStatus === StatusType.Successful;

          if (!isWorkflowCompleted) {
            return;
          }

          if (isTestConnectionSuccess) {
            setTestStatus(StatusType.Successful);
            setMessage(successMessage);
          } else {
            setTestStatus(StatusType.Failed);
            setMessage(failureMessage);
          }

          // clear the current interval
          clearInterval(intervalId);

          // set testing connection to false
          setIsTestingConnection(false);
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
      }, FETCHING_EXPIRY_TIME);
    } catch (error) {
      clearInterval(intervalId);
      setIsTestingConnection(false);
      setMessage(failureMessage);
      setTestStatus(StatusType.Failed);
    }
  };

  useEffect(() => {
    currentWorkflowRef.current = currentWorkflow; // update ref with latest value of currentWorkflow state variable
  }, [currentWorkflow]);

  // rendering

  return (
    <>
      {showDetails ? (
        <div className="flex justify-between bg-white border border-main shadow-base rounded-4 p-sm mt-4">
          <Space data-testid="message-container" size={8}>
            {isTestingConnection && <Loader size="small" />}
            {testStatus === StatusType.Successful && (
              <SuccessIcon data-testid="success-badge" height={24} width={24} />
            )}
            {testStatus === StatusType.Failed && (
              <FailIcon data-testid="fail-badge" height={24} width={24} />
            )}
            <Space wrap data-testid="messag-text" size={2}>
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
            </Space>
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
        </div>
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
        testConnectionStep={testConnectionStep}
        testConnectionStepResult={testConnectionStepResult}
        onCancel={() => setDialogOpen(false)}
        onConfirm={() => setDialogOpen(false)}
      />
    </>
  );
};

export default TestConnection;
