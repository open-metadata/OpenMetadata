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

import {
  OnboardingGate,
  OnboardingStageDefinition,
  OnboardingStep,
} from '../../../generated/entity/governance/onboardingPlaybook';
import { CustomProperty } from '../../../generated/entity/type';
import { WorkflowDefinition } from '../../../generated/governance/workflows/workflowDefinition';
import { PlaybookFieldOption } from './Playbook.types';
import { PlaybookCheckInspector } from './PlaybookCheckInspector';
import { PlaybookCheckList } from './PlaybookCheckList';
import { PlaybookGatePanel } from './PlaybookGatePanel';

interface PlaybookGateWorkspaceProps {
  stage: OnboardingStageDefinition;
  gate?: OnboardingGate;
  nextStageLabel: string;
  entityLabel: string;
  maintainer?: string;
  /** Deployed workflows; the gate panel and the inspector each filter to the ones they may use. */
  workflows: WorkflowDefinition[];
  approvalWorkflows: WorkflowDefinition[];
  customProperties: CustomProperty[];
  options: PlaybookFieldOption[];
  capturedFieldPaths: Set<string>;
  selectedStepId?: string;
  onSelectStep: (stepId: string) => void;
  onMoveStep: (stepId: string, direction: -1 | 1) => void;
  onAddCheck: (step: OnboardingStep) => void;
  onNewCustomProperty: () => void;
  onGateChange: (gate: OnboardingGate) => void;
  onStepChange: (step: OnboardingStep) => void;
  onStepRemove: (stepId: string) => void;
  onOpenWorkflow: (workflowId: string) => void;
}

/**
 * One gate, end to end: the checks that hold it, what happens when it passes, and the check being
 * edited. A terminal stage has nothing after it, so it shows checks without a gate panel.
 */
export const PlaybookGateWorkspace = ({
  stage,
  gate,
  nextStageLabel,
  entityLabel,
  maintainer,
  workflows,
  approvalWorkflows,
  customProperties,
  options,
  capturedFieldPaths,
  selectedStepId,
  onSelectStep,
  onMoveStep,
  onAddCheck,
  onNewCustomProperty,
  onGateChange,
  onStepChange,
  onStepRemove,
  onOpenWorkflow,
}: PlaybookGateWorkspaceProps) => {
  const steps = gate?.steps ?? [];
  const selectedStep = steps.find((step) => step.id === selectedStepId);
  const isCreationGate = Boolean(stage.entryStage);

  return (
    <div className="tw:grid tw:grid-cols-1 tw:gap-5 tw:xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="tw:flex tw:flex-col tw:gap-5">
        <PlaybookCheckList
          capturedFieldPaths={capturedFieldPaths}
          isCreationGate={isCreationGate}
          options={options}
          selectedStepId={selectedStepId}
          stageLabel={stage.displayName ?? stage.key}
          steps={steps}
          onAddCheck={onAddCheck}
          onMoveStep={onMoveStep}
          onNewCustomProperty={onNewCustomProperty}
          onSelectStep={onSelectStep}
        />

        {!stage.terminal && (
          <PlaybookGatePanel
            entityLabel={entityLabel}
            gate={
              gate ?? { stage: stage.key, steps: [], blockTransition: true }
            }
            maintainer={maintainer}
            nextStageLabel={nextStageLabel}
            workflows={workflows}
            onChange={onGateChange}
            onOpenWorkflow={onOpenWorkflow}
          />
        )}
      </div>

      {selectedStep && (
        <PlaybookCheckInspector
          approvalWorkflows={approvalWorkflows}
          customProperties={customProperties}
          isCreationGate={isCreationGate}
          position={steps.indexOf(selectedStep) + 1}
          step={selectedStep}
          onChange={onStepChange}
          onRemove={onStepRemove}
        />
      )}
    </div>
  );
};
