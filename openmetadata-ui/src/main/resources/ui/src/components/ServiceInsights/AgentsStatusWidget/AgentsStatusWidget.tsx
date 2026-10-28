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

import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Box,
  Card,
  Grid,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';

import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getAgentStatusSummary } from '../../../utils/AgentsStatusWidgetPureUtils';
import {
  getAgentRunningStatusMessage,
  getIconFromStatus,
} from '../../../utils/AgentsStatusWidgetUtils';
import { getLayoutGutter } from '../../../utils/common/layout.utils';
import NoDataPlaceholder from '../../common/EmptyPlaceholder/NoDataPlaceholder';
import './agents-status-widget.less';
import { AgentsStatusWidgetProps } from './AgentsStatusWidget.interface';

const renderAgentStatusExpandIcon = (
  isLoading: boolean,
  agentStatusSummary: Record<string, number>,
  t: ReturnType<typeof useTranslation>['t']
) => (
  <div
    className="expand-icon-container"
    data-testid="agent-status-widget-expand-icon">
    {isLoading ? (
      <Skeleton height={24} variant="rounded" width={120} />
    ) : (
      <div className="agent-status-summary-container">
        {Object.entries(agentStatusSummary).map(([key, value]) => (
          <div
            className={classNames('agent-status-summary-item', key)}
            data-testid={`agent-status-summary-item-${key}`}
            key={key}>
            {getIconFromStatus(key)}
            <Typography
              className="agent-status-summary-text"
              data-testid="pipeline-count">
              {value}
            </Typography>
            <Typography className="agent-status-summary-text">{key}</Typography>
          </div>
        ))}
      </div>
    )}
    <Typography
      className="text-primary"
      data-testid="agent-status-widget-view-more">
      {t('label.view-more')}
    </Typography>
  </div>
);

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
    <Accordion
      allowsMultipleExpanded
      className="service-insights-collapse-widget agents-status-widget"
      data-testid="agent-status-widget">
      <AccordionItem id="1" key="1">
        <AccordionHeader>
          <Box align="center" className="tw:w-full" justify="between">
            <div className="flex justify-between items-center">
              <div className="flex flex-col gap-1">
                <Typography className="font-medium text-lg">
                  {t('label.entity-status', {
                    entity: t('label.agent-plural'),
                  })}
                </Typography>

                {agentsRunningStatusMessage}
              </div>
            </div>
            {renderAgentStatusExpandIcon(isLoading, agentStatusSummary, t)}
          </Box>
        </AccordionHeader>
        <AccordionPanel>
          {!isLoading && isEmpty(agentsInfo) && (
            <div className="flex-center p-y-md">
              <div className="tw:relative tw:h-full tw:w-full tw:min-h-60 tw:rounded-xl tw:bg-surface">
                <NoDataPlaceholder data-testid="no-data-placeholder" />
              </div>
            </div>
          )}

          <Grid
            className="layout-row layout-grid"
            style={getLayoutGutter(16, 16)}>
            {isLoading
              ? Array.from(
                  { length: 8 },
                  (_, index) => `agent-skeleton-${index}`
                ).map((skeletonKey) => (
                  <Grid.Item
                    className="layout-column"
                    key={skeletonKey}
                    span={6}>
                    <Card className="agent-status-card">
                      <Card.Content>
                        <Skeleton height={32} variant="rounded" width={160} />
                      </Card.Content>
                    </Card>
                  </Grid.Item>
                ))
              : agentsInfo.map((agent) => (
                  <Grid.Item
                    className="layout-column"
                    key={agent.label}
                    span={6}>
                    <Card
                      className="agent-status-card"
                      color={agent.isCollateAgent ? 'brand' : 'default'}
                      data-testid={`agent-status-card-${agent.label}`}>
                      <Card.Content className="tw:flex tw:items-center tw:justify-between tw:gap-2">
                        <Box
                          inline
                          align="center"
                          className="layout-space layout-space-horizontal"
                          gap={2}
                          itemClassName="layout-space-item">
                          {agent.agentIcon}
                          <Typography>{agent.label}</Typography>
                        </Box>
                        {getIconFromStatus(agent.status)}
                      </Card.Content>
                    </Card>
                  </Grid.Item>
                ))}
          </Grid>
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
  );
}

export default AgentsStatusWidget;
