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

import { ConditionValue } from '../constants/WorkflowBuilder.constants';
import { WorkflowDefinition } from '../generated/governance/workflows/workflowDefinition';
import { WORKFLOW_EDGE_THEME } from './WorkflowEdgeTheme';
import { deserializeWorkflow } from './WorkflowSerializer';

const createWorkflow = (condition?: string): WorkflowDefinition => ({
  description: 'Workflow edge theme test',
  edges: [{ condition, from: 'source', to: 'target' }],
  name: 'workflowEdgeThemeTest',
  nodes: [],
});

describe('WorkflowSerializer', () => {
  it('uses semantic tokens for workflow edge roles', () => {
    expect(WORKFLOW_EDGE_THEME).toEqual({
      customBackground: 'var(--om-color-bg-brand, #EFF8FF)',
      customLabel: 'var(--om-color-fg-brand, #1570EF)',
      edge: 'var(--om-color-border-primary)',
      labelBorder: 'var(--om-color-bg-primary, #FFFFFF)',
      negativeBackground: 'var(--om-color-bg-error, #FEF3F2)',
      negativeLabel: 'var(--om-color-fg-error, #D92D20)',
      positiveBackground: 'var(--om-color-bg-success, #ECFDF3)',
      positiveLabel: 'var(--om-color-fg-success, #079455)',
      warningBackground: 'var(--om-color-bg-warning, #FFFAEB)',
      warningLabel: 'var(--om-color-fg-warning, #DC6803)',
    });
  });

  it.each([
    [
      'true',
      'TRUE',
      'var(--om-color-fg-success, #079455)',
      'var(--om-color-bg-success, #ECFDF3)',
    ],
    [
      'approve',
      ConditionValue.APPROVE,
      'var(--om-color-fg-success, #079455)',
      'var(--om-color-bg-success, #ECFDF3)',
    ],
    [
      'false',
      'FALSE',
      'var(--om-color-fg-warning, #DC6803)',
      'var(--om-color-bg-warning, #FFFAEB)',
    ],
    [
      'reject',
      ConditionValue.REJECT,
      'var(--om-color-fg-error, #D92D20)',
      'var(--om-color-bg-error, #FEF3F2)',
    ],
    [
      'qualityBand',
      'qualityBand',
      'var(--om-color-fg-brand, #1570EF)',
      'var(--om-color-bg-brand, #EFF8FF)',
    ],
  ])(
    'serializes the %s condition with theme-aware label colors',
    (condition, label, labelColor, labelBackground) => {
      const { edges } = deserializeWorkflow(createWorkflow(condition));
      const [edge] = edges;

      expect(edge).toEqual(
        expect.objectContaining({
          label,
          labelBgStyle: expect.objectContaining({
            fill: labelBackground,
            stroke: 'var(--om-color-bg-primary, #FFFFFF)',
          }),
          labelStyle: expect.objectContaining({ color: labelColor }),
          markerEnd: expect.objectContaining({
            color: 'var(--om-color-border-primary)',
          }),
          style: expect.objectContaining({
            stroke: 'var(--om-color-border-primary)',
          }),
        })
      );
    }
  );
});
