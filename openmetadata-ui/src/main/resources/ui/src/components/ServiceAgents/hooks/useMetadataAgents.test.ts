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

import { act, renderHook } from '@testing-library/react-hooks';
import { ServiceCategory } from '../../../enums/service.enum';
import {
  IngestionPipeline,
  PipelineType,
} from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import {
  ProgressUpdateType,
  ServiceProgressEvent,
} from '../../../generated/entity/services/ingestionPipelines/serviceProgressEvent';
import { useMetadataAgents } from './useMetadataAgents';

let capturedOnEvent: (event: ServiceProgressEvent) => void;

jest.mock('./useServiceProgressStream', () => ({
  useServiceProgressStream: jest.fn(
    (options: { onEvent: (event: ServiceProgressEvent) => void }) => {
      capturedOnEvent = options.onEvent;

      return { streamHealth: 'live' };
    }
  ),
}));

const mockGetIngestionPipelineByFqn = jest.fn();

jest.mock('../../../rest/ingestionPipelineAPI', () => ({
  getIngestionPipelineByFqn: jest.fn((...args) =>
    mockGetIngestionPipelineByFqn(...args)
  ),
}));

const buildPipeline = (name: string): IngestionPipeline =>
  ({
    id: `id-${name}`,
    name,
    fullyQualifiedName: `testSnowflake.${name}`,
    pipelineType: PipelineType.Metadata,
  } as IngestionPipeline);

const buildEvent = (
  pipelineFqn: string,
  overrides: Partial<ServiceProgressEvent> = {},
  eventOverrides: Partial<ServiceProgressEvent['event']> = {}
): ServiceProgressEvent => ({
  pipelineFqn,
  runId: 'run-1',
  event: {
    runId: 'run-1',
    timestamp: 1751500000000,
    updateType: ProgressUpdateType.Processing,
    ...eventOverrides,
  },
  ...overrides,
});

const renderAgentsHook = (pipelines: IngestionPipeline[]) =>
  renderHook(
    ({ pipelines: currentPipelines }) =>
      useMetadataAgents(
        currentPipelines,
        ServiceCategory.DATABASE_SERVICES,
        'testSnowflake'
      ),
    { initialProps: { pipelines } }
  );

describe('useMetadataAgents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetIngestionPipelineByFqn.mockResolvedValue(
      buildPipeline('metadata_agent')
    );
  });

  it('maps the pipelines prop to agents', () => {
    const { result } = renderAgentsHook([buildPipeline('metadata_agent')]);

    expect(result.current.agents).toHaveLength(1);
    expect(result.current.agents[0].fqn).toBe('testSnowflake.metadata_agent');
  });

  it('applies progress events to known agents', () => {
    const { result } = renderAgentsHook([buildPipeline('metadata_agent')]);

    act(() => {
      capturedOnEvent(
        buildEvent(
          'testSnowflake.metadata_agent',
          {},
          {
            totalAssetsIngested: 42,
          }
        )
      );
    });

    expect(result.current.agents[0].status).toBe('running');
    expect(result.current.agents[0].assets).toBe(42);
  });

  it('drops events for unknown agents without an attached pipeline', () => {
    const { result } = renderAgentsHook([buildPipeline('metadata_agent')]);

    act(() => {
      capturedOnEvent(buildEvent('testSnowflake.autopilot_agent'));
    });

    expect(result.current.agents).toHaveLength(1);
  });

  it('adds an unknown agent from a DISCOVERY event carrying the pipeline', () => {
    const { result } = renderAgentsHook([buildPipeline('metadata_agent')]);

    act(() => {
      capturedOnEvent(
        buildEvent(
          'testSnowflake.autopilot_agent',
          { ingestionPipeline: buildPipeline('autopilot_agent') },
          { updateType: ProgressUpdateType.Discovery }
        )
      );
    });

    expect(result.current.agents).toHaveLength(2);

    const discovered = result.current.agents.find(
      (agent) => agent.fqn === 'testSnowflake.autopilot_agent'
    );

    expect(discovered?.status).toBe('running');
  });

  it('applies later progress frames to a discovered agent', () => {
    const { result } = renderAgentsHook([buildPipeline('metadata_agent')]);

    act(() => {
      capturedOnEvent(
        buildEvent(
          'testSnowflake.autopilot_agent',
          { ingestionPipeline: buildPipeline('autopilot_agent') },
          { updateType: ProgressUpdateType.Discovery }
        )
      );
      capturedOnEvent(
        buildEvent(
          'testSnowflake.autopilot_agent',
          {},
          {
            timestamp: 1751500001000,
            totalAssetsIngested: 7,
          }
        )
      );
    });

    const discovered = result.current.agents.find(
      (agent) => agent.fqn === 'testSnowflake.autopilot_agent'
    );

    expect(discovered?.assets).toBe(7);
  });

  it('keeps a discovered agent when the pipelines prop lags behind', () => {
    const initial = [buildPipeline('metadata_agent')];
    const { result, rerender } = renderAgentsHook(initial);

    act(() => {
      capturedOnEvent(
        buildEvent(
          'testSnowflake.autopilot_agent',
          { ingestionPipeline: buildPipeline('autopilot_agent') },
          { updateType: ProgressUpdateType.Discovery }
        )
      );
    });

    rerender({ pipelines: [...initial] });

    expect(
      result.current.agents.some(
        (agent) => agent.fqn === 'testSnowflake.autopilot_agent'
      )
    ).toBe(true);
  });

  it('tracks stream-discovered agents in discoveredCount until the prop catches up', () => {
    const initial = [buildPipeline('metadata_agent')];
    const { result, rerender } = renderAgentsHook(initial);

    expect(result.current.discoveredCount).toBe(0);

    act(() => {
      capturedOnEvent(
        buildEvent(
          'testSnowflake.autopilot_agent',
          { ingestionPipeline: buildPipeline('autopilot_agent') },
          { updateType: ProgressUpdateType.Discovery }
        )
      );
    });

    expect(result.current.discoveredCount).toBe(1);

    rerender({ pipelines: [...initial] });

    expect(result.current.discoveredCount).toBe(1);

    rerender({ pipelines: [...initial, buildPipeline('autopilot_agent')] });

    expect(result.current.discoveredCount).toBe(0);
  });

  it('does not duplicate a discovered agent once the prop includes it', () => {
    const initial = [buildPipeline('metadata_agent')];
    const { result, rerender } = renderAgentsHook(initial);

    act(() => {
      capturedOnEvent(
        buildEvent(
          'testSnowflake.autopilot_agent',
          { ingestionPipeline: buildPipeline('autopilot_agent') },
          { updateType: ProgressUpdateType.Discovery }
        )
      );
    });

    rerender({ pipelines: [...initial, buildPipeline('autopilot_agent')] });

    expect(
      result.current.agents.filter(
        (agent) => agent.fqn === 'testSnowflake.autopilot_agent'
      )
    ).toHaveLength(1);
  });
});
