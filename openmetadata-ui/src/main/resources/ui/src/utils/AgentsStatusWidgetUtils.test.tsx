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

import { render, screen } from '@testing-library/react';
import {
  WorkflowInstance,
  WorkflowStatus,
} from '../generated/governance/workflows/workflowInstance';
import { getAgentRunningStatusMessage } from './AgentsStatusWidgetUtils';

describe('getAgentRunningStatusMessage', () => {
  it('preserves a completed workflow message when no agents are present', () => {
    render(
      getAgentRunningStatusMessage(false, [], {
        status: WorkflowStatus.Finished,
      } as WorkflowInstance)
    );

    expect(screen.getByTestId('agents-status-message')).toHaveTextContent(
      'message.auto-pilot-agents-finished-message'
    );
  });

  it('shows the no-agent message when no workflow status is available', () => {
    render(getAgentRunningStatusMessage(false, []));

    expect(screen.getByTestId('agents-status-message')).toHaveTextContent(
      'message.auto-pilot-no-agents-message'
    );
  });
});
