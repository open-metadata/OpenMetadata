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
import { useEffect, useState } from 'react';
import { getRunHistoryForPipeline } from '../../../rest/ingestionPipelineAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import { AgentRun } from '../AgentsPage.interface';
import { mapPipelineStatusToRun } from '../utils/agentsDataMapper';

const RUN_HISTORY_LIMIT = 10;

/**
 * Fetches the recent run history for a pipeline (by FQN) and maps it to the
 * AgentRun view-model. Only fetches while `enabled` (e.g. the drawer is open).
 * Pass `fetchRuns` to source the runs from somewhere other than the
 * ingestion-pipeline run history (e.g. app-backed agents).
 *
 * `fetchRuns` MUST be a stable reference (wrap it in `useCallback`). It is part
 * of the effect dependency array, so an inline function would re-run the effect
 * on every render and re-fetch in a loop.
 */
export const useAgentRuns = (
  fqn: string,
  enabled: boolean,
  fetchRuns?: () => Promise<AgentRun[]>
): { runs: AgentRun[]; isLoading: boolean } => {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled || (!fqn && !fetchRuns)) {
      return;
    }

    let isActive = true;
    setIsLoading(true);
    const runsPromise = fetchRuns
      ? fetchRuns()
      : getRunHistoryForPipeline(fqn, { limit: RUN_HISTORY_LIMIT }).then(
          (res) => res.data.map(mapPipelineStatusToRun)
        );
    runsPromise
      .then((mappedRuns) => {
        if (isActive) {
          setRuns(mappedRuns);
        }
      })
      .catch((err) => showErrorToast(err as AxiosError))
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [fqn, enabled, fetchRuns]);

  return { runs, isLoading };
};
