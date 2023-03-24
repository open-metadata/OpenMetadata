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
import { Button, Divider, Modal, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import Loader from 'components/Loader/Loader';
import cryptoRandomString from 'crypto-random-string-with-promisify-polyfill';
import { ServiceCategory } from 'enums/service.enum';
import { CreateWorkflow } from 'generated/api/automations/createWorkflow';
import { ConfigClass } from 'generated/entity/automations/testServiceConnection';
import {
  TestConnectionStepResult,
  Workflow,
  WorkflowStatus,
  WorkflowType,
} from 'generated/entity/automations/workflow';
import { TestConnectionStep } from 'generated/entity/services/connections/testConnectionDefinition';
import { ConfigData } from 'interface/service.interface';
import { lowerCase, toNumber } from 'lodash';
import React, { FC, useMemo, useState } from 'react';
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
import { showErrorToast } from 'utils/ToastUtils';

import { ReactComponent as FailIcon } from 'assets/svg/fail-badge.svg';
import { ReactComponent as SuccessIcon } from 'assets/svg/success-badge.svg';

interface TestConnectionProps {
  isTestingDisabled: boolean;
  connectionType: string;
  serviceCategory: ServiceCategory;
  formData: ConfigData;
}

type TestStatus = Exclude<WorkflowStatus, 'Pending' | 'Running'> | undefined;

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
}) => {
  const { t } = useTranslation();

  const [isTestingConnection, setIsTestingConnection] =
    useState<boolean>(false);

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

  const [dialogOpen, setDialogOpen] = useState<boolean>(false);

  const [testStatus, setTestStatus] = useState<TestStatus>();

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

  const fetchConnectionDefinition = async () => {
    try {
      const response = await getTestConnectionDefinitionByName(
        lowerCase(connectionType)
      );

      setTestConnectionStep(response.steps);
    } catch (error) {
      // we will not throw error for this API
    }
  };

  const getWorkflowData = async (workflowId: string) => {
    try {
      const response = await getWorkflowById(workflowId);
      const stepsResponse = response.response?.steps ?? [];

      setTestConnectionStepResult(stepsResponse);

      setCurrentWorkflow(response);

      return response;
    } catch (error) {
      throw error as AxiosError;
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setMessage(t('label.testing-connection'));

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
            const isFailed = workflowResponse.status === WorkflowStatus.Failed;
            const isSuccess =
              workflowResponse.status === WorkflowStatus.Successful;
            const isWorkflowCompleted = isFailed || isSuccess;

            if (isWorkflowCompleted) {
              setMessage(`Test connection ${isFailed ? 'Failed' : 'Success'}`);

              // clear the current interval
              intervalId && clearInterval(intervalId);

              setIsTestingConnection(false);

              setTestStatus(
                isSuccess ? WorkflowStatus.Successful : WorkflowStatus.Failed
              );
            }
          }, FETCH_INTERVAL)
        );

        // stop fetching the workflow after 2 minutes
        setTimeout(() => {
          // clear the current interval
          intervalId && clearInterval(intervalId);

          const isWorkflowCompleted = WORKFLOW_COMPLETE_STATUS.includes(
            currentWorkflow?.status as WorkflowStatus
          );

          if (!isWorkflowCompleted) {
            setMessage('Test connection is taking too long try again');
          }

          setIsTestingConnection(false);
        }, FETCHING_EXPIRY_TIME);
      }
    } catch (error) {
      intervalId && clearInterval(intervalId);
      showErrorToast(error as AxiosError);
    }
  };

  const getStepResult = (step: TestConnectionStep) => {
    return testConnectionStepResult.find(
      (resultStep) => resultStep.name === step.name
    );
  };

  return (
    <>
      <div className="flex justify-between tw-bg-white border tw-border-main tw-shadow tw-rounded tw-p-3 tw-mt-4">
        <Space size={16}>
          {isTestingConnection && <Loader size="small" />}
          {testStatus === WorkflowStatus.Successful && (
            <SuccessIcon height={24} width={24} />
          )}
          {testStatus === WorkflowStatus.Failed && (
            <FailIcon height={24} width={24} />
          )}
          <Space>
            {message}
            {/* TODO: add click here to view details text */}
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
      <Modal
        centered
        bodyStyle={{ padding: '16px 0px 16px 0px' }}
        closable={false}
        maskClosable={false}
        open={dialogOpen}
        title="Connection Status"
        width={748}
        onCancel={() => setDialogOpen(false)}
        onOk={() => setDialogOpen(false)}>
        {testConnectionStep.map((step, index) => {
          const showDivider = testConnectionStep.length - 1 !== index;
          const currentStepResult = getStepResult(step);
          const hasPassed = currentStepResult?.passed;

          return (
            <>
              <Space align="start" className="px-4" key={step.name} size={16}>
                <span className="self-start">
                  {hasPassed ? (
                    <SuccessIcon height={24} width={24} />
                  ) : isTestingConnection ? (
                    <Loader size="small" />
                  ) : (
                    <FailIcon height={24} width={24} />
                  )}
                </span>
                <Space direction="vertical">
                  <Typography.Text className="text-body">
                    {step.name}
                  </Typography.Text>
                  <Typography.Text className="text-grey-muted">
                    {currentStepResult?.message ?? step.description}
                  </Typography.Text>
                </Space>
              </Space>
              {showDivider && <Divider />}
            </>
          );
        })}
      </Modal>
    </>
  );
};

export default TestConnection;
