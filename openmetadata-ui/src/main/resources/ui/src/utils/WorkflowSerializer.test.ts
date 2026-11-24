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
      customBackground: 'var(--tw-color-utility-brand-50)',
      customLabel: 'var(--tw-color-utility-brand-600)',
      edge: 'var(--om-color-border-hover)',
      labelBorder: 'var(--tw-background-color-primary)',
      negativeBackground: 'var(--tw-color-utility-error-50)',
      negativeLabel: 'var(--tw-color-utility-error-600)',
      positiveBackground: 'var(--tw-color-utility-success-50)',
      positiveLabel: 'var(--tw-color-utility-success-600)',
      warningBackground: 'var(--tw-color-utility-warning-50)',
      warningLabel: 'var(--tw-color-utility-warning-600)',
    });
  });

  it.each([
    [
      'true',
      'TRUE',
      'var(--tw-color-utility-success-600)',
      'var(--tw-color-utility-success-50)',
    ],
    [
      'approve',
      ConditionValue.APPROVE,
      'var(--tw-color-utility-success-600)',
      'var(--tw-color-utility-success-50)',
    ],
    [
      'false',
      'FALSE',
      'var(--tw-color-utility-warning-600)',
      'var(--tw-color-utility-warning-50)',
    ],
    [
      'reject',
      ConditionValue.REJECT,
      'var(--tw-color-utility-error-600)',
      'var(--tw-color-utility-error-50)',
    ],
    [
      'qualityBand',
      'qualityBand',
      'var(--tw-color-utility-brand-600)',
      'var(--tw-color-utility-brand-50)',
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
            stroke: 'var(--tw-background-color-primary)',
          }),
          labelStyle: expect.objectContaining({ color: labelColor }),
          markerEnd: expect.objectContaining({
            color: 'var(--om-color-border-hover)',
          }),
          style: expect.objectContaining({
            stroke: 'var(--om-color-border-hover)',
          }),
        })
      );
    }
  );
});
