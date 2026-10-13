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

import i18next from 'i18next';
import { Edge, Node } from 'reactflow';
import { WorkflowType } from '../constants/WorkflowBuilder.constants';
import { EntityType } from '../enums/entity.enum';
import { SinkType } from '../generated/governance/workflows/elements/nodes/automatedTask/sinkTask';
import { NodeSubType } from '../generated/governance/workflows/elements/nodeSubType';
import { NodeType } from '../generated/governance/workflows/elements/nodeType';
import {
  Type,
  WorkflowDefinition,
} from '../generated/governance/workflows/workflowDefinition';
import { buildWorkflowForSave } from './WorkflowValidationService';

jest.mock('../rest/workflowDefinitionsAPI', () => ({
  validateWorkflowDefinition: jest.fn(),
}));

jest.mock('../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const TABLE_FILTER = '{"and":[{"==":[{"var":"deleted"},false]}]}';
const QUERY_FILTER = '{"and":[{"==":[{"var":"deleted"},true]}]}';

const createStartNode = (data: Record<string, unknown> = {}): Node => ({
  id: 'start',
  type: NodeType.StartEvent,
  position: { x: 0, y: 0 },
  data: { label: 'Start', name: 'start', ...data },
});

const SINK_NODE: Node = {
  id: 'sink',
  type: NodeType.AutomatedTask,
  position: { x: 0, y: 100 },
  data: {
    label: 'Git Sink',
    name: 'sink',
    subType: NodeSubType.SinkTask,
    config: { sinkType: SinkType.Git },
  },
};

const SET_ATTRIBUTE_NODE: Node = {
  id: 'set',
  type: NodeType.AutomatedTask,
  position: { x: 0, y: 100 },
  data: {
    label: 'Set Tier',
    name: 'set',
    subType: NodeSubType.SetEntityAttributeTask,
    config: { fieldName: 'tier', fieldValue: 'Tier.Tier1' },
  },
};

const END_NODE: Node = {
  id: 'end',
  type: NodeType.EndEvent,
  position: { x: 0, y: 200 },
  data: { label: 'End', name: 'end' },
};

const buildEdges = (taskNodeId: string): Edge[] => [
  { id: 'e1', source: 'start', target: taskNodeId },
  { id: 'e2', source: taskNodeId, target: 'end' },
];

// A trigger picked as "All" in the builder: an explicit list that includes query.
const USER_CONFIGURED_TRIGGER = {
  userModified: true,
  triggerType: WorkflowType.PERIODIC_BATCH,
  dataAssets: [EntityType.TABLE, EntityType.QUERY],
  dataAssetFilters: [
    { id: 1, dataAsset: EntityType.TABLE, filters: TABLE_FILTER },
    { id: 2, dataAsset: EntityType.QUERY, filters: QUERY_FILTER },
  ],
  scheduleType: 'OnDemand',
};

const STORED_DEFINITION = {
  name: 'GitSyncWorkflow',
  trigger: {
    type: Type.PeriodicBatchEntity,
    config: {
      entityTypes: [EntityType.TABLE, EntityType.QUERY],
      filters: {
        [EntityType.TABLE]: TABLE_FILTER,
        [EntityType.QUERY]: QUERY_FILTER,
      },
      schedule: { scheduleTimeline: 'None' },
      batchSize: 100,
    },
  },
} as unknown as WorkflowDefinition;

const STORED_EVENT_DEFINITION = {
  name: 'GitSyncWorkflow',
  trigger: {
    type: Type.EventBasedEntity,
    config: {
      entityTypes: [EntityType.TABLE, EntityType.QUERY],
      events: ['Created', 'Updated'],
      filter: {
        [EntityType.TABLE]: TABLE_FILTER,
        [EntityType.QUERY]: QUERY_FILTER,
      },
    },
  },
} as unknown as WorkflowDefinition;

const getTriggerConfig = (workflow: WorkflowDefinition) =>
  (workflow.trigger as { config: Record<string, unknown> }).config;

describe('buildWorkflowForSave', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('drops query from a trigger configured before a git sink was added', async () => {
    const workflow = await buildWorkflowForSave(
      [createStartNode(USER_CONFIGURED_TRIGGER), SINK_NODE, END_NODE],
      buildEdges('sink'),
      { name: 'GitSyncWorkflow' } as WorkflowDefinition
    );

    expect(getTriggerConfig(workflow)).toEqual(
      expect.objectContaining({
        entityTypes: [EntityType.TABLE],
        filters: { [EntityType.TABLE]: TABLE_FILTER },
      })
    );
  });

  it('drops query from a stored periodic trigger of a workflow with a git sink', async () => {
    const workflow = await buildWorkflowForSave(
      [createStartNode(), SINK_NODE, END_NODE],
      buildEdges('sink'),
      STORED_DEFINITION
    );

    expect(getTriggerConfig(workflow)).toEqual(
      expect.objectContaining({
        entityTypes: [EntityType.TABLE],
        filters: { [EntityType.TABLE]: TABLE_FILTER },
      })
    );
  });

  it('drops query from a stored event-based trigger of a workflow with a git sink', async () => {
    const workflow = await buildWorkflowForSave(
      [createStartNode(), SINK_NODE, END_NODE],
      buildEdges('sink'),
      STORED_EVENT_DEFINITION
    );

    expect(getTriggerConfig(workflow)).toEqual(
      expect.objectContaining({
        entityTypes: [EntityType.TABLE],
        filter: { [EntityType.TABLE]: TABLE_FILTER },
      })
    );
  });

  it('rejects a git sink workflow whose trigger has only query', async () => {
    jest
      .spyOn(i18next, 't')
      .mockImplementation(((key: string) => key) as typeof i18next.t);

    await expect(
      buildWorkflowForSave(
        [
          createStartNode({
            ...USER_CONFIGURED_TRIGGER,
            dataAssets: [EntityType.QUERY],
            dataAssetFilters: [],
          }),
          SINK_NODE,
          END_NODE,
        ],
        buildEdges('sink'),
        { name: 'GitSyncWorkflow' } as WorkflowDefinition
      )
    ).rejects.toThrow('message.workflow-trigger-requires-data-assets');
  });

  it('keeps query in the trigger of a workflow without a git sink', async () => {
    const workflow = await buildWorkflowForSave(
      [createStartNode(USER_CONFIGURED_TRIGGER), SET_ATTRIBUTE_NODE, END_NODE],
      buildEdges('set'),
      { name: 'TierWorkflow' } as WorkflowDefinition
    );

    expect(getTriggerConfig(workflow)).toEqual(
      expect.objectContaining({
        entityTypes: [EntityType.TABLE, EntityType.QUERY],
        filters: {
          [EntityType.TABLE]: TABLE_FILTER,
          [EntityType.QUERY]: QUERY_FILTER,
        },
      })
    );
  });
});
