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
import { useCallback, useMemo } from 'react';
import {
  FieldKind,
  IntakeFormField,
  TargetEntityType,
} from '../../../generated/governance/intakeForm';
import { getIntakeFormByEntityType } from '../../../rest/intakeFormsAPI';
import { getCustomPropertiesByEntityType } from '../../../rest/metadataTypeAPI';
import { getIntakeFormFields } from '../../../utils/IntakeFormUtils';

export const useMetricIntakeForm = (enabled: boolean) => {
  const form = useQuery({
    queryKey: ['metric-create', 'intake-form'],
    queryFn: () => getIntakeFormByEntityType(TargetEntityType.Metric),
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const properties = useQuery({
    queryKey: ['metric-create', 'custom-properties'],
    queryFn: () => getCustomPropertiesByEntityType(TargetEntityType.Metric),
    enabled,
    refetchOnWindowFocus: false,
  });
  const fields = useMemo(() => {
    const requiredNativeFields = new Map<string, IntakeFormField>();
    const extensionFormFields: IntakeFormField[] = [];
    getIntakeFormFields(form.data).forEach((field) => {
      if (
        field.fieldKind === FieldKind.CustomProperty ||
        field.fieldPath.startsWith('extension.')
      ) {
        extensionFormFields.push(field);
      } else if (field.required) {
        requiredNativeFields.set(field.fieldPath, field);
      }
    });

    return { requiredNativeFields, extensionFormFields };
  }, [form.data]);

  const retry = useCallback(
    () => Promise.all([form.refetch(), properties.refetch()]),
    [form.refetch, properties.refetch]
  );

  return {
    ...fields,
    customProperties: properties.data ?? [],
    isLoaded:
      form.isSuccess &&
      properties.isSuccess &&
      !form.isFetching &&
      !properties.isFetching,
    isError: form.isError || properties.isError,
    retry,
  };
};

export type MetricIntakeFormState = ReturnType<typeof useMetricIntakeForm>;
