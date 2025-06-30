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
import { InfoCircleOutlined } from '@ant-design/icons';
import Icon from '@ant-design/icons/lib/components/Icon';
import { LazyLog } from '@melloware/react-logviewer';
import { Button, Collapse, Divider, Space, Tooltip, Typography } from 'antd';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AttentionIcon } from '../../../../assets/svg/attention.svg';
import { ReactComponent as FailIcon } from '../../../../assets/svg/fail-badge.svg';
import { ReactComponent as CopyIcon } from '../../../../assets/svg/icon-copy.svg';
import { ReactComponent as SuccessIcon } from '../../../../assets/svg/success-badge.svg';
import { TestConnectionStepResult } from '../../../../generated/entity/automations/workflow';
import { TestConnectionStep } from '../../../../generated/entity/services/connections/testConnectionDefinition';
import { useClipboard } from '../../../../hooks/useClipBoard';
import { requiredField } from '../../../../utils/CommonUtils';
import './connection-step-card.less';

const { Panel } = Collapse;

interface ConnectionStepCardProp {
  testConnectionStep: TestConnectionStep;
  testConnectionStepResult?: TestConnectionStepResult;
  isTestingConnection: boolean;
}

const ConnectionStepCard = ({
  testConnectionStep,
  testConnectionStepResult,
  isTestingConnection,
}: ConnectionStepCardProp) => {
  const { t } = useTranslation();
  const isSkipped =
    isUndefined(testConnectionStepResult) && !isTestingConnection;
  const hasPassed = !isSkipped && testConnectionStepResult?.passed;
  const success = hasPassed && !isTestingConnection;
  const failed = !isSkipped && !isTestingConnection && !hasPassed;
  const isMandatoryStepsFailing = failed && testConnectionStepResult?.mandatory;
  const isNonMandatoryStepsFailing =
    failed && !testConnectionStepResult?.mandatory;

  const logs =
    testConnectionStepResult?.errorLog ??
    t('label.no-entity', { entity: t('label.log-plural') });

  const { onCopyToClipBoard } = useClipboard(logs ?? '');

  const handleCopyToClipBoard = (
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => {
    event.preventDefault();
    event.stopPropagation();
    onCopyToClipBoard();
  };

  return (
    <div
      className={classNames('connection-step-card', {
        success: success,
        failure: isMandatoryStepsFailing,
        warning: isNonMandatoryStepsFailing,
      })}>
      <div
        className={classNames('connection-step-card-header', {
          success: success,
          failure: isMandatoryStepsFailing,
          warning: isNonMandatoryStepsFailing,
        })}>
        <Space className="w-full justify-between">
          <Space>
            <Typography.Text className="text-body text-600">
              {testConnectionStep.mandatory
                ? requiredField(testConnectionStep.name, true)
                : testConnectionStep.name}
            </Typography.Text>
            <Tooltip
              placement="bottom"
              showArrow={false}
              title={testConnectionStep.description}>
              <InfoCircleOutlined />
            </Tooltip>
          </Space>
          {isTestingConnection && (
            <Typography.Text className="awaiting-status">
              {`${t('label.awaiting-status')}...`}
            </Typography.Text>
          )}
          {success && (
            <div className="d-flex gap-2 align-center">
              <Typography.Text className="success-status">
                {`${t('label.success')}`}
              </Typography.Text>
              <Icon
                component={SuccessIcon}
                data-testid="success-badge"
                style={{ fontSize: '20px' }}
              />
            </div>
          )}
          {isMandatoryStepsFailing && (
            <div className="d-flex gap-2 align-center">
              <Typography.Text className="failure-status">
                {`${t('label.failed')}`}
              </Typography.Text>
              <Icon
                component={FailIcon}
                data-testid="fail-badge"
                style={{ fontSize: '20px' }}
              />
            </div>
          )}
          {isNonMandatoryStepsFailing && (
            <div className="d-flex gap-2 align-center">
              <Typography.Text className="warning-status">
                {`${t('label.attention')}`}
              </Typography.Text>
              <Icon
                component={AttentionIcon}
                data-testid="warning-badge"
                style={{ fontSize: '20px' }}
              />
            </div>
          )}
          {isSkipped && (
            <Typography.Text className="skipped-status">{`${t(
              'label.skipped'
            )}`}</Typography.Text>
          )}
        </Space>
      </div>
      {(isMandatoryStepsFailing ||
        isNonMandatoryStepsFailing ||
        testConnectionStepResult?.message) && (
        <div className="connection-step-card-content">
          <Typography.Text className="text-body">
            {testConnectionStepResult?.message}
          </Typography.Text>
          {testConnectionStepResult?.errorLog && (
            <>
              <Divider className="connection-step-card-content-divider" />
              <Collapse ghost>
                <Panel
                  className="connection-step-card-content-logs"
                  data-testid="lazy-log"
                  extra={
                    <Tooltip title={t('message.copy-to-clipboard')}>
                      <Button
                        className="flex-center bg-white"
                        data-testid="query-entity-copy-button"
                        icon={<CopyIcon height={16} width={16} />}
                        onClick={handleCopyToClipBoard}
                      />
                    </Tooltip>
                  }
                  header={t('label.show-log-plural')}
                  key="show-log">
                  <LazyLog
                    caseInsensitive
                    enableSearch
                    selectableLines
                    extraLines={1} // 1 is to be add so that linux users can see last line of the log
                    height={300}
                    text={logs}
                  />
                </Panel>
              </Collapse>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ConnectionStepCard;
