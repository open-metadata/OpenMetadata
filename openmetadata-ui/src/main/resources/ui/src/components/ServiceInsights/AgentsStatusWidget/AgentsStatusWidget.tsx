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

import { Collapse, Typography } from 'antd';
import { ServiceTypes } from 'Models';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ArrowSvg } from '../../../assets/svg/ic-arrow-down.svg';
import { SERVICE_AUTOPILOT_AGENT_TYPES } from '../../../constants/Services.constant';
import { IngestionPipeline } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { WorkflowStatus } from '../../../generated/governance/workflows/workflowInstanceState';
import { useFqn } from '../../../hooks/useFqn';
import { getIngestionPipelines } from '../../../rest/ingestionPipelineAPI';
import { getEntityTypeFromServiceCategory } from '../../../utils/ServiceUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { ServiceInsightWidgetCommonProps } from '../ServiceInsightsTab.interface';

function AgentsStatusWidget({
  serviceName,
  workflowStatesData,
}: Readonly<ServiceInsightWidgetCommonProps>) {
  const { t } = useTranslation();
  const { serviceCategory } = useRequiredParams<{
    serviceCategory: ServiceTypes;
  }>();
  const { fqn: decodedServiceFQN } = useFqn();
  const [agentsList, setAgentsList] = useState<IngestionPipeline[]>([]);

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
    const agentsList = await getIngestionPipelines({
      arrQueryFields: [],
      serviceFilter: decodedServiceFQN,
      serviceType: getEntityTypeFromServiceCategory(serviceCategory),
      pipelineType: SERVICE_AUTOPILOT_AGENT_TYPES,
    });
    setAgentsList(agentsList.data);
  };

  useEffect(() => {
    getAgentsList();
  }, [decodedServiceFQN]);

  return (
    <Collapse
      className="service-insights-collapse-widget"
      defaultActiveKey={['1']}
      expandIcon={() => (
        <div className="expand-icon-container">
          <Typography.Text className="text-primary text-xs">
            {t('label.view-more')}
          </Typography.Text>
          <ArrowSvg className="text-primary" height={12} width={12} />
        </div>
      )}
      expandIconPosition="end">
      <Collapse.Panel
        header={
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
        }
        key="1">
        <div>
          <Typography.Text>{serviceName}</Typography.Text>
        </div>
      </Collapse.Panel>
    </Collapse>
  );
}

export default AgentsStatusWidget;
