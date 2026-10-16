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
import type { Node } from 'reactflow';
import { NodeType } from '../generated/governance/workflows/elements/nodeType';
import { ScheduleTimeline } from '../generated/governance/workflows/elements/triggers/periodicBatchEntityTrigger';
import {
  Type,
  WorkflowDefinition,
} from '../generated/governance/workflows/workflowDefinition';
import { getInitialNodeConfig } from './NodeUtils';

const startNode = {
  id: 'n1',
  type: NodeType.StartEvent,
  data: {},
  position: { x: 0, y: 0 },
} as Node;

const buildWorkflowDefinition = (
  schedule?: Record<string, unknown>
): WorkflowDefinition =>
  ({
    displayName: 'WF',
    description: 'desc',
    trigger: {
      type: Type.PeriodicBatchEntity,
      config: {
        entityTypes: [],
        ...(schedule ? { schedule } : {}),
      },
    },
  } as unknown as WorkflowDefinition);

describe('getInitialNodeConfig scheduleType branch', () => {
  it('sets scheduleType to OnDemand when the timeline is None', () => {
    const config = getInitialNodeConfig(
      startNode,
      buildWorkflowDefinition({ scheduleTimeline: ScheduleTimeline.None })
    );

    expect(config.scheduleType).toBe('OnDemand');
  });

  it('sets scheduleType to Scheduled for a Custom timeline with a cron expression', () => {
    const config = getInitialNodeConfig(
      startNode,
      buildWorkflowDefinition({
        scheduleTimeline: ScheduleTimeline.Custom,
        cronExpression: '0 0 * * *',
      })
    );

    expect(config.scheduleType).toBe('Scheduled');
    expect(config.cronExpression).toBe('0 0 * * *');
  });

  it('leaves scheduleType empty for a Custom timeline without a cron expression', () => {
    const config = getInitialNodeConfig(
      startNode,
      buildWorkflowDefinition({ scheduleTimeline: ScheduleTimeline.Custom })
    );

    expect(config.scheduleType).toBe('');
  });

  it('leaves scheduleType empty when there is no schedule config', () => {
    const config = getInitialNodeConfig(startNode, buildWorkflowDefinition());

    expect(config.scheduleType).toBe('');
  });
});
