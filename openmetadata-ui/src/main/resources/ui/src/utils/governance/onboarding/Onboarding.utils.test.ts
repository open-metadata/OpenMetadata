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
  FieldKind,
  IntakeForm,
  OnboardingStage,
  Operator,
  TargetEntityType,
  Type,
} from '../../../generated/governance/intakeForm';
import {
  checkApplies,
  getCreationIntakeFields,
  getStepState,
  stepsAtStage,
} from './Onboarding.utils';

const form: IntakeForm = {
  id: 'configuration',
  name: 'onboarding',
  entityType: TargetEntityType.Metric,
  enabled: true,
  formFields: [
    {
      fieldPath: 'displayName',
      fieldLabel: 'Display name',
      fieldKind: FieldKind.Native,
      required: true,
    },
    {
      fieldPath: 'owners',
      fieldLabel: 'Owners',
      fieldKind: FieldKind.Native,
      required: true,
    },
    {
      fieldPath: 'extension.purpose',
      fieldLabel: 'Purpose',
      fieldKind: FieldKind.CustomProperty,
      required: true,
    },
  ],
  onboarding: {
    enabled: true,
    gates: [
      {
        stage: OnboardingStage.Draft,
        steps: [
          {
            id: 'owners',
            type: Type.Field,
            fieldPath: 'owners',
            rules: { minItems: 2 },
          },
          {
            id: 'purpose',
            type: Type.Field,
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
        stepsAtStage(form, OnboardingStage.Creation).map(
          (step) => step.fieldPath
        )
      ).toEqual(['displayName']);
    }
  );

  it('preserves legacy required fields when staging is disabled', () => {
    expect(
      getCreationIntakeFields({ ...form, onboarding: undefined }).every(
        (field) => field.required
      )
    ).toBe(true);
  });

  it('evaluates custom values and relationship counts without accepting checklist flags', () => {
    const [owners, purpose] = form.onboarding?.gates?.[0].steps ?? [];

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
      type: Type.Field,
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
        { id: 'review', type: Type.Approval },
        { approved: true, completed: true }
      )
    ).toBe('Pending');
  });
});
