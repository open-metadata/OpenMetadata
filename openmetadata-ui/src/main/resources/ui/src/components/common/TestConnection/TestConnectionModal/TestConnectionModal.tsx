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
import {
  Button,
  Modal,
  Progress,
  ProgressProps,
  Space,
  Typography,
} from 'antd';
import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconTimeOut } from '../../../../assets/svg/ic-time-out.svg';
import { ReactComponent as IconTimeOutButton } from '../../../../assets/svg/ic-timeout-button.svg';
import { TEST_CONNECTION_FAILURE_MESSAGE } from '../../../../constants/Services.constant';
import { TestConnectionStepResult } from '../../../../generated/entity/automations/workflow';
import { TestConnectionStep } from '../../../../generated/entity/services/connections/testConnectionDefinition';
import InlineAlert from '../../InlineAlert/InlineAlert';
import ConnectionStepCard from '../ConnectionStepCard/ConnectionStepCard';
import './test-connection-modal.less';
interface TestConnectionModalProps {
  isOpen: boolean;
  isTestingConnection: boolean;
  testConnectionStep: TestConnectionStep[];
  testConnectionStepResult: TestConnectionStepResult[];
  progress: number;
  isConnectionTimeout: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onTestConnection: () => void;
  errorMessage?: {
    description?: string;
    subDescription?: string;
  };
  handleCloseErrorMessage: () => void;
  serviceType?: string;
  hostIp?: string;
}

const TestConnectionModal: FC<TestConnectionModalProps> = ({
  isOpen,
  progress,
  isTestingConnection,
  testConnectionStep,
  testConnectionStepResult,
  onConfirm,
  onCancel,
  isConnectionTimeout,
  onTestConnection,
  errorMessage,
  handleCloseErrorMessage,
  serviceType,
  hostIp,
}) => {
  const { t } = useTranslation();

  const [message, setMessage] = useState<string>();
  const getConnectionStepResult = (step: TestConnectionStep) => {
    return testConnectionStepResult.find(
      (resultStep) => resultStep.name === step.name
    );
  };

  const getProgressFormat: ProgressProps['format'] = (progress) => {
    return <span data-testid="progress-bar-value">{`${progress}%`}</span>;
  };

  useEffect(() => {
    const msg = t('message.test-connection-taking-too-long.default', {
      service_type: serviceType,
    });
    if (hostIp) {
      const hostIpMessage =
        msg +
        t('message.test-connection-taking-too-long.withIp', { ip: hostIp });
      setMessage(hostIpMessage);
    } else {
      setMessage(msg);
    }
  }, [hostIp]);

  return (
    <Modal
      centered
      bodyStyle={{ padding: '16px 0px 16px 0px' }}
      closable={false}
      data-testid="test-connection-modal"
      maskClosable={false}
      open={isOpen}
      title={t('label.connection-status')}
      width={748}
      onCancel={onCancel}
      onOk={onConfirm}>
      <Space
        className="p-x-md w-full overflow-hidden"
        direction="vertical"
        size={16}>
        {errorMessage && (
          <InlineAlert
            description={errorMessage.description}
            heading={TEST_CONNECTION_FAILURE_MESSAGE}
            type="error"
            onClose={handleCloseErrorMessage}
          />
        )}

        <Progress
          className="test-connection-progress-bar"
          format={getProgressFormat}
          percent={progress}
          strokeColor="#B3D4F4"
        />
        {isConnectionTimeout ? (
          <Space
            align="center"
            className="timeout-widget justify-center w-full"
            data-testid="test-connection-timeout-widget"
            direction="vertical"
            size={20}>
            <IconTimeOut height={100} width={100} />
            <Typography.Title level={5}>
              {t('label.connection-timeout')}
            </Typography.Title>
            <Typography.Text className="text-grey-muted">
              {message}
            </Typography.Text>
            <Button
              ghost
              className="try-again-button"
              data-testid="try-again-button"
              icon={<IconTimeOutButton height={14} width={14} />}
              type="primary"
              onClick={onTestConnection}>
              {t('label.try-again')}
            </Button>
          </Space>
        ) : (
          <>
            {testConnectionStep.map((step) => {
              const currentStepResult = getConnectionStepResult(step);

              return (
                <ConnectionStepCard
                  isTestingConnection={isTestingConnection}
                  key={step.name}
                  testConnectionStep={step}
                  testConnectionStepResult={currentStepResult}
                />
              );
            })}
          </>
        )}
      </Space>
    </Modal>
  );
};

export default TestConnectionModal;
