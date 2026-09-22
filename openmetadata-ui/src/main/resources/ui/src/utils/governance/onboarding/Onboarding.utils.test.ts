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
  OnboardingPlaybook,
  Operator,
  Requirement,
  TargetEntityType,
} from '../../../generated/entity/governance/onboardingPlaybook';
import {
  applicableSteps,
  checkApplies,
  conditionalTriggers,
  getCreationIntakeFields,
  getStepState,
  missingCreationChecks,
  stepsAtStage,
} from './Onboarding.utils';

const form: OnboardingPlaybook = {
  id: 'configuration',
  name: 'onboarding',
  entityType: TargetEntityType.Metric,
  onboarding: {
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
        ],
      },
      {
        stage: 'draft',
        steps: [
          {
            id: 'owners',
            type: CheckType.Attribute,
            fieldPath: 'owners',
            rules: { minItems: 2 },
          },
          {
            id: 'purpose',
            type: CheckType.Attribute,
            fieldPath: 'extension.purpose',
            rules: { minLength: 10 },
          },
        ],
      },
    ],
  },
};

describe('onboarding field requirements', () => {
  it.each(Object.values(TargetEntityType))(
    'keeps unstaged requirements at Creation for %s',
    (entityType) => {
      const fields = getCreationIntakeFields({ ...form, entityType });

      expect(
        fields.filter((field) => field.required).map((field) => field.fieldPath)
      ).toEqual(['displayName']);
      expect(
        stepsAtStage(form, 'creation').map((step) => step.fieldPath)
      ).toEqual(['displayName']);
    }
  );

  it('enforces nothing at creation when no playbook governs the asset type', () => {
    expect(getCreationIntakeFields({ ...form, onboarding: undefined })).toEqual(
      []
    );
  });

  it('evaluates custom values and relationship counts without accepting checklist flags', () => {
    const [owners, purpose] =
      form.onboarding?.gates?.find((gate) => gate.stage === 'draft')?.steps ??
      [];

    expect(
      getStepState(owners, { owners: [{ id: 'a' }], complete: true })
    ).toBe('Pending');
    expect(getStepState(owners, { owners: [{ id: 'a' }, { id: 'b' }] })).toBe(
      'Complete'
    );
    expect(getStepState(purpose, { extension: { purpose: '  brief  ' } })).toBe(
      'Pending'
    );
    expect(
      getStepState(purpose, {
        extension: { purpose: 'Measures fulfilled orders' },
      })
    ).toBe('Complete');
  });

  it('evaluates tag, domain and typed field conditions together', () => {
    const step = {
      id: 'conditional',
      type: CheckType.Attribute,
      fieldPath: 'displayName',
      conditions: [
        {
          fieldPath: 'tags',
          operator: Operator.Contains,
          value: 'PII.Sensitive',
        },
        { fieldPath: 'domains', operator: Operator.Contains, value: 'Finance' },
        {
          fieldPath: 'extension.regulated',
          operator: Operator.Equals,
          value: false,
        },
      ],
    };
    const values = {
      tags: [{ tagFQN: 'PII.Sensitive' }],
      domains: [{ fullyQualifiedName: 'Finance' }],
      extension: { regulated: false },
    };

    expect(checkApplies(step, values)).toBe(true);
    expect(getStepState(step, values)).toBe('Pending');
    expect(getStepState(step, { ...values, domains: [] })).toBe(
      'NotApplicable'
    );
  });

  it('never marks an approval complete from draft values', () => {
    expect(
      getStepState(
        { id: 'review', type: CheckType.Approval },
        { approved: true, completed: true }
      )
    ).toBe('Pending');
  });
});

describe('creation gate helpers', () => {
  const playbook = {
    id: 'playbook',
    name: 'dataProduct',
    entityType: TargetEntityType.DataProduct,
    onboarding: {
      enabled: true,
      gates: [
        {
          stage: 'creation',
          steps: [
            {
              id: 'displayName',
              type: CheckType.Attribute,
              title: 'Name & display name',
              fieldPath: 'displayName',
              requirement: Requirement.Blocking,
              rules: { minLength: 3 },
            },
            {
              id: 'tags',
              type: CheckType.Relationship,
              title: 'Tags',
              fieldPath: 'tags',
              requirement: Requirement.Recommended,
            },
          ],
        },
        {
          stage: 'draft',
          steps: [
            {
              id: 'experts',
              type: CheckType.Responsibility,
              title: 'Experts',
              fieldPath: 'experts',
              requirement: Requirement.Optional,
            },
            {
              id: 'certification',
              type: CheckType.Attribute,
              title: 'Certification',
              fieldPath: 'certification',
              requirement: Requirement.Blocking,
              conditions: [
                {
                  fieldPath: 'tags',
                  operator: Operator.StartsWith,
                  value: 'PII.',
                },
              ],
            },
          ],
        },
      ],
    },
  } as unknown as Parameters<typeof missingCreationChecks>[0];

  it('matches a tag classification by prefix rather than by exact name', () => {
    const step = {
      id: 'conditional',
      type: CheckType.Attribute,
      conditions: [
        { fieldPath: 'tags', operator: Operator.StartsWith, value: 'PII.' },
      ],
    };

    expect(checkApplies(step, { tags: [{ tagFQN: 'PII.Sensitive' }] })).toBe(
      true
    );
    expect(checkApplies(step, { tags: [{ tagFQN: 'NonPII.Safe' }] })).toBe(
      false
    );
  });

  it('keeps a blocking creation check open until its rule passes, not merely until it is filled', () => {
    expect(
      missingCreationChecks(playbook, { displayName: 'ab' }).map(
        (step) => step.id
      )
    ).toEqual(['displayName']);
    expect(missingCreationChecks(playbook, { displayName: 'Orders' })).toEqual(
      []
    );
  });

  it('counts only the later checks this asset actually earns', () => {
    expect(
      applicableSteps(playbook, 'draft', {}).map((step) => step.id)
    ).toEqual(['experts']);
    expect(
      applicableSteps(playbook, 'draft', {
        tags: [{ tagFQN: 'PII.Sensitive' }],
      }).map((step) => step.id)
    ).toEqual(['experts', 'certification']);
  });

  it('names the value that switched a conditional check on', () => {
    expect(
      conditionalTriggers(playbook, 'draft', {
        tags: [{ tagFQN: 'PII.Sensitive' }],
      })
    ).toEqual([
      {
        value: 'PII.Sensitive',
        steps: [expect.objectContaining({ id: 'certification' })],
      },
    ]);
    expect(conditionalTriggers(playbook, 'draft', {})).toEqual([]);
  });
});
