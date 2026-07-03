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

import { Badge, Box, Button, Card } from '@openmetadata/ui-core-components';
import { FC, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ChevronDownIcon } from '../../../assets/svg/agents/chevron-down.svg';
import { ReactComponent as PlusIcon } from '../../../assets/svg/agents/plus.svg';
import { Agent } from '../AgentsPage.interface';
import AgentCard from './AgentCard.component';

interface AgentGroupProps {
  addAgentSlot?: ReactNode;
  agents: Agent[];
  canCreateAgent: boolean;
  descKey: string;
  icon: ReactNode;
  titleKey: string;
  onAction: (action: string, agent: Agent) => void;
  onLogs: (agent: Agent) => void;
  onRun: (agent: Agent) => void;
  onRunDetails: (agent: Agent, runId?: string) => void;
}

const AgentGroup: FC<AgentGroupProps> = ({
  addAgentSlot,
  agents,
  canCreateAgent,
  descKey,
  icon,
  onAction,
  onLogs,
  onRun,
  onRunDetails,
  titleKey,
}) => {
  const { t } = useTranslation();
  const runningCount = agents.filter((a) => a.status === 'running').length;

  return (
    <Card
      className="tw:rounded-2xl tw:border tw:border-secondary tw:bg-secondary tw:p-4.5"
      variant="ghost">
      <Box align="center" className="tw:mb-4 tw:gap-3">
        <span className="tw:grid tw:size-10 tw:place-items-center tw:rounded-xl tw:border tw:border-secondary tw:bg-primary tw:text-fg-secondary">
          {icon}
        </span>
        <div className="tw:flex-1">
          <div className="tw:text-md tw:font-semibold tw:text-primary">
            {t(titleKey)}
          </div>
          <div className="tw:mt-px tw:text-xs tw:text-tertiary">
            {t(descKey)}
          </div>
        </div>
        {runningCount > 0 && (
          <Badge
            className="tw:gap-1.5 tw:font-semibold"
            color="brand"
            size="sm"
            type="pill-color">
            <span className="tw:size-1.5 tw:animate-pulse tw:rounded-full tw:bg-utility-brand-500" />
            {t('label.count-running', { count: runningCount })}
          </Badge>
        )}
        {addAgentSlot ??
          (canCreateAgent && (
            <Button
              color="secondary"
              iconLeading={<PlusIcon height={18} width={18} />}
              iconTrailing={<ChevronDownIcon height={18} width={18} />}
              size="sm">
              {t('label.add-entity', { entity: t('label.agent') })}
            </Button>
          ))}
      </Box>
      <div className="tw:grid tw:gap-2.5">
        {agents.map((agent) => (
          <AgentCard
            agent={agent}
            key={agent.id}
            onAction={onAction}
            onLogs={onLogs}
            onRun={onRun}
            onRunDetails={onRunDetails}
          />
        ))}
      </div>
    </Card>
  );
};

export default AgentGroup;
