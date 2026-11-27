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

import { act, renderHook, waitFor } from '@testing-library/react';
import {
  ServiceAgentSubTabs,
  ServiceCategory,
} from '../../../enums/service.enum';
import { WorkflowStatus } from '../../../generated/governance/workflows/workflowInstance';
import { ServicesType } from '../../../interface/service.interface';
import {
  getAiAutomationsByService,
  triggerOnDemandApp,
} from '../../../rest/applicationAPI';
import { getIngestionPipelines } from '../../../rest/ingestionPipelineAPI';
import { getWorkflowInstancesForApplication } from '../../../rest/workflowAPI';
import { useServiceAgents } from './useServiceAgents';

const mockAvailability = { isPending: false, isUnavailable: false };
jest.mock('../../ServiceAgents/hooks/useAgentActionAvailability', () => ({
  useAgentActionAvailability: () => mockAvailability,
}));

jest.mock('../../ServiceAgents/hooks/useMetadataAgents', () => ({
  useMetadataAgents: () => ({
    agents: [{ id: 'agent-1' }],
    discoveredCount: 1,
  }),
}));

// The real hook also syncs the URL, which needs a router this hook test has no use for.
jest.mock('../../../hooks/paging/usePaging', () => ({
  usePaging: () => {
    const { useCallback, useState } = jest.requireActual('react');
    const [paging, setPaging] = useState({ total: 0 });
    const handlePagingChange = useCallback(
      (next: { total?: number }) => setPaging(next),
      []
    );

    return { paging, pageSize: 15, handlePagingChange };
  },
}));

jest.mock('../../../rest/ingestionPipelineAPI', () => ({
  getIngestionPipelines: jest.fn(),
}));

jest.mock('../../../rest/applicationAPI', () => ({
  getAiAutomationsByService: jest.fn(),
  triggerOnDemandApp: jest.fn(),
}));

jest.mock('../../../rest/workflowAPI', () => ({
  getWorkflowInstancesForApplication: jest.fn(),
  getWorkflowInstanceStateById: jest.fn().mockResolvedValue({ data: [] }),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../utils/EntityPureUtils', () => ({
  getEntityFeedLink: (type: string, fqn: string) => `<#E::${type}::${fqn}>`,
}));

const SERVICE = { fullyQualifiedName: 'test-service' } as ServicesType;

const renderAgents = (
  serviceDetails: ServicesType = SERVICE,
  fetchAiAgents = true
) =>
  renderHook(() =>
    useServiceAgents({
      serviceCategory: ServiceCategory.DATABASE_SERVICES,
      serviceDetails,
      fetchAiAgents,
    })
  );

const runningInstance = { id: 'wf-1', status: WorkflowStatus.Running };

describe('useServiceAgents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAvailability.isPending = false;
    mockAvailability.isUnavailable = false;
    (getIngestionPipelines as jest.Mock).mockResolvedValue({
      data: [{ id: 'p1' }],
      paging: { total: 2 },
    });
    (getAiAutomationsByService as jest.Mock).mockResolvedValue({
      data: [{ id: 'a1' }],
    });
    (getWorkflowInstancesForApplication as jest.Mock).mockResolvedValue({
      data: [],
    });
  });

  it('counts the paged metadata total plus stream-discovered agents, and the AI agents', async () => {
    const { result } = renderAgents();

    await waitFor(() =>
      expect(result.current.isIngestionPipelineLoading).toBe(false)
    );
    await waitFor(() =>
      expect(result.current.isCollateAgentLoading).toBe(false)
    );

    expect(result.current.ingestionPipelines).toEqual([{ id: 'p1' }]);
    expect(result.current.collateAgentsList).toEqual([{ id: 'a1' }]);
    expect(result.current.agentCounts).toEqual({
      [ServiceAgentSubTabs.METADATA]: 3,
      [ServiceAgentSubTabs.COLLATE_AI]: 1,
    });
  });

  it('does not ask for AI agents no plugin lists', async () => {
    const { result } = renderAgents(SERVICE, false);

    await waitFor(() =>
      expect(result.current.isIngestionPipelineLoading).toBe(false)
    );

    expect(getAiAutomationsByService).not.toHaveBeenCalled();
    expect(result.current.isCollateAgentLoading).toBe(false);
  });

  it('does not ask for AI agents of a deleted service', async () => {
    const { result } = renderAgents({ ...SERVICE, deleted: true });

    await waitFor(() =>
      expect(result.current.isIngestionPipelineLoading).toBe(false)
    );

    expect(getAiAutomationsByService).not.toHaveBeenCalled();
  });

  it('fetches nothing until the service has loaded', () => {
    renderAgents({} as ServicesType);

    expect(getIngestionPipelines).not.toHaveBeenCalled();
    expect(getWorkflowInstancesForApplication).not.toHaveBeenCalled();
  });

  it('refetches only the list whose refresh was asked for', async () => {
    const { result } = renderAgents();
    await waitFor(() =>
      expect(result.current.isCollateAgentLoading).toBe(false)
    );
    jest.clearAllMocks();

    await act(async () => {
      result.current.refreshAgentsList(ServiceAgentSubTabs.COLLATE_AI);
    });

    expect(getAiAutomationsByService).toHaveBeenCalledTimes(1);
    expect(getIngestionPipelines).not.toHaveBeenCalled();

    await act(async () => {
      result.current.refreshAgentsList(ServiceAgentSubTabs.METADATA);
    });

    expect(getIngestionPipelines).toHaveBeenCalledTimes(1);
    expect(getAiAutomationsByService).toHaveBeenCalledTimes(1);
  });

  describe('AutoPilot action', () => {
    it('is enabled once the status is known and no run is in flight', async () => {
      const { result } = renderAgents();

      await waitFor(() =>
        expect(result.current.autoPilotAction.isDisabled).toBe(false)
      );

      expect(result.current.autoPilotAction.disabledMessage).toBeUndefined();
    });

    it('stays disabled, saying why, while a run is in flight', async () => {
      (getWorkflowInstancesForApplication as jest.Mock).mockResolvedValue({
        data: [runningInstance],
      });
      const { result } = renderAgents();

      await waitFor(() =>
        expect(result.current.autoPilotAction.disabledMessage).toBe(
          'message.auto-pilot-already-running'
        )
      );

      expect(result.current.autoPilotAction.isDisabled).toBe(true);
    });

    it('is disabled, saying why, while the pipeline service cannot be reached', async () => {
      mockAvailability.isUnavailable = true;
      const { result } = renderAgents();

      await waitFor(() =>
        expect(result.current.autoPilotAction.disabledMessage).toBe(
          'message.pipeline-service-unreachable-agent-actions'
        )
      );

      expect(result.current.autoPilotAction.isDisabled).toBe(true);
    });

    it('triggers AutoPilot for the service and reads the new run so the trigger stays disabled', async () => {
      const { result } = renderAgents();
      await waitFor(() =>
        expect(result.current.autoPilotAction.isDisabled).toBe(false)
      );
      (getWorkflowInstancesForApplication as jest.Mock).mockResolvedValue({
        data: [runningInstance],
      });

      await act(async () => {
        await result.current.autoPilotAction.onTrigger();
      });

      expect(triggerOnDemandApp).toHaveBeenCalledWith('AutoPilotApplication', {
        entityLink: '<#E::databaseService::test-service>',
      });
      expect(result.current.autoPilotAction.isDisabled).toBe(true);
    });
  });
});
