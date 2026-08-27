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
  Badge,
  Box,
  Button,
  Card,
  Skeleton,
  Tooltip,
} from '@openmetadata/ui-core-components';
import { ChevronDown, Plus } from '@untitledui/icons';
import { FC, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ReloadIcon } from '../../../assets/svg/reload.svg';
import Loader from '../../common/Loader/Loader';
import { Agent, AgentActionPermissions } from '../AgentsPage.interface';
import { useAgentActionAvailability } from '../hooks/useAgentActionAvailability';
import AgentCard from './AgentCard.component';
import AgentCardSkeleton from './AgentCardSkeleton.component';

const DEFAULT_SKELETON_COUNT = 3;

interface AgentGroupProps {
  addAgentSlot?: ReactNode;
  agentPermissions?: Record<string, AgentActionPermissions>;
  agents: Agent[];
  allowedActions?: string[];
  canCreateAgent: boolean;
  dataTestId?: string;
  descKey: string;
  emptyPlaceholder?: ReactNode;
  icon: ReactNode;
  /**
   * First load only. The list is empty until the caller knows whether there are
   * any agents, and rendering `emptyPlaceholder` in that window claims "none
   * exist" before that is known — show placeholder cards instead.
   */
  isLoading?: boolean;
  /** Disables the refresh button and swaps its icon for a spinner while a refetch is in flight. */
  isRefreshing?: boolean;
  skeletonCount?: number;
  titleKey: string;
  onAction: (action: string, agent: Agent) => void | Promise<void>;
  onLogs: (agent: Agent) => void;
  /** Refetches this list only. Omit to leave the group without a refresh control. */
  onRefresh?: () => void;
  onRun: (agent: Agent) => void;
  onRunDetails: (agent: Agent, runId?: string) => void;
}

const AgentGroup: FC<AgentGroupProps> = ({
  addAgentSlot,
  agentPermissions,
  agents,
  allowedActions,
  canCreateAgent,
  dataTestId = 'agent-group',
  descKey,
  emptyPlaceholder,
  icon,
  isLoading = false,
  isRefreshing,
  skeletonCount = DEFAULT_SKELETON_COUNT,
  onAction,
  onLogs,
  onRefresh,
  onRun,
  onRunDetails,
  titleKey,
}) => {
  const { t } = useTranslation();
  const { isPending: isActionPending } = useAgentActionAvailability();
  const runningCount = agents.filter((a) => a.status === 'running').length;

  const renderAgents = () => {
    if (isLoading) {
      return (
        <div
          aria-busy
          aria-label={t('label.loading')}
          aria-live="polite"
          className="tw:grid tw:gap-2.5"
          data-testid="agent-group-skeleton"
          role="status">
          {Array.from({ length: skeletonCount }, (_, index) => (
            <AgentCardSkeleton key={`agent-card-skeleton-${index}`} />
          ))}
        </div>
      );
    }

    if (agents.length === 0 && emptyPlaceholder) {
      return (
        <Box
          className="tw:relative tw:min-h-80 tw:w-full"
          data-testid="agent-group-empty-placeholder">
          {emptyPlaceholder}
        </Box>
      );
    }

    return (
      <div className="tw:grid tw:gap-2.5">
        {agents.map((agent) => (
          <AgentCard
            agent={agent}
            allowedActions={allowedActions}
            key={agent.id}
            permissions={agentPermissions?.[agent.fqn]}
            onAction={onAction}
            onLogs={onLogs}
            onRun={onRun}
            onRunDetails={onRunDetails}
          />
        ))}
      </div>
    );
  };

  return (
    <Card
      className="tw:rounded-2xl tw:border tw:border-secondary tw:bg-secondary tw:p-4.5"
      data-testid={dataTestId}
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
            data-testid="agent-group-running-count"
            size="sm"
            type="pill-color">
            <span className="tw:size-1.5 tw:animate-pulse tw:rounded-full tw:bg-utility-brand-500" />
            {t('label.count-running', { count: runningCount })}
          </Badge>
        )}
        {/* Immediately before the add-agent slot, so it reads as the secondary action left of Add
            Agent on the metadata list and takes that same top-right spot on the Collate AI list,
            whose header carries no add button. */}
        {onRefresh && (
          <Tooltip
            title={t('label.refresh-entity', {
              entity: t('label.agent-plural'),
            })}>
            <Button
              color="secondary"
              data-testid="agent-group-refresh"
              iconLeading={
                isRefreshing ? (
                  <Loader size="x-small" />
                ) : (
                  <ReloadIcon width={14} />
                )
              }
              isDisabled={isRefreshing}
              size="md"
              onClick={onRefresh}
            />
          </Tooltip>
        )}
        {/* Creating an agent deploys it, so the control waits on the pipeline service status the
            same way the per-card actions do — a placeholder while it is in flight, and the slot's
            own disabled state once it answers. */}
        {isActionPending ? (
          <span
            aria-busy
            aria-label={t('label.loading')}
            aria-live="polite"
            data-testid="add-agent-skeleton"
            role="status">
            <Skeleton height={36} variant="rounded" width={120} />
          </span>
        ) : (
          addAgentSlot ??
          (canCreateAgent && (
            <Button
              color="secondary"
              iconLeading={<Plus size={18} />}
              iconTrailing={<ChevronDown size={18} />}
              size="sm">
              {t('label.add-entity', { entity: t('label.agent') })}
            </Button>
          ))
        )}
      </Box>
      {renderAgents()}
    </Card>
  );
};

export default AgentGroup;
