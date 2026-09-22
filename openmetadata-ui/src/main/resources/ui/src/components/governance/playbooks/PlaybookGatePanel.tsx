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
  Button,
  Select,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import { Lock, PlannerRouting } from '@openmetadata/ui-core-components/icons';
import { ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { OnboardingGate } from '../../../generated/entity/governance/onboardingPlaybook';
import { WorkflowDefinition } from '../../../generated/governance/workflows/workflowDefinition';
import { handoffCandidates } from '../../../utils/governance/playbooks/Playbook.utils';

interface PlaybookGatePanelProps {
  gate: OnboardingGate;
  nextStageLabel: string;
  /** The asset noun used in the stall copy - `product`, `term`, `metric`. */
  entityLabel: string;
  /** Who is told when an asset stalls; the playbook's owner when it has one. */
  maintainer?: string;
  workflows: WorkflowDefinition[];
  onChange: (gate: OnboardingGate) => void;
  onOpenWorkflow: (workflowId: string) => void;
}

interface GateSwitchProps {
  testId: string;
  label: string;
  hint: ReactNode;
  isSelected: boolean;
  onChange: (isSelected: boolean) => void;
}

/**
 * A gate option. The switch sits opposite its description rather than beside it, so the three
 * options read as a list of settings instead of a stack of labelled controls.
 */
const GateSwitch = ({
  testId,
  label,
  hint,
  isSelected,
  onChange,
}: GateSwitchProps) => (
  <div className="tw:flex tw:items-center tw:justify-between tw:gap-6 tw:border-t tw:border-secondary tw:py-4">
    <div className="tw:flex tw:flex-col tw:gap-0.5">
      <Typography className="tw:text-sm tw:font-medium tw:text-primary">
        {label}
      </Typography>
      <Typography className="tw:text-sm tw:text-tertiary">{hint}</Typography>
    </div>
    <Toggle
      aria-label={label}
      data-testid={testId}
      isSelected={isSelected}
      size="md"
      onChange={onChange}
    />
  </div>
);

interface HandoffCalloutProps {
  workflows: WorkflowDefinition[];
  selectedWorkflowId?: string;
  onSelect: (workflowId: string) => void;
  onOpenWorkflow: (workflowId: string) => void;
}

/**
 * Where the gate hands the asset over. Only workflows that write the asset's status are offered: a
 * workflow that never does strands the asset at this stage, and the server rejects it on publish.
 */
const HandoffCallout = ({
  workflows,
  selectedWorkflowId,
  onSelect,
  onOpenWorkflow,
}: HandoffCalloutProps) => {
  const { t } = useTranslation();
  const candidates = useMemo(() => handoffCandidates(workflows), [workflows]);

  return (
    <div className="tw:mt-4 tw:mb-2 tw:rounded-lg tw:border tw:border-brand tw:bg-brand-primary tw:p-4">
      <Typography className="tw:block tw:pl-8 tw:text-sm tw:font-semibold tw:text-primary">
        {t('message.when-every-check-passes-hand-off-to')}
      </Typography>
      <div className="tw:mt-1.5 tw:flex tw:items-center tw:gap-3">
        <PlannerRouting
          aria-hidden
          className="tw:h-5 tw:w-5 tw:flex-none tw:text-brand-secondary"
        />
        <Select
          aria-label={t('message.when-every-check-passes-hand-off-to')}
          className="tw:w-full tw:max-w-md"
          data-testid="handoff-workflow"
          placeholder={t('label.select-a-workflow')}
          selectedKey={selectedWorkflowId}
          onSelectionChange={(key) => onSelect(String(key))}>
          {candidates.map((workflow) => (
            <Select.Item
              id={workflow.id as string}
              key={workflow.id}
              label={workflow.displayName ?? workflow.name}>
              {workflow.displayName ?? workflow.name}
            </Select.Item>
          ))}
        </Select>
        <div className="tw:flex-1" />
        {selectedWorkflowId && (
          <Button
            color="link-color"
            data-testid="open-in-workflows"
            size="sm"
            onPress={() => onOpenWorkflow(selectedWorkflowId)}>
            {t('label.open-in-workflows')}
          </Button>
        )}
      </div>
      <Typography
        className="tw:mt-1.5 tw:block tw:pl-8 tw:text-xs tw:text-tertiary"
        data-testid="handoff-hint">
        {candidates.length === 0
          ? t('message.no-workflow-sets-the-status')
          : t('message.playbook-only-decides-when-workflow-starts')}
      </Typography>
    </div>
  );
};

/**
 * What happens when a gate passes.
 *
 * <p>The playbook does not approve anything or move the asset itself - it starts the workflow named
 * here, and that workflow owns the decision and the status change that follows. This panel is
 * therefore about timing, not authority.
 */
export const PlaybookGatePanel = ({
  gate,
  nextStageLabel,
  entityLabel,
  maintainer,
  workflows,
  onChange,
  onOpenWorkflow,
}: PlaybookGatePanelProps) => {
  const { t } = useTranslation();
  const isBlocking = gate.blockTransition ?? true;

  const handleWorkflowChange = (workflowId: string) => {
    const workflow = workflows.find((candidate) => candidate.id === workflowId);
    onChange({
      ...gate,
      handoffWorkflow: workflow
        ? {
            id: workflow.id ?? '',
            type: 'workflowDefinition',
            name: workflow.name,
            fullyQualifiedName: workflow.fullyQualifiedName,
          }
        : undefined,
    });
  };

  return (
    <section
      aria-label={t('label.the-gate-itself')}
      className="tw:rounded-xl tw:border tw:border-secondary tw:bg-primary tw:p-5">
      <div className="tw:flex tw:items-center tw:gap-2">
        <Lock aria-hidden className="tw:h-4 tw:w-4 tw:text-brand-secondary" />
        <Typography className="tw:text-sm tw:font-semibold tw:text-primary">
          {t('label.the-gate-itself')}
        </Typography>
      </div>

      <Typography
        className="tw:mt-2 tw:block tw:max-w-xl tw:text-sm tw:text-secondary"
        data-testid="gate-sentence">
        {isBlocking
          ? t('message.gate-blocking-explanation', { stage: nextStageLabel })
          : t('message.gate-non-blocking-explanation', {
              maintainer: maintainer ?? t('label.the-maintainer'),
              stage: nextStageLabel,
            })}
      </Typography>

      <HandoffCallout
        selectedWorkflowId={gate.handoffWorkflow?.id}
        workflows={workflows}
        onOpenWorkflow={onOpenWorkflow}
        onSelect={handleWorkflowChange}
      />

      <GateSwitch
        hint={t('message.block-the-transition-hint')}
        isSelected={isBlocking}
        label={t('label.block-the-transition')}
        testId="block-transition"
        onChange={(isSelected) =>
          onChange({ ...gate, blockTransition: isSelected })
        }
      />

      <GateSwitch
        hint={t('message.notify-on-stall-hint', {
          days: gate.notifyOnStall?.afterDays ?? 5,
        })}
        isSelected={gate.notifyOnStall?.enabled ?? false}
        label={t('label.tell-owner-when-entity-stalls', {
          owner: maintainer ?? t('label.the-maintainer'),
          entity: entityLabel.toLowerCase(),
        })}
        testId="notify-on-stall"
        onChange={(isSelected) =>
          onChange({
            ...gate,
            notifyOnStall: {
              ...gate.notifyOnStall,
              enabled: isSelected,
              afterDays: gate.notifyOnStall?.afterDays ?? 5,
            },
          })
        }
      />

      <GateSwitch
        hint={t('message.reassign-on-stall-hint')}
        isSelected={gate.reassignOnStall?.enabled ?? false}
        label={t('label.reassign-after-days', {
          days: gate.reassignOnStall?.afterDays ?? 10,
        })}
        testId="reassign-on-stall"
        onChange={(isSelected) =>
          onChange({
            ...gate,
            reassignOnStall: {
              ...gate.reassignOnStall,
              enabled: isSelected,
              afterDays: gate.reassignOnStall?.afterDays ?? 10,
            },
          })
        }
      />
    </section>
  );
};
