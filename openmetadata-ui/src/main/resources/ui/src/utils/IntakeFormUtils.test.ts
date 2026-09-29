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
  IntakeFormField,
  RequiredField,
} from '../generated/governance/intakeForm';
import {
  getIntakeFormFields,
  getRequiredIntakeFormFields,
  toLegacyRequiredFields,
} from './IntakeFormUtils';

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
