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

import { AxiosError } from 'axios';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  deployIngestionPipelineById,
  enableDisableIngestionPipelineById,
  postKillIngestionPipelineById,
  triggerIngestionPipelineById,
} from '../../../rest/ingestionPipelineAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { Agent } from '../AgentsPage.interface';

type AgentAction = (agent: Agent) => Promise<void>;

interface UseAgentActionsResult {
  runAgent: AgentAction;
  redeployAgent: AgentAction;
  killAgent: AgentAction;
  toggleAgent: AgentAction;
}

/**
 * Wraps the ingestion-pipeline action APIs (trigger / deploy / kill / toggle)
 * with success + error toasts. `onChanged` is invoked after a successful action
 * so the caller can refresh the list.
 */
export const useAgentActions = (
  onChanged?: () => void
): UseAgentActionsResult => {
  const { t } = useTranslation();

  const runAction = useCallback(
    async (
      apiCall: (id: string) => Promise<unknown>,
      agent: Agent,
      actionLabel: string
    ) => {
      try {
        await apiCall(agent.id);
        showSuccessToast(
          t('message.pipeline-action-success-message', { action: actionLabel })
        );
        onChanged?.();
      } catch (err) {
        showErrorToast(err as AxiosError);
      }
    },
    [onChanged, t]
  );

  const runAgent = useCallback(
    (agent: Agent) =>
      runAction(
        triggerIngestionPipelineById,
        agent,
        t('label.triggered-lowercase')
      ),
    [runAction, t]
  );

  const redeployAgent = useCallback(
    (agent: Agent) =>
      runAction(
        deployIngestionPipelineById,
        agent,
        t('label.deployed-lowercase')
      ),
    [runAction, t]
  );

  const killAgent = useCallback(
    (agent: Agent) =>
      runAction(
        postKillIngestionPipelineById,
        agent,
        t('label.stopped-lowercase')
      ),
    [runAction, t]
  );

  const toggleAgent = useCallback(
    (agent: Agent) =>
      runAction(
        enableDisableIngestionPipelineById,
        agent,
        t('label.updated-lowercase')
      ),
    [runAction, t]
  );

  return { runAgent, redeployAgent, killAgent, toggleAgent };
};
