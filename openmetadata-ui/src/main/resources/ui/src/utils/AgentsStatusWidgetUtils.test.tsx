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
  AppRunRecord,
  Status,
} from '../generated/entity/applications/appRunRecord';
import { PipelineState } from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import {
  WorkflowInstance,
  WorkflowStatus,
} from '../generated/governance/workflows/workflowInstance';
import {
  AutomationPipelineRun,
  CollateAgentAutomation,
} from '../rest/applicationAPI';
import {
  automationRunToAppRunRecord,
  getAutomationTemplate,
} from './AgentsStatusWidgetPureUtils';
import {
  getAgentRunningStatusMessage,
  getFormattedAgentsList,
  getFormattedAgentsListFromAgentsLiveInfo,
} from './AgentsStatusWidgetUtils';

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

describe('getAutomationTemplate', () => {
  it.each([
    ['mysql_prod_TierAutomation', 'TierAutomation'],
    ['warehouse_DescriptionAutomation', 'DescriptionAutomation'],
    ['svc_DataQualityAutomation', 'DataQualityAutomation'],
  ])('resolves the template suffix of %s', (name, expected) => {
    expect(getAutomationTemplate(name)).toBe(expected);
  });

  it('returns undefined for a name with no known template suffix', () => {
    expect(getAutomationTemplate('SomeOtherApplication')).toBeUndefined();
  });

  it('does not match a bare template name lacking the service prefix', () => {
    expect(getAutomationTemplate('TierAutomation')).toBeUndefined();
  });
});

describe('automationRunToAppRunRecord', () => {
  const run = (
    over: Partial<AutomationPipelineRun> = {}
  ): AutomationPipelineRun => ({
    runId: 'run-1',
    pipelineState: PipelineState.Success,
    startDate: 1_000,
    endDate: 4_000,
    ...over,
  });

  it('renames the pipeline date fields onto the app-run field names', () => {
    const result = automationRunToAppRunRecord(run());

    expect(result.startTime).toBe(1_000);
    expect(result.endTime).toBe(4_000);
  });

  it('derives execution time from the run window', () => {
    expect(automationRunToAppRunRecord(run()).executionTime).toBe(3_000);
  });

  it('measures an unfinished run against the current time', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(9_000);

    expect(
      automationRunToAppRunRecord(run({ endDate: undefined })).executionTime
    ).toBe(8_000);

    nowSpy.mockRestore();
  });

  it('leaves execution time unset when the run has no start date', () => {
    expect(
      automationRunToAppRunRecord(
        run({ startDate: undefined, endDate: undefined })
      ).executionTime
    ).toBeUndefined();
  });

  it('rolls the per-step records into the job stats the cards read', () => {
    const result = automationRunToAppRunRecord(
      run({
        status: [
          { records: 12, warnings: 1, errors: 0 },
          { records: 3, warnings: 0, errors: 2 },
        ],
      })
    );
    const jobStats = result.successContext?.stats?.jobStats;

    expect(jobStats?.successRecords).toBe(15);
    expect(jobStats?.totalRecords).toBe(15);
    expect(jobStats?.failedRecords).toBe(2);
    expect(jobStats?.warningRecords).toBe(1);
  });

  it('leaves successContext unset when the run has no steps', () => {
    expect(
      automationRunToAppRunRecord(run({ status: [] })).successContext
    ).toBeUndefined();
    expect(
      automationRunToAppRunRecord(run({ status: undefined })).successContext
    ).toBeUndefined();
  });

  it.each([
    [PipelineState.Queued, Status.Pending],
    [PipelineState.Success, Status.Success],
    [PipelineState.Failed, Status.Failed],
    [PipelineState.PartialSuccess, Status.Success],
    [PipelineState.Running, Status.Running],
    [PipelineState.Stopped, Status.Stopped],
  ])('maps pipeline state %s to app run status %s', (state, expected) => {
    expect(
      automationRunToAppRunRecord(run({ pipelineState: state })).status
    ).toBe(expected);
  });

  it('leaves status unset for a run with no pipeline state', () => {
    expect(
      automationRunToAppRunRecord(run({ pipelineState: undefined })).status
    ).toBeUndefined();
  });
});

describe('getFormattedAgentsList', () => {
  const automation = (name: string): CollateAgentAutomation => ({
    id: `${name}-id`,
    name,
  });

  it('keys a Collate agent on its template for type and label', () => {
    const [agent] = getFormattedAgentsList(
      {},
      [],
      [automation('mysql_prod_TierAutomation')]
    );

    expect(agent.agentType).toBe('TierAutomation');
    expect(agent.label).toBe('label.auto-tier');
    expect(agent.isCollateAgent).toBe(true);
  });

  it('reads run status from the template-keyed run map', () => {
    const recentRunStatuses: Record<string, AppRunRecord[]> = {
      TierAutomation: [{ status: Status.Failed } as AppRunRecord],
    };

    const [agent] = getFormattedAgentsList(
      recentRunStatuses,
      [],
      [automation('mysql_prod_TierAutomation')]
    );

    expect(agent.status).toBe('Failed');
  });

  it('orders Collate agents by the AutoPilot template sequence', () => {
    const agents = getFormattedAgentsList(
      {},
      [],
      [
        automation('svc_DataQualityAutomation'),
        automation('svc_TierAutomation'),
        automation('svc_DescriptionAutomation'),
      ]
    );

    expect(agents.map((a) => a.agentType)).toEqual([
      'TierAutomation',
      'DescriptionAutomation',
      'DataQualityAutomation',
    ]);
  });
});

describe('getFormattedAgentsListFromAgentsLiveInfo', () => {
  it('keeps the Collate agents when a frame carries no app status', () => {
    const preserved = getFormattedAgentsList(
      {},
      [],
      [{ id: 'a1', name: 'svc_TierAutomation' }]
    );

    // Terminal frames carry no payload, so the agents already on screen stay.
    const result = getFormattedAgentsListFromAgentsLiveInfo([], [], preserved);

    expect(result.map((a) => a.agentType)).toEqual(['TierAutomation']);
  });

  it('prefers live Collate app status over the preserved fallback', () => {
    const preserved = getFormattedAgentsList(
      {},
      [],
      [{ id: 'a1', name: 'svc_TierAutomation' }]
    );

    const result = getFormattedAgentsListFromAgentsLiveInfo(
      [],
      [{ appName: 'svc_DescriptionAutomation' } as never],
      preserved
    );

    expect(result.map((a) => a.agentType)).toEqual(['DescriptionAutomation']);
  });
});
