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

import { Button } from '@openmetadata/ui-core-components';
import { FC, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Agent } from '../AgentsPage.interface';
import { IcChevD, IcPlus } from '../AgentIcons';
import AgentCard from './AgentCard.component';

interface AgentGroupProps {
  agents: Agent[];
  canCreateAgent: boolean;
  descKey: string;
  icon: ReactNode;
  onAction: (action: string, agent: Agent) => void;
  onLogs: (agent: Agent) => void;
  onRun: (agent: Agent) => void;
  onRunDetails: (agent: Agent, index: number) => void;
  titleKey: string;
}

const AgentGroup: FC<AgentGroupProps> = ({
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
    <div className="tw:rounded-2xl tw:border tw:border-[color:var(--border-subtle)] tw:bg-[color:var(--bg-subtle)] tw:p-[18px]">
      <div className="tw:mb-4 tw:flex tw:items-center tw:gap-3">
        <span className="tw:grid tw:h-10 tw:w-10 tw:place-items-center tw:rounded-[10px] tw:border tw:border-[color:var(--border-default)] tw:bg-white tw:text-[color:var(--fg-secondary)]">
          {icon}
        </span>
        <div className="tw:flex-1">
          <div className="tw:text-base tw:font-semibold tw:text-[color:var(--fg-primary)]">
            {t(titleKey)}
          </div>
          <div className="tw:mt-px tw:text-[12.5px] tw:text-[color:var(--fg-tertiary)]">
            {t(descKey)}
          </div>
        </div>
        {runningCount > 0 && (
          <span className="tw:inline-flex tw:items-center tw:gap-1.5 tw:rounded-full tw:border tw:border-[color:var(--blue-200)] tw:bg-[color:var(--blue-50)] tw:px-[11px] tw:py-1 tw:text-xs tw:font-semibold tw:text-[color:var(--blue-700)]">
            <span className="tw:h-1.5 tw:w-1.5 tw:animate-pulse tw:rounded-full tw:bg-[color:var(--blue-500)]" />
            {t('label.count-running', { count: runningCount })}
          </span>
        )}
        {canCreateAgent && (
          <Button
            color="secondary"
            iconLeading={<IcPlus />}
            iconTrailing={<IcChevD />}
            size="sm">
            {t('label.add-entity', { entity: t('label.agent') })}
          </Button>
        )}
      </div>
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
    </div>
  );
};

export default AgentGroup;
