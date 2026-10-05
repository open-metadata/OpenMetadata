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

import type { TFunction } from 'i18next';
import { CreateIntakeForm } from '../generated/api/governance/createIntakeForm';
import { CustomProperty } from '../generated/entity/type';
import {
  FieldKind,
  IntakeForm,
  IntakeFormField,
  RequiredField,
  TargetEntityType,
} from '../generated/governance/intakeForm';

type IntakeFormFieldConfiguration = Pick<
  IntakeForm,
  'formFields' | 'requiredFields'
>;

/** i18n key for each TargetEntityType's display label. Resolve with t(). */
export const ENTITY_TYPE_LABEL_KEYS: Record<TargetEntityType, string> = {
  [TargetEntityType.Metric]: 'label.metric',
  [TargetEntityType.DataProduct]: 'label.data-product',
  [TargetEntityType.Domain]: 'label.domain',
  [TargetEntityType.GlossaryTerm]: 'label.glossary-term',
};

/** A single editable row in the IntakeForm designer field tables. */
export interface IntakeFormFieldRow {
  path: string;
  label: string;
  kind: FieldKind;
  included: boolean;
  required: boolean;
  errorMessage?: string;
  isOrphan?: boolean;
}

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

/**
 * Build the designer's editable field rows: native fields (always listed), the
 * entity's current custom properties, and any custom property that the saved
 * form still references but that no longer exists on the entity (orphan).
 */
export const computeFieldRows = ({
  nativeFields,
  customProperties,
  initialValue,
  t,
}: {
  nativeFields: { path: string; labelKey: string }[];
  customProperties: CustomProperty[];
  initialValue?: IntakeFormFieldConfiguration | null;
  t: TFunction;
}): IntakeFormFieldRow[] => {
  const existingSelections = new Map<string, IntakeFormField>(
    getIntakeFormFields(initialValue).map((field) => [field.fieldPath, field])
  );

  const nativeRows: IntakeFormFieldRow[] = nativeFields.map((nf) => {
    const existing = existingSelections.get(nf.path);

    return {
      path: nf.path,
      label: t(nf.labelKey),
      kind: FieldKind.Native,
      included: true,
      required: Boolean(existing?.required),
      errorMessage: existing?.errorMessage,
    };
  });

  const customPropertyPaths = new Set(
    customProperties.map((cp) => `extension.${cp.name}`)
  );
  const customRows: IntakeFormFieldRow[] = customProperties.map((cp) => {
    const path = `extension.${cp.name}`;
    const existing = existingSelections.get(path);

    return {
      path,
      label: cp.displayName ?? cp.name ?? path,
      kind: FieldKind.CustomProperty,
      included: Boolean(existing),
      required: Boolean(existing?.required),
      errorMessage: existing?.errorMessage,
    };
  });

  const orphanCustomRows: IntakeFormFieldRow[] = Array.from(
    existingSelections.values()
  )
    .filter(
      (rf) =>
        rf.fieldKind === FieldKind.CustomProperty &&
        !customPropertyPaths.has(rf.fieldPath)
    )
    .map((rf) => ({
      path: rf.fieldPath,
      label: rf.fieldLabel,
      kind: FieldKind.CustomProperty,
      included: true,
      required: Boolean(rf.required),
      errorMessage: rf.errorMessage,
      isOrphan: true,
    }));

  return [...nativeRows, ...customRows, ...orphanCustomRows];
};

/**
 * Map designer rows to a CreateIntakeForm payload. Native fields are persisted
 * only when required; custom properties when included. errorMessage is dropped
 * for non-required fields.
 */
export const buildIntakeFormPayload = ({
  rows,
  entityType,
  name,
  displayName,
  description,
  enabled,
  owners,
}: {
  rows: IntakeFormFieldRow[];
  entityType: TargetEntityType;
  name: string;
  displayName: string;
  description: string;
  enabled: boolean;
  owners?: IntakeForm['owners'];
}): CreateIntakeForm => {
  const formFields: IntakeFormField[] = rows
    .filter((row) =>
      row.kind === FieldKind.Native ? row.required : row.included
    )
    .map((row) => ({
      fieldPath: row.path,
      fieldLabel: row.label,
      fieldKind: row.kind,
      required: row.required,
      errorMessage: row.required ? row.errorMessage || undefined : undefined,
    }));

  return {
    name,
    displayName,
    description: description || undefined,
    entityType,
    enabled,
    formFields,
    requiredFields: toLegacyRequiredFields(formFields),
    ...(owners ? { owners } : {}),
  };
};
