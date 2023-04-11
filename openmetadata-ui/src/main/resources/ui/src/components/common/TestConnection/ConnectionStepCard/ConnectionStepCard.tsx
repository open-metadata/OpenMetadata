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
import { Collapse, Divider, Space, Typography } from 'antd';
import { ReactComponent as FailIcon } from 'assets/svg/fail-badge.svg';
import { ReactComponent as SuccessIcon } from 'assets/svg/success-badge.svg';
import classNames from 'classnames';
import { TestConnectionStepResult } from 'generated/entity/automations/workflow';
import { TestConnectionStep } from 'generated/entity/services/connections/testConnectionDefinition';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { requiredField } from 'utils/CommonUtils';
import './ConnectionStepCard.less';

const { Panel } = Collapse;

interface ConnectionStepCardProp {
  testConnectionStep: TestConnectionStep;
  testConnectionStepResult: TestConnectionStepResult | undefined;
  isTestingConnection: boolean;
}

const ConnectionStepCard = ({
  testConnectionStep,
  testConnectionStepResult,
  isTestingConnection,
}: ConnectionStepCardProp) => {
  const { t } = useTranslation();
  const hasPassed = testConnectionStepResult?.passed;
  const success = !isTestingConnection && hasPassed;
  const failed = !isTestingConnection && !hasPassed;

  return (
    <div
      className={classNames('connection-step-card', {
        success: success,
        failure: failed,
      })}>
      <div
        className={classNames('connection-step-card-header', {
          success: success,
          failure: failed,
        })}>
        <Space className="w-full justify-between">
          <Typography.Text className="text-body text-600">
            {testConnectionStep.mandatory
              ? requiredField(testConnectionStep.name, true)
              : testConnectionStep.name}
          </Typography.Text>
          {isTestingConnection && (
            <Typography.Text className="awaiting-status">
              {`${t('label.awaiting-status')}...`}
            </Typography.Text>
          )}
          {success && (
            <Space size={4}>
              <Typography.Text className="success-status">
                {`${t('label.success')}`}
              </Typography.Text>
              <SuccessIcon data-testid="success-badge" height={20} width={20} />
            </Space>
          )}
          {failed && (
            <Space size={4}>
              <Typography.Text className="failure-status">
                {`${t('label.failed')}`}
              </Typography.Text>
              <FailIcon data-testid="fail-badge" height={20} width={20} />
            </Space>
          )}
          {/* {hasPassed ? (
            <Space size={4}>
              <Typography.Text className="success-status">
                {`${t('label.success')}`}
              </Typography.Text>
              <SuccessIcon data-testid="success-badge" height={20} width={20} />
            </Space>
          ) : isTestingConnection ? (
            <Typography.Text className="awaiting-status">
              {`${t('label.awaiting-status')}...`}
            </Typography.Text>
          ) : (
            <Space size={4}>
              <Typography.Text className="failure-status">
                {`${t('label.failed')}`}
              </Typography.Text>
              <FailIcon data-testid="fail-badge" height={20} width={20} />
            </Space>
          )} */}
        </Space>
      </div>
      <div className="connection-step-card-content">
        <Typography.Text className="text-body">
          {testConnectionStep.description}
        </Typography.Text>
        {failed && (
          <>
            <Divider className="connection-step-card-content-divider" />
            <Collapse ghost>
              <Panel
                className="connection-step-card-content-logs"
                header="Show logs"
                key="show-log">
                <p className="text-grey-muted">
                  {testConnectionStepResult?.message ||
                    t('label.no-entity', { entity: t('label.log-plural') })}
                </p>
              </Panel>
            </Collapse>
          </>
        )}
      </div>
    </div>
  );
};

export default ConnectionStepCard;
