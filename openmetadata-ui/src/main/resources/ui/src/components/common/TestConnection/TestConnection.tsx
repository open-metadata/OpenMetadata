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
import cryptoRandomString from 'crypto-random-string-with-promisify-polyfill';
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
import { toLower, toNumber } from 'lodash';
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
  getTestConnectionType,
  shouldTestConnection,
} from 'utils/ServiceUtils';
import {
  showErrorToast,
  showInfoToast,
  showSuccessToast,
} from 'utils/ToastUtils';

import { ReactComponent as FailIcon } from 'assets/svg/fail-badge.svg';
import { ReactComponent as SuccessIcon } from 'assets/svg/success-badge.svg';
import { Transi18next } from 'utils/CommonUtils';
import { TestConnectionProps, TestStatus } from './TestConnection.interface';
import TestConnectionModal from './TestConnectionModal/TestConnectionModal';

import './test-connection.style.less';

// 2 minutes
const FETCHING_EXPIRY_TIME = 2 * 60 * 1000;
const FETCH_INTERVAL = 2000;
const WORKFLOW_COMPLETE_STATUS = [
  WorkflowStatus.Failed,
  WorkflowStatus.Successful,
];

const TestConnection: FC<TestConnectionProps> = ({
  isTestingDisabled,
  formData,
  serviceCategory,
  connectionType,
  displayButtonOnly = false,
}) => {
  const { t } = useTranslation();

  // local state
  const [isTestingConnection, setIsTestingConnection] =
    useState<boolean>(false);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);

  const [message, setMessage] = useState<string>(
    t('message.test-your-connection-before-creating-service')
  );

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
    return getTestConnectionType(serviceCategory);
  }, [serviceCategory]);

  const allowTestConn = useMemo(() => {
    return shouldTestConnection(connectionType);
  }, [connectionType]);

  const isTestConnectionDisabled =
    isTestingConnection || isTestingDisabled || !allowTestConn;

  // data fetch handlers

  const fetchConnectionDefinition = async () => {
    try {
      const response = await getTestConnectionDefinitionByName(
        toLower(connectionType)
      );

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

  // handlers
  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setMessage(t('message.testing-your-connection-may-take-two-minutes'));

    // reset states for workflow ans steps result
    setCurrentWorkflow(undefined);
    setTestConnectionStepResult([]);
    setTestStatus(undefined);

    // current interval id
    let intervalId: number | null = null;

    try {
      const createWorkflowData: CreateWorkflow = {
        name: `test-connection-${connectionType}-${cryptoRandomString({
          length: 8,
          type: 'alphanumeric',
        })}`,
        workflowType: WorkflowType.TestConnection,
        request: {
          connection: { config: updatedFormData as ConfigClass },
          serviceType: serviceType,
          connectionType: connectionType,
        },
      };

      // fetch the connection steps for current connectionType
      await fetchConnectionDefinition();

      setDialogOpen(true);

      // create the workflow
      const response = await addWorkflow(createWorkflowData);

      // trigger the workflow
      const status = await triggerWorkflowById(response.id);

      // fetch the workflow response if workflow ran successfully
      if (status === 200) {
        /**
         * fetch workflow repeatedly with 2s interval
         * until status is either Failed or Successful
         */
        intervalId = toNumber(
          setInterval(async () => {
            const workflowResponse = await getWorkflowData(response.id);
            const { response: testConnectionResponse } = workflowResponse;

            const isWorkflowFailed =
              workflowResponse.status === WorkflowStatus.Failed;
            const isWorkflowSuccess =
              workflowResponse.status === WorkflowStatus.Successful;

            const isWorkflowCompleted = isWorkflowFailed || isWorkflowSuccess;

            const isTestConnectionSuccess =
              (testConnectionResponse?.status as StatusType) ===
              StatusType.Successful;

            const isTestConnectionFailed =
              (testConnectionResponse?.status as StatusType) ===
              StatusType.Failed;

            if (isWorkflowCompleted) {
              setMessage(
                isTestConnectionSuccess
                  ? t('message.connection-test-successful')
                  : t('message.connection-test-failed')
              );

              isTestConnectionSuccess &&
                showSuccessToast(t('message.connection-test-successful'));

              isTestConnectionFailed &&
                showErrorToast(t('message.connection-test-failed'));

              // clear the current interval
              intervalId && clearInterval(intervalId);

              // set testing connection to false
              setIsTestingConnection(false);

              // set the test connection status
              setTestStatus(
                isTestConnectionSuccess
                  ? StatusType.Successful
                  : StatusType.Failed
              );
            }
          }, FETCH_INTERVAL)
        );

        // stop fetching the workflow after 2 minutes
        setTimeout(() => {
          // clear the current interval
          intervalId && clearInterval(intervalId);

          // using reference to ensure call back should have latest value
          const currentWorkflowStatus = currentWorkflowRef.current
            ?.status as WorkflowStatus;

          const isWorkflowCompleted = WORKFLOW_COMPLETE_STATUS.includes(
            currentWorkflowStatus
          );

          if (!isWorkflowCompleted) {
            const infoMessage = t('message.test-connection-taking-too-long');
            setMessage(infoMessage);
            showInfoToast(infoMessage);
          }

          setIsTestingConnection(false);
        }, FETCHING_EXPIRY_TIME);
      }
    } catch (error) {
      intervalId && clearInterval(intervalId);
      showErrorToast(error as AxiosError);
      setIsTestingConnection(false);
      setMessage(t('message.connection-test-failed'));
      setTestStatus(StatusType.Failed);
    }
  };

  useEffect(() => {
    currentWorkflowRef.current = currentWorkflow; // update ref with latest value of currentWorkflow state variable
  }, [currentWorkflow]);

  // rendering

  return (
    <>
      {displayButtonOnly ? (
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
      ) : (
        <div className="flex justify-between bg-white border border-main shadow-base rounded-4 p-sm mt-4">
          <Space data-testid="message-container" size={8}>
            {isTestingConnection && <Loader size="small" />}
            {testStatus === StatusType.Successful && (
              <SuccessIcon data-testid="success-badge" height={24} width={24} />
            )}
            {testStatus === StatusType.Failed && (
              <FailIcon data-testid="fail-badge" height={24} width={24} />
            )}
            <Space data-testid="messag-text" size={2}>
              {message}{' '}
              {testStatus && (
                <Transi18next
                  i18nKey="message.click-text-to-view-details"
                  renderElement={
                    <Button
                      className="p-0 test-connection-message-btn"
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
