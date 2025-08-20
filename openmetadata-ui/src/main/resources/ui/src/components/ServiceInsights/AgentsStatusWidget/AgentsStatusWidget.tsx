/*
 *  Copyright 2025 Collate.
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

import { Card, Col, Collapse, Row, Skeleton, Space, Typography } from 'antd';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ArrowSvg from '../../../assets/svg/ic-arrow-down.svg?react';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';
import {
  getAgentRunningStatusMessage,
  getAgentStatusSummary,
  getIconFromStatus,
} from '../../../utils/AgentsStatusWidgetUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import './agents-status-widget.less';
import { AgentsStatusWidgetProps } from './AgentsStatusWidget.interface';

function AgentsStatusWidget({
  liveAutoPilotStatusData,
  isLoading,
  agentsInfo,
}: Readonly<AgentsStatusWidgetProps>) {
  const { t } = useTranslation();

  const agentsRunningStatusMessage = useMemo(
    () =>
      getAgentRunningStatusMessage(
        isLoading,
        agentsInfo,
        liveAutoPilotStatusData
      ),
    [liveAutoPilotStatusData, isLoading, agentsInfo]
  );

  const agentStatusSummary = useMemo(() => {
    return getAgentStatusSummary(agentsInfo);
  }, [agentsInfo]);

  return (
    <Collapse
      className="service-insights-collapse-widget agents-status-widget"
      data-testid="agent-status-widget"
      expandIcon={() => (
        <div
          className="expand-icon-container"
          data-testid="agent-status-widget-expand-icon">
          {isLoading ? (
            <Skeleton.Input active size="small" />
          ) : (
            <div className="agent-status-summary-container">
              {Object.entries(agentStatusSummary).map(([key, value]) => (
                <div
                  className={classNames('agent-status-summary-item', key)}
                  data-testid={`agent-status-summary-item-${key}`}
                  key={key}>
                  {getIconFromStatus(key)}
                  <Typography.Text data-testid="pipeline-count">
                    {value}
                  </Typography.Text>
                  <Typography.Text>{key}</Typography.Text>
                </div>
              ))}
            </div>
          )}
          <Typography.Text
            className="text-primary"
            data-testid="agent-status-widget-view-more">
            {t('label.view-more')}
          </Typography.Text>
          <ArrowSvg className="text-primary" height={14} width={14} />
        </div>
      )}
      expandIconPosition="end">
      <Collapse.Panel
        header={
          <div className="flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <Typography.Text className="font-medium text-lg">
                {t('label.entity-status', {
                  entity: t('label.agent-plural'),
                })}
              </Typography.Text>

              {agentsRunningStatusMessage}
            </div>
          </div>
        }
        key="1">
        {!isLoading && isEmpty(agentsInfo) && (
          <div className="flex-center p-y-md">
            <ErrorPlaceHolder
              size={SIZE.SMALL}
              type={ERROR_PLACEHOLDER_TYPE.NO_DATA}
            />
          </div>
        )}

        <Row gutter={[16, 16]}>
          {isLoading
            ? Array(8)
                .fill(null)
                .map((_, index) => (
                  <Col key={index} span={6}>
                    <Card className="agent-status-card">
                      <Skeleton.Input active />
                    </Card>
                  </Col>
                ))
            : agentsInfo.map((agent) => (
                <Col key={agent.label} span={6}>
                  <Card
                    className={classNames(
                      'agent-status-card',
                      agent.isCollateAgent ? 'collate-agent' : ''
                    )}
                    data-testid={`agent-status-card-${agent.label}`}>
                    <Space align="center" size={8}>
                      {agent.agentIcon}
                      <Typography.Text>{agent.label}</Typography.Text>
                    </Space>
                    {getIconFromStatus(agent.status)}
                  </Card>
                </Col>
              ))}
        </Row>
      </Collapse.Panel>
    </Collapse>
  );
}

export default AgentsStatusWidget;
