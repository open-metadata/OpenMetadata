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
import { Node } from 'reactflow';
import { WorkflowType } from '../constants/WorkflowBuilder.constants';
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

const SAVED_FILTER = '{"!=":[{"var":"fullyQualifiedName"},"Finance"]}';

const savedWorkflow = (config: Record<string, unknown>) =>
  ({
    name: 'GlossaryChangeApproval',
    trigger: {
      type: Type.EventBasedEntity,
      config: {
        entityTypes: ['glossary'],
        events: ['Updated'],
        ...config,
      },
    },
    nodes: [],
    edges: [],
  } as unknown as WorkflowDefinition);

const startNode = (data: Record<string, unknown>): Node =>
  ({
    id: 'start',
    type: NodeType.StartEvent,
    position: { x: 0, y: 0 },
    data,
  } as Node);

const editedStartNode = (triggerFilter: string) =>
  startNode({
    userModified: true,
    triggerType: WorkflowType.EVENT_BASED,
    dataAssets: ['glossary'],
    eventType: ['Updated'],
    triggerFilter,
  });

const savedConfig = async (nodes: Node[], workflow: WorkflowDefinition) =>
  (await buildWorkflowForSave(nodes, [], workflow)).trigger as {
    config: Record<string, unknown>;
  };

describe('WorkflowValidationService.buildWorkflowForSave', () => {
  it('keeps the approval mode when the start node is untouched', async () => {
    const { config } = await savedConfig(
      [startNode({})],
      savedWorkflow({ approvalMode: 'Shadow' })
    );

    expect(config.approvalMode).toBe('Shadow');
  });

  it('keeps the approval mode when the start node is edited', async () => {
    const { config } = await savedConfig(
      [editedStartNode(SAVED_FILTER)],
      savedWorkflow({
        approvalMode: 'Shadow',
        filter: { glossary: SAVED_FILTER },
      })
    );

    expect(config.approvalMode).toBe('Shadow');
  });

  it('saves the approval mode chosen on the start node', async () => {
    const { config } = await savedConfig(
      [
        startNode({
          userModified: true,
          triggerType: WorkflowType.EVENT_BASED,
          dataAssets: ['glossary'],
          eventType: ['Updated'],
          approvalMode: 'Enforce',
        }),
      ],
      savedWorkflow({ approvalMode: 'Shadow' })
    );

    expect(config.approvalMode).toBe('Enforce');
  });

  it('writes no approval mode when none was saved', async () => {
    const { config } = await savedConfig([startNode({})], savedWorkflow({}));

    expect(config).not.toHaveProperty('approvalMode');
  });

  it('saves no filter after the user clears the one shown to them', async () => {
    const { config } = await savedConfig(
      [editedStartNode('')],
      savedWorkflow({ filter: { glossary: SAVED_FILTER } })
    );

    expect(config).not.toHaveProperty('filter');
  });

  it('saves the edited filter for every entity type', async () => {
    const { config } = await savedConfig(
      [editedStartNode(SAVED_FILTER)],
      savedWorkflow({})
    );

    expect(config.filter).toEqual({ glossary: SAVED_FILTER });
  });

  it('keeps a saved filter that the sidebar could not show', async () => {
    const defaultOnly = { default: SAVED_FILTER };
    const { config } = await savedConfig(
      [editedStartNode('')],
      savedWorkflow({ filter: defaultOnly })
    );

    expect(config.filter).toEqual(defaultOnly);
  });
});
