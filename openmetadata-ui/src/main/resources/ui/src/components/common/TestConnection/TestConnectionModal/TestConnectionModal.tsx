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
  Collapse,
  Modal,
  Progress,
  ProgressProps,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import { isUndefined } from 'lodash';
import { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconTimeOut } from '../../../../assets/svg/ic-time-out.svg';
import { ReactComponent as IconTimeOutButton } from '../../../../assets/svg/ic-timeout-button.svg';
import { ReactComponent as CopyIcon } from '../../../../assets/svg/icon-copy.svg';
import { TEST_CONNECTION_FAILURE_MESSAGE } from '../../../../constants/Services.constant';
import { TestConnectionStepResult } from '../../../../generated/entity/automations/workflow';
import { TestConnectionStep } from '../../../../generated/entity/services/connections/testConnectionDefinition';
import { useClipboard } from '../../../../hooks/useClipBoard';
import { partitionConnectionSteps } from '../../../../utils/TestConnectionUtils';
import InlineAlert from '../../InlineAlert/InlineAlert';
import ConnectionStepCard from '../ConnectionStepCard/ConnectionStepCard';
import './test-connection-modal.less';

const { Panel } = Collapse;

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

  const getConnectionStepResult = (step: TestConnectionStep) =>
    testConnectionStepResult.find(
      (resultStep) => resultStep.name === step.name
    );

  // The connection "gate" establishes connectivity; capability checks only run
  // once it passes. Splitting them lets us show a real "Didn't run" state for the
  // capability checks when the handshake fails, instead of a stuck "Awaiting".
  const { gateStep, capabilitySteps } = useMemo(
    () => partitionConnectionSteps(testConnectionStep),
    [testConnectionStep]
  );

  const gateResult = gateStep ? getConnectionStepResult(gateStep) : undefined;
  const connectionFailed =
    !isTestingConnection && !isUndefined(gateResult) && !gateResult.passed;

  const rawLog = useMemo(
    () =>
      testConnectionStepResult
        .map((result) =>
          [`> ${result.name}`, result.message, result.errorLog]
            .filter(Boolean)
            .join('\n')
        )
        .join('\n\n')
        .trim(),
    [testConnectionStepResult]
  );

  const { onCopyToClipBoard } = useClipboard(rawLog);

  const getProgressFormat: ProgressProps['format'] = (progress) => (
    <span data-testid="progress-bar-value">{`${progress}%`}</span>
  );

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
            heading={t(TEST_CONNECTION_FAILURE_MESSAGE)}
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
            {gateStep && (
              <div data-testid="connection-gate-phase">
                <Typography.Text className="text-xss text-grey-muted m-b-xss d-block">
                  {t('label.establish-connection')}
                </Typography.Text>
                <ConnectionStepCard
                  isTestingConnection={isTestingConnection}
                  testConnectionStep={gateStep}
                  testConnectionStepResult={gateResult}
                />
              </div>
            )}

            {capabilitySteps.length > 0 && (
              <div data-testid="capability-checks-phase">
                <Typography.Text className="text-xss text-grey-muted m-b-xss d-block">
                  {t('label.capability-check-plural')}
                  {connectionFailed &&
                    ` · ${t('message.connection-not-established')}`}
                </Typography.Text>
                <Space className="w-full" direction="vertical" size={16}>
                  {capabilitySteps.map((step) => (
                    <ConnectionStepCard
                      connectionFailed={connectionFailed}
                      isTestingConnection={isTestingConnection}
                      key={step.name}
                      testConnectionStep={step}
                      testConnectionStepResult={getConnectionStepResult(step)}
                    />
                  ))}
                </Space>
              </div>
            )}

            {rawLog && (
              <Collapse ghost className="raw-connection-log">
                <Panel
                  data-testid="raw-connection-log"
                  extra={
                    <Tooltip title={t('message.copy-to-clipboard')}>
                      <Button
                        className="flex-center bg-white"
                        data-testid="copy-raw-log-button"
                        icon={<CopyIcon height={16} width={16} />}
                        onClick={(event) => {
                          event.stopPropagation();
                          onCopyToClipBoard();
                        }}
                      />
                    </Tooltip>
                  }
                  header={t('label.raw-connection-log')}
                  key="raw-log">
                  <pre className="raw-connection-log-content">{rawLog}</pre>
                </Panel>
              </Collapse>
            )}
          </>
        )}
      </Space>
    </Modal>
  );
};

export default TestConnectionModal;
