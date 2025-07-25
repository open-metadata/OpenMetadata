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

import { Card, Col, Collapse, Row, Skeleton, Typography } from 'antd';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { ServiceTypes } from 'Models';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ArrowSvg } from '../../../assets/svg/ic-arrow-down.svg';
import { SERVICE_AUTOPILOT_AGENT_TYPES } from '../../../constants/Services.constant';
import { TabSpecificField } from '../../../enums/entity.enum';
import { AppRunRecord } from '../../../generated/entity/applications/appRunRecord';
import { WorkflowStatus } from '../../../generated/governance/workflows/workflowInstanceState';
import { useFqn } from '../../../hooks/useFqn';
import { getAgentRuns } from '../../../rest/applicationAPI';
import { getIngestionPipelines } from '../../../rest/ingestionPipelineAPI';
import {
  getAgentStatusSummary,
  getFormattedAgentsList,
} from '../../../utils/AgentsStatusWidgetUtils';
import {
  getCurrentMillis,
  getDayAgoStartGMTinMillis,
} from '../../../utils/date-time/DateTimeUtils';
import { getEntityTypeFromServiceCategory } from '../../../utils/ServiceUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import './agents-status-widget.less';
import {
  AgentsInfo,
  AgentsStatusWidgetProps,
} from './AgentsStatusWidget.interface';

function AgentsStatusWidget({
  collateAIagentsList,
  workflowStatesData,
  serviceDetails,
}: Readonly<AgentsStatusWidgetProps>) {
  const { t } = useTranslation();
  const { serviceCategory } = useRequiredParams<{
    serviceCategory: ServiceTypes;
  }>();
  const { fqn: decodedServiceFQN } = useFqn();
  const [agentsList, setAgentsList] = useState<AgentsInfo[]>([]);
  const [recentRunStatuses, setRecentRunStatuses] = useState<
    Record<string, AppRunRecord[]>
  >({});
  const [isLoading, setIsLoading] = useState(0);

  const agentsRunningStatusMessage = useMemo(() => {
    switch (workflowStatesData?.mainInstanceState?.status) {
      case WorkflowStatus.Running:
        return t('message.auto-pilot-agents-running-message');
      case WorkflowStatus.Failure:
        return t('message.auto-pilot-agents-failed-message');
      case WorkflowStatus.Finished:
        return t('message.auto-pilot-agents-finished-message');
      case WorkflowStatus.Exception:
        return t('message.auto-pilot-agents-exception-message');
      default:
        return '';
    }
  }, [workflowStatesData]);

  const getAgentsList = async () => {
    try {
      setIsLoading((prev) => prev + 1);

      const agentsList = await getIngestionPipelines({
        arrQueryFields: [TabSpecificField.PIPELINE_STATUSES],
        serviceFilter: decodedServiceFQN,
        serviceType: getEntityTypeFromServiceCategory(serviceCategory),
        pipelineType: SERVICE_AUTOPILOT_AGENT_TYPES,
      });

      if (!isEmpty(collateAIagentsList)) {
        const endTs = getCurrentMillis();
        const startTs = workflowStatesData?.mainInstanceState?.startedAt
          ? workflowStatesData.mainInstanceState.startedAt
          : getDayAgoStartGMTinMillis(6);
        const recentRunStatusesPromise = collateAIagentsList.map((app) =>
          getAgentRuns(app.name, {
            service: serviceDetails.id,
            startTs,
            endTs,
          })
        );

        const statusData = await Promise.allSettled(recentRunStatusesPromise);

        const recentRunStatuses = statusData.reduce((acc, cv, index) => {
          const app = collateAIagentsList[index];

          return {
            ...acc,
            [app.name]: cv.status === 'fulfilled' ? cv.value.data : [],
          };
        }, {});

        setRecentRunStatuses(recentRunStatuses);
      }

      setAgentsList(
        getFormattedAgentsList(
          agentsList.data,
          recentRunStatuses,
          collateAIagentsList
        )
      );
    } catch {
      // Error
    } finally {
      setIsLoading((prev) => prev - 1);
    }
  };

  const agentStatusSummary = useMemo(() => {
    return getAgentStatusSummary(agentsList);
  }, [agentsList]);

  useEffect(() => {
    getAgentsList();
  }, [decodedServiceFQN]);

  return (
    <Collapse
      className="service-insights-collapse-widget agents-status-widget"
      expandIcon={() => (
        <div className="expand-icon-container">
          <div className="agent-status-summary-container">
            {Object.entries(agentStatusSummary).map(([key, value]) => (
              <div
                className={classNames('agent-status-summary-item', key)}
                key={key}>
                <Typography.Text>{key}</Typography.Text>
                <Typography.Text>{value}</Typography.Text>
              </div>
            ))}
          </div>
          <Typography.Text className="text-primary text-xs">
            {t('label.view-more')}
          </Typography.Text>
          <ArrowSvg className="text-primary" height={12} width={12} />
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
              <Typography.Text className="text-grey-muted text-sm">
                {agentsRunningStatusMessage}
              </Typography.Text>
            </div>
          </div>
        }
        key="1">
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
            : agentsList.map((agent) => (
                <Col key={agent.label} span={6}>
                  <Card
                    className={classNames(
                      'agent-status-card',
                      agent.isCollateAgent ? 'collate-agent' : ''
                    )}>
                    <Typography.Text>{agent.label}</Typography.Text>
                  </Card>
                </Col>
              ))}
        </Row>
      </Collapse.Panel>
    </Collapse>
  );
}

export default AgentsStatusWidget;
