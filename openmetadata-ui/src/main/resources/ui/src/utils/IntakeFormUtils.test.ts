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

import { TFunction } from 'i18next';
import { CustomProperty } from '../generated/entity/type';
import {
  FieldKind,
  IntakeForm,
  IntakeFormField,
  RequiredField,
  TargetEntityType,
} from '../generated/governance/intakeForm';
import {
  buildIntakeFormPayload,
  computeFieldRows,
  getIntakeFormFields,
  getRequiredIntakeFormFields,
  IntakeFormFieldRow,
  toLegacyRequiredFields,
} from './IntakeFormUtils';

const identityT = ((key: string) => key) as unknown as TFunction;

const customProperty = (name: string, displayName?: string): CustomProperty =>
  ({ name, displayName } as unknown as CustomProperty);

const optionalField: IntakeFormField = {
  fieldKind: FieldKind.CustomProperty,
  fieldLabel: 'Steward',
  fieldPath: 'extension.steward',
  required: false,
};
const requiredField: IntakeFormField = {
  fieldKind: FieldKind.Native,
  fieldLabel: 'Data Product Type',
  fieldPath: 'dataProductType',
  required: true,
};

describe('IntakeFormUtils', () => {
  it('uses formFields as the current intake-form contract', () => {
    expect(
      getIntakeFormFields({
        formFields: [optionalField, requiredField],
        requiredFields: [],
      })
    ).toEqual([optionalField, requiredField]);
  });

  it('converts legacy requiredFields to required form fields', () => {
    const legacyField: RequiredField = {
      fieldKind: FieldKind.CustomProperty,
      fieldLabel: 'Steward',
      fieldPath: 'extension.steward',
    };

    expect(
      getIntakeFormFields({
        formFields: [],
        requiredFields: [legacyField],
      })
    ).toEqual([{ ...legacyField, required: true }]);
  });

  it('derives required-only views without dropping optional form fields', () => {
    const formFields = [optionalField, requiredField];

    expect(getRequiredIntakeFormFields({ formFields })).toEqual([
      requiredField,
    ]);
    expect(toLegacyRequiredFields(formFields)).toEqual([
      {
        errorMessage: undefined,
        fieldKind: FieldKind.Native,
        fieldLabel: 'Data Product Type',
        fieldPath: 'dataProductType',
      },
    ]);
  });
});

describe('computeFieldRows', () => {
  const nativeFields = [
    { path: 'displayName', labelKey: 'label.display-name' },
  ];

  it('always includes native fields and reflects the saved required flag', () => {
    const rows = computeFieldRows({
      nativeFields,
      customProperties: [],
      initialValue: {
        formFields: [
          {
            fieldKind: FieldKind.Native,
            fieldLabel: 'label.display-name',
            fieldPath: 'displayName',
            required: true,
            errorMessage: 'Required',
          },
        ],
      } as unknown as IntakeForm,
      t: identityT,
    });

    expect(rows).toEqual([
      {
        path: 'displayName',
        label: 'label.display-name',
        kind: FieldKind.Native,
        included: true,
        required: true,
        errorMessage: 'Required',
      },
    ]);
  });

  it('marks a custom property included only when the saved form selected it', () => {
    const rows = computeFieldRows({
      nativeFields: [],
      customProperties: [customProperty('steward', 'Steward')],
      initialValue: null,
      t: identityT,
    });

    expect(rows).toEqual([
      {
        path: 'extension.steward',
        label: 'Steward',
        kind: FieldKind.CustomProperty,
        included: false,
        required: false,
        errorMessage: undefined,
      },
    ]);
  });

  it('surfaces a saved custom property missing from the entity as an orphan', () => {
    const rows = computeFieldRows({
      nativeFields: [],
      customProperties: [],
      initialValue: {
        formFields: [
          {
            fieldKind: FieldKind.CustomProperty,
            fieldLabel: 'Old Prop',
            fieldPath: 'extension.old',
            required: true,
          },
        ],
      } as unknown as IntakeForm,
      t: identityT,
    });

    expect(rows).toEqual([
      {
        path: 'extension.old',
        label: 'Old Prop',
        kind: FieldKind.CustomProperty,
        included: true,
        required: true,
        errorMessage: undefined,
        isOrphan: true,
      },
    ]);
  });
});

describe('buildIntakeFormPayload', () => {
  const rows: IntakeFormFieldRow[] = [
    {
      path: 'displayName',
      label: 'Display Name',
      kind: FieldKind.Native,
      included: true,
      required: false,
    },
    {
      path: 'owners',
      label: 'Owners',
      kind: FieldKind.Native,
      included: true,
      required: true,
      errorMessage: 'Pick an owner',
    },
    {
      path: 'extension.steward',
      label: 'Steward',
      kind: FieldKind.CustomProperty,
      included: true,
      required: false,
      errorMessage: 'ignored when optional',
    },
    {
      path: 'extension.unused',
      label: 'Unused',
      kind: FieldKind.CustomProperty,
      included: false,
      required: false,
    },
  ];

  it('persists required natives, included customs, and drops optional error messages', () => {
    const payload = buildIntakeFormPayload({
      rows,
      entityType: TargetEntityType.DataProduct,
      name: 'dataProduct',
      displayName: 'Data Product Intake',
      description: '',
      enabled: true,
      owners: [{ id: 'u1', type: 'user' }],
    });

    expect(payload).toEqual({
      name: 'dataProduct',
      displayName: 'Data Product Intake',
      description: undefined,
      entityType: TargetEntityType.DataProduct,
      enabled: true,
      formFields: [
        {
          fieldPath: 'owners',
          fieldLabel: 'Owners',
          fieldKind: FieldKind.Native,
          required: true,
          errorMessage: 'Pick an owner',
        },
        {
          fieldPath: 'extension.steward',
          fieldLabel: 'Steward',
          fieldKind: FieldKind.CustomProperty,
          required: false,
          errorMessage: undefined,
        },
      ],
      requiredFields: [
        {
          errorMessage: 'Pick an owner',
          fieldKind: FieldKind.Native,
          fieldLabel: 'Owners',
          fieldPath: 'owners',
        },
      ],
      owners: [{ id: 'u1', type: 'user' }],
    });
  });

  it('omits owners when none are provided', () => {
    const payload = buildIntakeFormPayload({
      rows: [],
      entityType: TargetEntityType.Domain,
      name: 'domain',
      displayName: 'Domain Intake',
      description: 'desc',
      enabled: false,
    });

    expect(payload.owners).toBeUndefined();
    expect(payload.description).toBe('desc');
    expect(payload.formFields).toEqual([]);
  });
});
