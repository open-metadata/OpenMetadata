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
import { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { CustomProperty } from '../../../generated/entity/type';
import {
  FieldKind,
  IntakeForm,
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

/**
 * Loads the admin-configured intake form for glossary terms. Intake forms only
 * govern creation, so nothing is fetched in edit mode.
 */
export const useGlossaryTermIntakeForm = (
  editMode: boolean
): GlossaryTermIntakeFormState => {
  const [intakeForm, setIntakeForm] = useState<IntakeForm | null>(null);
  const [customProperties, setCustomProperties] = useState<CustomProperty[]>(
    []
  );
  const [isLoaded, setIsLoaded] = useState(editMode);

  useEffect(() => {
    if (editMode) {
      setIntakeForm(null);
      setCustomProperties([]);
      setIsLoaded(true);

      return;
    }

    let cancelled = false;
    setIsLoaded(false);

    // getIntakeFormByEntityType resolves null when no form is configured, so a
    // rejection here is a real failure worth surfacing.
    Promise.allSettled([
      getIntakeFormByEntityType(TargetEntityType.GlossaryTerm),
      getCustomPropertiesByEntityType(TargetEntityType.GlossaryTerm),
    ]).then(([formResult, propertiesResult]) => {
      if (cancelled) {
        return;
      }
      if (formResult.status === 'fulfilled') {
        setIntakeForm(formResult.value);
      } else {
        showErrorToast(formResult.reason as AxiosError);
      }
      if (propertiesResult.status === 'fulfilled') {
        setCustomProperties(propertiesResult.value ?? []);
      } else {
        showErrorToast(propertiesResult.reason as AxiosError);
      }
      setIsLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [editMode]);

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
