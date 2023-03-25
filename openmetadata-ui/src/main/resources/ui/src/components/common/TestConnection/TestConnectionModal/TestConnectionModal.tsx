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
import { Divider, Modal, Space, Typography } from 'antd';
import { ReactComponent as FailIcon } from 'assets/svg/fail-badge.svg';
import { ReactComponent as SuccessIcon } from 'assets/svg/success-badge.svg';
import Loader from 'components/Loader/Loader';
import { TestConnectionStepResult } from 'generated/entity/automations/workflow';
import { TestConnectionStep } from 'generated/entity/services/connections/testConnectionDefinition';
import React, { FC, Fragment } from 'react';
import { useTranslation } from 'react-i18next';

interface TestConnectionModalProps {
  isOpen: boolean;
  isTestingConnection: boolean;
  testConnectionStep: TestConnectionStep[];
  testConnectionStepResult: TestConnectionStepResult[];
  onCancel: () => void;
  onConfirm: () => void;
}

const TestConnectionModal: FC<TestConnectionModalProps> = ({
  isOpen,
  isTestingConnection,
  testConnectionStep,
  testConnectionStepResult,
  onCancel,
  onConfirm,
}) => {
  const { t } = useTranslation();

  const getConnectionStepResult = (step: TestConnectionStep) => {
    return testConnectionStepResult.find(
      (resultStep) => resultStep.name === step.name
    );
  };

  return (
    <Modal
      centered
      bodyStyle={{ padding: '16px 0px 16px 0px' }}
      closable={false}
      maskClosable={false}
      open={isOpen}
      title={t('label.connection-status')}
      width={748}
      onCancel={onCancel}
      onOk={onConfirm}>
      {testConnectionStep.map((step, index) => {
        const showDivider = testConnectionStep.length - 1 !== index;
        const currentStepResult = getConnectionStepResult(step);
        const hasPassed = currentStepResult?.passed;

        return (
          <Fragment key={step.name}>
            <Space align="start" className="px-4" size={16}>
              <span>
                {hasPassed ? (
                  <SuccessIcon
                    data-testid="success-badge"
                    height={24}
                    width={24}
                  />
                ) : isTestingConnection ? (
                  <Loader size="small" />
                ) : (
                  <FailIcon data-testid="fail-badge" height={24} width={24} />
                )}
              </span>
              <Space direction="vertical" size={0}>
                <Typography.Text className="text-body">
                  {step.name}
                </Typography.Text>
                <Typography.Text className="text-grey-muted">
                  {currentStepResult?.message ?? step.description}
                </Typography.Text>
              </Space>
            </Space>
            {showDivider && <Divider />}
          </Fragment>
        );
      })}
    </Modal>
  );
};

export default TestConnectionModal;
