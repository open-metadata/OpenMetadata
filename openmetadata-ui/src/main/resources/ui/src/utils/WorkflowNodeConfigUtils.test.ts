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
import { NodeSubType } from '../generated/governance/workflows/elements/nodeSubType';
import { NodeType } from '../generated/governance/workflows/elements/nodeType';
import {
  NodeConfiguration,
  NodeDataWithMetadata,
} from '../interface/WorkflowTypes.interface';
import { configureNodeInputOutput } from './WorkflowNodeConfigUtils';

const build = (
  type: NodeType,
  subType: NodeSubType,
  config: Record<string, unknown>
) =>
  configureNodeInputOutput(
    { name: 'node', type, subType } as unknown as NodeConfiguration,
    type,
    subType,
    {
      id: 'node',
      name: 'node',
      subType,
      config,
    } as unknown as NodeDataWithMetadata
  );

describe('configureNodeInputOutput', () => {
  it('keeps the approval settings the builder does not edit', () => {
    const transitions = [{ id: 'approve', label: 'Approve' }];
    const node = build(NodeType.UserTask, NodeSubType.UserApprovalTask, {
      taskStatus: 'Open',
      transitionMetadata: transitions,
      approvalThreshold: 2,
      assignees: {
        addOwners: false,
        addReviewers: false,
        addDomainOwners: true,
        emptyAssigneeStrategy: 'wait',
        candidates: [],
      },
    });

    expect(node.config).toEqual(
      expect.objectContaining({
        taskStatus: 'Open',
        transitionMetadata: transitions,
        approvalThreshold: 2,
        assignees: expect.objectContaining({
          addDomainOwners: true,
          emptyAssigneeStrategy: 'wait',
        }),
      })
    );
  });

  it('saves a missing-fields node as its schema allows: its config, one input, no output', () => {
    const config = {
      stage: 'Draft',
      targetStage: 'In Review',
      taskAssignees: 'owners',
      fields: [{ field: 'description', rules: '{"!!":{"var":"description"}}' }],
    };
    const node = build(
      NodeType.AutomatedTask,
      NodeSubType.CollectMetadataTask,
      config
    );

    expect(node.config).toEqual(config);
    expect(node.input).toEqual(['relatedEntity']);
    expect(node).not.toHaveProperty('output');
  });

  it('gives a condition node its result output and branches', () => {
    const node = build(
      NodeType.AutomatedTask,
      NodeSubType.CheckEntityAttributesTask,
      { rules: '{"==":[1,1]}' }
    );

    expect(node.output).toEqual(['result']);
    expect(node.branches).toEqual(['true', 'false']);
  });
});
