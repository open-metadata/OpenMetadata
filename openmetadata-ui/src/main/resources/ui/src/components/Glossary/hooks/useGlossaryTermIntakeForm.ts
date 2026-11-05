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
import { useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { useEffect, useMemo } from 'react';
import { CustomProperty } from '../../../generated/entity/type';
import {
  FieldKind,
  IntakeFormField,
  TargetEntityType,
} from '../../../generated/governance/intakeForm';
import { getIntakeFormByEntityType } from '../../../rest/intakeFormsAPI';
import { getCustomPropertiesByEntityType } from '../../../rest/metadataTypeAPI';
import { getIntakeFormFields } from '../../../utils/IntakeFormUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

export interface GlossaryTermIntakeFormState {
  customProperties: CustomProperty[];
  // Admin-configured custom properties the create form must collect.
  extensionFormFields: IntakeFormField[];
  isLoaded: boolean;
  // Native field path → the intake field that makes it required.
  requiredNativeFields: Map<string, IntakeFormField>;
}

const isCustomPropertyField = (field: IntakeFormField) =>
  field.fieldKind === FieldKind.CustomProperty ||
  field.fieldPath.startsWith('extension.');

const NO_CUSTOM_PROPERTIES: CustomProperty[] = [];

const useToastOnError = (error: Error | null) => {
  useEffect(() => {
    if (error) {
      showErrorToast(error as AxiosError);
    }
  }, [error]);
};

/**
 * Loads the intake form and custom properties for `entityType` while `enabled`.
 * Queries are keyed by entity type, so each create form reads only its own form.
 */
const useIntakeForm = (
  entityType: TargetEntityType,
  enabled: boolean
): GlossaryTermIntakeFormState => {
  // Cached across opens but refetched each time, so an edited intake form still applies.
  const intakeFormQuery = useQuery({
    queryKey: ['intake', entityType, 'form'],
    // A missing intake form resolves to null, so any rejection is a real failure.
    queryFn: () => getIntakeFormByEntityType(entityType),
    enabled,
  });
  const customPropertiesQuery = useQuery({
    queryKey: ['intake', entityType, 'custom-properties'],
    queryFn: () => getCustomPropertiesByEntityType(entityType),
    enabled,
  });

  useToastOnError(intakeFormQuery.error);
  useToastOnError(customPropertiesQuery.error);

  const intakeForm = enabled ? intakeFormQuery.data ?? null : null;
  const customProperties = enabled
    ? customPropertiesQuery.data ?? NO_CUSTOM_PROPERTIES
    : NO_CUSTOM_PROPERTIES;
  const isLoaded =
    !enabled ||
    (!intakeFormQuery.isPending && !customPropertiesQuery.isPending);

  return useMemo(() => {
    const fields = getIntakeFormFields(intakeForm);
    const requiredNativeFields = new Map<string, IntakeFormField>();

    fields.forEach((field) => {
      if (field.required && !isCustomPropertyField(field)) {
        requiredNativeFields.set(field.fieldPath, field);
      }
    });

    return {
      customProperties,
      extensionFormFields: fields.filter(isCustomPropertyField),
      isLoaded,
      requiredNativeFields,
    };
  }, [customProperties, intakeForm, isLoaded]);
};

/** Loads the glossary term intake form; skipped in edit mode since it only governs creation. */
export const useGlossaryTermIntakeForm = (
  editMode: boolean
): GlossaryTermIntakeFormState =>
  useIntakeForm(TargetEntityType.GlossaryTerm, !editMode);

/** Loads the glossary intake form once the create drawer has been opened. */
export const useGlossaryIntakeForm = (
  enabled: boolean
): GlossaryTermIntakeFormState =>
  useIntakeForm(TargetEntityType.Glossary, enabled);
