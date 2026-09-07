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
  IntakeForm,
  IntakeFormField,
  RequiredField,
} from '../generated/governance/intakeForm';

type IntakeFormFieldConfiguration = Pick<
  IntakeForm,
  'formFields' | 'requiredFields'
>;

export const getIntakeFormFields = (
  intakeForm?: IntakeFormFieldConfiguration | null
): IntakeFormField[] => {
  if (intakeForm?.formFields?.length || !intakeForm?.requiredFields?.length) {
    return intakeForm?.formFields ?? [];
  }

  return (intakeForm?.requiredFields ?? []).map((field) => ({
    ...field,
    required: true,
  }));
};

export const getRequiredIntakeFormFields = (
  intakeForm?: IntakeFormFieldConfiguration | null
): IntakeFormField[] =>
  getIntakeFormFields(intakeForm).filter((field) => field.required);

export const toLegacyRequiredFields = (
  formFields: IntakeFormField[]
): RequiredField[] =>
  formFields
    .filter((field) => field.required)
    .map(({ errorMessage, fieldKind, fieldLabel, fieldPath }) => ({
      errorMessage,
      fieldKind,
      fieldLabel,
      fieldPath,
    }));
