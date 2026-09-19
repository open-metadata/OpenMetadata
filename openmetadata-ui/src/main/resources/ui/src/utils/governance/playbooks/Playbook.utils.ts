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
  PlaybookCheckKind,
  PlaybookFieldOption,
  PlaybookStageSummary,
} from '../../../components/governance/playbooks/Playbook.types';
import {
  Assistance,
  CheckType,
  EntityStatus,
  OnboardingConfiguration,
  OnboardingGate,
  OnboardingPlaybook,
  OnboardingStageDefinition,
  Requirement,
  TargetEntityType,
} from '../../../generated/entity/governance/onboardingPlaybook';
import { CustomProperty } from '../../../generated/entity/type';
import { WorkflowDefinition } from '../../../generated/governance/workflows/workflowDefinition';
import { isRecord } from '../onboarding/Onboarding.utils';
import { dtypeOf } from '../onboarding/OnboardingField.utils';

/**
 * The lifecycle a playbook ships with when its author has not declared one. Mirrors
 * OnboardingLifecycle on the server so both ends agree on the stage vocabulary.
 *
 * <p>`published` carries no entityStatus because the platform has none - a playbook that declares it
 * tracks it as a stage and lets its handoff workflow decide what status to leave behind.
 */
export const DEFAULT_PLAYBOOK_STAGES: OnboardingStageDefinition[] = [
  { key: 'creation', displayName: 'Creation', order: 0, entryStage: true },
  {
    key: 'draft',
    displayName: 'Draft',
    order: 1,
    entityStatus: EntityStatus.Draft,
  },
  {
    key: 'inReview',
    displayName: 'In Review',
    order: 2,
    entityStatus: EntityStatus.InReview,
  },
  {
    key: 'approved',
    displayName: 'Approved',
    order: 3,
    entityStatus: EntityStatus.Approved,
  },
  { key: 'published', displayName: 'Published', order: 4 },
  {
    key: 'deprecated',
    displayName: 'Deprecated',
    order: 5,
    terminal: true,
    entityStatus: EntityStatus.Deprecated,
  },
];

/**
 * Statuses a stage may carry. `Unprocessed` is the generator's default for an unset value rather
 * than a state anyone chooses, so it is never offered.
 */
export const STAGE_STATUS_OPTIONS: EntityStatus[] = Object.values(
  EntityStatus
).filter((status) => status !== EntityStatus.Unprocessed);

export const getStages = (
  configuration?: OnboardingConfiguration
): OnboardingStageDefinition[] => {
  const declared = configuration?.stages ?? [];

  return declared.length === 0
    ? DEFAULT_PLAYBOOK_STAGES
    : [...declared].sort((a, b) => a.order - b.order);
};

export const getGateForStage = (
  configuration: OnboardingConfiguration | undefined,
  stage: string
): OnboardingGate | undefined =>
  configuration?.gates?.find((gate) => gate.stage === stage);

export const buildStageSummaries = (
  configuration: OnboardingConfiguration | undefined,
  translateStage: (stage: OnboardingStageDefinition) => string
): PlaybookStageSummary[] =>
  getStages(configuration).map((stage) => {
    const steps = getGateForStage(configuration, stage.key)?.steps ?? [];

    return {
      key: stage.key,
      label: translateStage(stage),
      checkCount: steps.length,
      blockingCount: steps.filter(
        (step) => step.requirement === Requirement.Blocking
      ).length,
      isEntry: Boolean(stage.entryStage),
      isTerminal: Boolean(stage.terminal),
    };
  });

/** The stage an asset moves to once this gate's workflow completes. */
export const getNextStage = (
  configuration: OnboardingConfiguration | undefined,
  stage: string
): OnboardingStageDefinition | undefined => {
  const stages = getStages(configuration);
  const index = stages.findIndex((candidate) => candidate.key === stage);

  return index < 0 || index + 1 >= stages.length
    ? undefined
    : stages[index + 1];
};

/**
 * Fields already captured somewhere in the playbook. A field is only ever asked for once, so the
 * check library hides anything already claimed by another gate.
 */
export const getCapturedFieldPaths = (
  configuration?: OnboardingConfiguration
): Set<string> => {
  const paths = new Set<string>();
  configuration?.gates?.forEach((gate) =>
    gate.steps?.forEach((step) => {
      if (step.fieldPath) {
        paths.add(step.fieldPath);
      }
    })
  );

  return paths;
};

/** Move a check within its gate, returning a new gate list. */
export const moveStepInGate = (
  configuration: OnboardingConfiguration,
  stage: string,
  stepId: string,
  direction: -1 | 1
): OnboardingConfiguration => ({
  ...configuration,
  gates: (configuration.gates ?? []).map((gate) => {
    if (gate.stage !== stage) {
      return gate;
    }
    const steps = [...(gate.steps ?? [])];
    const from = steps.findIndex((step) => step.id === stepId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= steps.length) {
      return gate;
    }
    [steps[from], steps[to]] = [steps[to], steps[from]];

    return { ...gate, steps };
  }),
});

/** `extension.accessRequestInfo` -> `Access request info`. */
const humanize = (fieldPath: string) => {
  const leaf = fieldPath.split('.').pop() ?? fieldPath;
  const spaced = leaf.replace(/([A-Z])/g, ' $1').trim();

  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
};

const toOption = (
  fieldPath: string,
  kind: PlaybookCheckKind,
  properties: CustomProperty[]
): PlaybookFieldOption => ({
  key: fieldPath,
  fieldPath,
  title: humanize(fieldPath),
  kind,
  dtype: dtypeOf({ type: CheckType.Attribute, fieldPath }, properties),
  toStep: () => ({
    id: fieldPath.replace(/\./g, '_'),
    title: humanize(fieldPath),
    type: CheckType.Attribute,
    requirement: Requirement.Blocking,
    assistance: Assistance.None,
    fieldPath,
    conditions: [],
  }),
});

/**
 * The only non-field check the builder offers. Assessments are deliberately absent: nothing on the
 * platform evaluates one yet, so offering it would author a check that can never pass.
 */
const APPROVAL_OPTION: PlaybookFieldOption = {
  key: 'approval',
  title: 'label.approval',
  isTitleKey: true,
  kind: 'approval',
  dtype: 'workflow',
  toStep: () => ({
    id: 'approval',
    type: CheckType.Approval,
    requirement: Requirement.Blocking,
    assistance: Assistance.None,
    conditions: [],
  }),
};

/**
 * Everything a playbook can ask for on this asset type: the entity's own fields, its custom
 * properties, and a sign-off that is not a field at all. The picker filters out any field already
 * captured at another gate.
 */
export const buildFieldOptions = (
  nativeFields: string[],
  customProperties: CustomProperty[]
): PlaybookFieldOption[] => [
  ...nativeFields.map((fieldPath) =>
    toOption(fieldPath, 'native', customProperties)
  ),
  ...customProperties.map((property) =>
    toOption(`extension.${property.name}`, 'custom', customProperties)
  ),
  APPROVAL_OPTION,
];

/** Every check id in the playbook - ids must stay unique across gates, not just within one. */
const usedStepIds = (configuration?: OnboardingConfiguration): Set<string> =>
  new Set(
    (configuration?.gates ?? []).flatMap((gate) =>
      (gate.steps ?? []).map((step) => step.id)
    )
  );

/**
 * A step id nothing else in the playbook uses. Two approvals at different gates would otherwise
 * collide, and a colliding id silently overwrites the earlier check's progress.
 */
export const uniqueStepId = (
  configuration: OnboardingConfiguration | undefined,
  base: string
): string => {
  const used = usedStepIds(configuration);
  if (!used.has(base)) {
    return base;
  }
  let suffix = 2;
  while (used.has(`${base}_${suffix}`)) {
    suffix += 1;
  }

  return `${base}_${suffix}`;
};

/**
 * Whether a workflow leaves the asset in a new status when it finishes.
 *
 * <p>A gate hands off to a workflow and stops governing until the asset arrives at the next stage.
 * A workflow that never writes the status strands it there, which the server now rejects on
 * publish - so the picker only offers workflows that do.
 */
export const setsEntityStatus = (workflow: WorkflowDefinition): boolean =>
  (workflow.nodes ?? []).some((node: Record<string, unknown>) => {
    const subType = node.subType;
    if (subType === 'setGlossaryTermStatusTask') {
      return true;
    }
    if (subType !== 'setEntityAttributeTask') {
      return false;
    }
    const config = node.config;
    const fieldName = isRecord(config) ? config.fieldName : undefined;

    return fieldName === 'status' || fieldName === 'entityStatus';
  });

const USER_APPROVAL_TASK = 'userApprovalTask';

/** A workflow a gate or a check can start at all: it exists on the engine and is not paused. */
const isRunnable = (workflow: WorkflowDefinition): boolean =>
  Boolean(workflow.id) && workflow.deployed !== false && !workflow.suspended;

/** Workflows a gate may hand off to: deployed, live, and known to set the asset's status. */
export const handoffCandidates = (
  workflows: WorkflowDefinition[]
): WorkflowDefinition[] =>
  workflows.filter(
    (workflow) => isRunnable(workflow) && setsEntityStatus(workflow)
  );

/** Started by the playbook rather than by an entity event, and it asks a person for a decision. */
const recordsADecision = (workflow: WorkflowDefinition): boolean => {
  const trigger = isRecord(workflow.trigger)
    ? workflow.trigger.type
    : undefined;

  return (
    trigger === 'noOp' &&
    (workflow.nodes ?? []).some(
      (node: Record<string, unknown>) => node.subType === USER_APPROVAL_TASK
    )
  );
};

/**
 * Workflows an approval check may use, the mirror image of a handoff: it records one decision on a
 * manual trigger and must leave the asset's status alone, because moving the asset on is the gate's
 * job. The server rejects anything else on publish, so the picker never offers it.
 */
export const approvalCandidates = (
  workflows: WorkflowDefinition[]
): WorkflowDefinition[] =>
  workflows.filter(
    (workflow) =>
      isRunnable(workflow) &&
      recordsADecision(workflow) &&
      !setsEntityStatus(workflow)
  );

/** Insert a named stage before any terminal stage and renumber so the rail stays ordered. */
export const addStage = (
  configuration: OnboardingConfiguration,
  stage: Pick<OnboardingStageDefinition, 'key' | 'displayName' | 'entityStatus'>
): OnboardingConfiguration => {
  const stages = getStages(configuration);
  const terminalIndex = stages.findIndex((candidate) => candidate.terminal);
  const insertAt = terminalIndex < 0 ? stages.length : terminalIndex;

  return {
    ...configuration,
    stages: [
      ...stages.slice(0, insertAt),
      stage as OnboardingStageDefinition,
      ...stages.slice(insertAt),
    ].map((candidate, index) => ({ ...candidate, order: index })),
  };
};

export const renameStage = (
  configuration: OnboardingConfiguration,
  key: string,
  displayName: string,
  entityStatus?: EntityStatus
): OnboardingConfiguration => ({
  ...configuration,
  stages: getStages(configuration).map((stage) =>
    stage.key === key ? { ...stage, displayName, entityStatus } : stage
  ),
});

/**
 * A stage can only go when nothing depends on it: the entry stage is where assets are created, a
 * terminal stage ends the lifecycle, and a gate with checks would take those checks with it.
 */
export const canRemoveStage = (
  configuration: OnboardingConfiguration | undefined,
  key: string
): boolean => {
  const stage = getStages(configuration).find(
    (candidate) => candidate.key === key
  );
  if (!stage || stage.entryStage || stage.terminal) {
    return false;
  }

  return (getGateForStage(configuration, key)?.steps ?? []).length === 0;
};

export const removeStage = (
  configuration: OnboardingConfiguration,
  key: string
): OnboardingConfiguration => ({
  ...configuration,
  stages: getStages(configuration)
    .filter((stage) => stage.key !== key)
    .map((stage, index) => ({ ...stage, order: index })),
  gates: (configuration.gates ?? []).filter((gate) => gate.stage !== key),
});

/**
 * A new playbook for an asset type that has none: the default lifecycle with an empty Creation gate,
 * ready to have its first checks added. Nothing is persisted until the author publishes.
 */
export const scaffoldPlaybook = (
  entityType: TargetEntityType
): OnboardingPlaybook => ({
  id: '',
  name: `${entityType}Playbook`,
  displayName: `${entityType} playbook`,
  entityType,
  onboarding: {
    enabled: true,
    stages: DEFAULT_PLAYBOOK_STAGES,
    gates: [{ stage: 'creation', steps: [], blockTransition: true }],
  },
});
