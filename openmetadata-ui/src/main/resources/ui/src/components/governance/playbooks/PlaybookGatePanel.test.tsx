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

import { fireEvent, render, screen } from '@testing-library/react';
import { OnboardingGate } from '../../../generated/entity/governance/onboardingPlaybook';
import { WorkflowDefinition } from '../../../generated/governance/workflows/workflowDefinition';
import { PlaybookGatePanel } from './PlaybookGatePanel';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/** Only a workflow that writes the asset status may be handed off to, so every fixture has one. */
const setsStatus: NonNullable<WorkflowDefinition['nodes']> = [
  { subType: 'setEntityAttributeTask', config: { fieldName: 'status' } },
];

const workflow = (
  id: string,
  displayName: string,
  nodes: NonNullable<WorkflowDefinition['nodes']> = setsStatus
): WorkflowDefinition =>
  ({ id, name: id, displayName, deployed: true, nodes } as WorkflowDefinition);

const workflows = [
  workflow('wf-1', 'Data Product Review & Approval'),
  workflow('wf-2', 'Security Sign-off'),
];

const gate: OnboardingGate = {
  stage: 'draft',
  steps: [],
  blockTransition: true,
};

const renderPanel = (
  overrides: Partial<OnboardingGate> = {},
  available: WorkflowDefinition[] = workflows
) => {
  const onChange = jest.fn();
  render(
    <PlaybookGatePanel
      entityLabel="Data Product"
      gate={{ ...gate, ...overrides }}
      maintainer="Data Management"
      nextStageLabel="In Review"
      workflows={available}
      onChange={onChange}
      onOpenWorkflow={jest.fn()}
    />
  );

  return onChange;
};

describe('PlaybookGatePanel', () => {
  it('records the workflow a passed gate hands off to', async () => {
    const onChange = renderPanel();

    fireEvent.click(
      screen.getByRole('button', {
        name: /message.when-every-check-passes-hand-off-to/,
      })
    );
    fireEvent.click(
      await screen.findByRole('option', {
        name: 'Data Product Review & Approval',
      })
    );

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        handoffWorkflow: expect.objectContaining({
          id: 'wf-1',
          type: 'workflowDefinition',
        }),
      })
    );
  });

  it('lets a gate warn instead of hard-stopping the transition', () => {
    const onChange = renderPanel();

    fireEvent.click(screen.getByTestId('block-transition'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ blockTransition: false })
    );
  });

  it('defaults the stall notification to five days when first enabled', () => {
    const onChange = renderPanel();

    fireEvent.click(screen.getByTestId('notify-on-stall'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        notifyOnStall: { enabled: true, afterDays: 5 },
      })
    );
  });

  it('keeps a configured stall window when the toggle is flipped', () => {
    const onChange = renderPanel({
      notifyOnStall: { enabled: false, afterDays: 21 },
    });

    fireEvent.click(screen.getByTestId('notify-on-stall'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        notifyOnStall: { enabled: true, afterDays: 21 },
      })
    );
  });

  it('says nothing moves on while the gate blocks, and who is told when it does not', () => {
    const { rerender } = render(
      <PlaybookGatePanel
        entityLabel="Data Product"
        gate={gate}
        maintainer="Data Management"
        nextStageLabel="In Review"
        workflows={workflows}
        onChange={jest.fn()}
        onOpenWorkflow={jest.fn()}
      />
    );

    expect(screen.getByTestId('gate-sentence')).toHaveTextContent(
      'message.gate-blocking-explanation'
    );

    rerender(
      <PlaybookGatePanel
        entityLabel="Data Product"
        gate={{ ...gate, blockTransition: false }}
        maintainer="Data Management"
        nextStageLabel="In Review"
        workflows={workflows}
        onChange={jest.fn()}
        onOpenWorkflow={jest.fn()}
      />
    );

    expect(screen.getByTestId('gate-sentence')).toHaveTextContent(
      'message.gate-non-blocking-explanation'
    );
  });

  it('warns when no deployed workflow can move the asset on', () => {
    renderPanel({}, [workflow('wf-3', 'No status', [])]);

    expect(screen.getByTestId('handoff-hint')).toHaveTextContent(
      'message.no-workflow-sets-the-status'
    );
  });
});
