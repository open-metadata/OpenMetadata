/*
 *  Copyright 2026 Collate.
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

import { useMemo } from 'react';
import { useAirflowStatus } from '../../../context/AirflowStatusProvider/AirflowStatusProvider';

export interface AgentActionAvailability {
  /** The status call is still in flight — render placeholders in place of the action controls. */
  isPending: boolean;
  /** The status call has answered and the pipeline service is unreachable — disable the controls. */
  isUnavailable: boolean;
}

/**
 * Availability of the agent controls that reach the pipeline service: trigger, deploy, kill,
 * toggle, logs, and creating an agent.
 *
 * Only those controls depend on it. The agent list, the run history, and the recent-run dots come
 * from OpenMetadata's own tables, so they stay readable while the pipeline service is unreachable —
 * that state is exactly when someone needs to look at the last runs. `AirflowMessageBanner` carries
 * the explanation for why the controls are disabled, so they do not each need their own.
 */
export const useAgentActionAvailability = (): AgentActionAvailability => {
  const { isAirflowAvailable, isFetchingStatus } = useAirflowStatus();

  return useMemo(
    () => ({
      isPending: isFetchingStatus,
      // `isAirflowAvailable` is seeded false, so it only means "unreachable" once the call has
      // answered — checking it alone would disable every control on the first paint.
      isUnavailable: !isFetchingStatus && !isAirflowAvailable,
    }),
    [isAirflowAvailable, isFetchingStatus]
  );
};
