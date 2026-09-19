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
  CheckType,
  EntityStatus,
  OnboardingConfiguration,
  Requirement,
} from '../../../generated/entity/governance/onboardingPlaybook';
import { CustomProperty } from '../../../generated/entity/type';
import { WorkflowDefinition } from '../../../generated/governance/workflows/workflowDefinition';
import {
  addStage,
  approvalCandidates,
  buildFieldOptions,
  buildStageSummaries,
  canRemoveStage,
  DEFAULT_PLAYBOOK_STAGES,
  getCapturedFieldPaths,
  getGateForStage,
  getNextStage,
  getStages,
  handoffCandidates,
  moveStepInGate,
  removeStage,
  renameStage,
  scaffoldPlaybook,
  STAGE_STATUS_OPTIONS,
  uniqueStepId,
} from './Playbook.utils';

const costCentre: CustomProperty = {
  name: 'costCentre',
  description: 'Cost centre',
  propertyType: { id: 'p1', type: 'type', name: 'string' },
};

const workflow = (
  name: string,
  overrides: Partial<WorkflowDefinition>
): WorkflowDefinition =>
  ({
    id: name,
    name,
    deployed: true,
    ...overrides,
  } as WorkflowDefinition);

const configuration: OnboardingConfiguration = {
  enabled: true,
  gates: [
    {
      stage: 'creation',
      steps: [
        {
          id: 'displayName',
          type: CheckType.Attribute,
          requirement: Requirement.Blocking,
          fieldPath: 'displayName',
        },
        {
          id: 'tags',
          type: CheckType.Relationship,
          requirement: Requirement.Recommended,
          fieldPath: 'tags',
        },
      ],
    },
    {
      stage: 'draft',
      steps: [
        {
          id: 'description',
          type: CheckType.Attribute,
          requirement: Requirement.Blocking,
          fieldPath: 'description',
        },
      ],
    },
  ],
};

describe('playbook lifecycle', () => {
  it('falls back to the default lifecycle when the playbook declares none', () => {
    expect(getStages(configuration).map((stage) => stage.key)).toEqual([
      'creation',
      'draft',
      'inReview',
      'approved',
      'published',
      'deprecated',
    ]);
  });

  it('orders a declared lifecycle by its order field, not array position', () => {
    const declared = getStages({
      stages: [
        { key: 'second', order: 1 },
        { key: 'first', order: 0 },
      ],
    });

    expect(declared.map((stage) => stage.key)).toEqual(['first', 'second']);
  });

  it('counts only blocking checks as gate blockers', () => {
    const summaries = buildStageSummaries(configuration, (stage) => stage.key);
    const creation = summaries.find((stage) => stage.key === 'creation');

    expect(creation?.checkCount).toBe(2);
    expect(creation?.blockingCount).toBe(1);
  });

  it('reports the stage an asset moves to once the gate workflow completes', () => {
    expect(getNextStage(configuration, 'draft')?.key).toBe('inReview');
  });

  it('has no next stage past the terminal one', () => {
    expect(getNextStage(configuration, 'deprecated')).toBeUndefined();
  });
});

describe('playbook checks', () => {
  it('finds the gate governing a stage', () => {
    expect(getGateForStage(configuration, 'draft')?.steps).toHaveLength(1);
  });

  it('collects every field captured anywhere in the playbook', () => {
    expect([...getCapturedFieldPaths(configuration)].sort()).toEqual([
      'description',
      'displayName',
      'tags',
    ]);
  });

  it('moves a check within its gate', () => {
    const moved = moveStepInGate(configuration, 'creation', 'tags', -1);

    expect(moved.gates?.[0].steps?.map((step) => step.id)).toEqual([
      'tags',
      'displayName',
    ]);
  });

  it('leaves the gate untouched when a move would fall off either end', () => {
    const moved = moveStepInGate(configuration, 'creation', 'displayName', -1);

    expect(moved.gates?.[0].steps?.map((step) => step.id)).toEqual([
      'displayName',
      'tags',
    ]);
  });

  it('builds a blocking attribute check from a field option', () => {
    const [option] = buildFieldOptions(['displayName'], []);
    const step = option.toStep();

    expect(option).toMatchObject({ kind: 'native', dtype: 'string' });
    expect(step).toMatchObject({
      fieldPath: 'displayName',
      type: CheckType.Attribute,
      requirement: Requirement.Blocking,
    });
  });

  it('marks custom properties with the extension prefix and their own dtype', () => {
    const [, custom] = buildFieldOptions(['displayName'], [costCentre]);

    expect(custom.fieldPath).toBe('extension.costCentre');
    expect(custom.kind).toBe('custom');
    expect(custom.dtype).toBe('string');
  });

  it('offers an approval that is not a field, last', () => {
    const options = buildFieldOptions(['displayName'], [costCentre]);
    const approval = options[options.length - 1];

    expect(approval).toMatchObject({
      key: 'approval',
      kind: 'approval',
      dtype: 'workflow',
      isTitleKey: true,
    });
    expect(approval.fieldPath).toBeUndefined();
    expect(approval.toStep().type).toBe(CheckType.Approval);
  });

  it('reads native dtypes from the field name', () => {
    const [description, tags, owners] = buildFieldOptions(
      ['description', 'tags', 'owners'],
      []
    );

    expect([description.dtype, tags.dtype, owners.dtype]).toEqual([
      'markdown',
      'tag[]',
      'user[]',
    ]);
  });
});

describe('Playbook stage helpers', () => {
  it('mirrors the server lifecycle: a status per stage except creation and published', () => {
    expect(
      DEFAULT_PLAYBOOK_STAGES.map((stage) => [stage.key, stage.entityStatus])
    ).toEqual([
      ['creation', undefined],
      ['draft', EntityStatus.Draft],
      ['inReview', EntityStatus.InReview],
      ['approved', EntityStatus.Approved],
      ['published', undefined],
      ['deprecated', EntityStatus.Deprecated],
    ]);
  });

  it('never offers Unprocessed as a stage status', () => {
    expect(STAGE_STATUS_OPTIONS).not.toContain(EntityStatus.Unprocessed);
    expect(STAGE_STATUS_OPTIONS).toContain(EntityStatus.Draft);
  });

  it('scaffolds a playbook on the default lifecycle with an empty creation gate', () => {
    const playbook = scaffoldPlaybook(
      'dataProduct' as Parameters<typeof scaffoldPlaybook>[0]
    );

    expect(playbook.onboarding?.stages).toEqual(DEFAULT_PLAYBOOK_STAGES);
    expect(playbook.onboarding?.gates).toEqual([
      { stage: 'creation', steps: [], blockTransition: true },
    ]);
  });

  it('inserts a new stage before the terminal one and renumbers', () => {
    const next = addStage(configuration, {
      key: 'stage1',
      displayName: 'Certified',
    });
    const stages = next.stages ?? [];

    expect(stages.map((stage) => stage.key)).toEqual([
      'creation',
      'draft',
      'inReview',
      'approved',
      'published',
      'stage1',
      'deprecated',
    ]);
    expect(stages.map((stage) => stage.order)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(stages[5].entityStatus).toBeUndefined();
  });

  it('keeps a user-added stage free of a status unless one is picked', () => {
    const picked = addStage(configuration, {
      key: 'stage1',
      displayName: 'Certified',
      entityStatus: EntityStatus.Approved,
    });

    expect(
      picked.stages?.find((stage) => stage.key === 'stage1')?.entityStatus
    ).toBe(EntityStatus.Approved);
  });

  it('renames a stage and rewrites its status', () => {
    const next = renameStage(
      configuration,
      'draft',
      'Working copy',
      EntityStatus.Draft
    );

    expect(next.stages?.find((stage) => stage.key === 'draft')).toMatchObject({
      displayName: 'Working copy',
      entityStatus: EntityStatus.Draft,
    });
  });

  it('refuses to remove the entry stage, a terminal stage, or one with checks', () => {
    expect(canRemoveStage(configuration, 'creation')).toBe(false);
    expect(canRemoveStage(configuration, 'deprecated')).toBe(false);
    expect(canRemoveStage(configuration, 'draft')).toBe(false);
    expect(canRemoveStage(configuration, 'approved')).toBe(true);
  });

  it('drops the stage and its gate, then renumbers', () => {
    const next = removeStage(configuration, 'approved');

    expect(next.stages?.map((stage) => stage.key)).not.toContain('approved');
    expect(next.stages?.map((stage) => stage.order)).toEqual([0, 1, 2, 3, 4]);
  });

  it('gives a colliding check id a free suffix', () => {
    expect(uniqueStepId(configuration, 'approval')).toBe('approval');
    expect(uniqueStepId(configuration, 'displayName')).toBe('displayName_2');
  });
});

describe('Playbook workflow candidates', () => {
  const setsStatus = workflow('handoff', {
    nodes: [
      { subType: 'setEntityAttributeTask', config: { fieldName: 'status' } },
    ],
    trigger: { type: 'eventBasedEntity' },
  } as Partial<WorkflowDefinition>);
  const records = workflow('approval', {
    nodes: [{ subType: 'userApprovalTask' }],
    trigger: { type: 'noOp' },
  } as Partial<WorkflowDefinition>);
  const glossary = workflow('glossary', {
    nodes: [{ subType: 'setGlossaryTermStatusTask' }],
    trigger: { type: 'eventBasedEntity' },
  } as Partial<WorkflowDefinition>);

  it('offers only workflows that write the asset status as a handoff', () => {
    expect(
      handoffCandidates([setsStatus, records, glossary]).map(
        (item) => item.name
      )
    ).toEqual(['handoff', 'glossary']);
  });

  it('offers only manually triggered approval tasks that leave the status alone', () => {
    expect(
      approvalCandidates([setsStatus, records, glossary]).map(
        (item) => item.name
      )
    ).toEqual(['approval']);
  });

  it('never offers a suspended or undeployed workflow', () => {
    const suspended = workflow('suspended', {
      nodes: [{ subType: 'userApprovalTask' }],
      trigger: { type: 'noOp' },
      suspended: true,
    } as Partial<WorkflowDefinition>);
    const undeployed = workflow('undeployed', {
      nodes: [
        { subType: 'setEntityAttributeTask', config: { fieldName: 'status' } },
      ],
      deployed: false,
    } as Partial<WorkflowDefinition>);

    expect(approvalCandidates([suspended])).toEqual([]);
    expect(handoffCandidates([undeployed])).toEqual([]);
  });
});
