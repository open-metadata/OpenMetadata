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

import { useForm } from 'antd/lib/form/Form';
import {
  ModifiedCreateEventSubscription,
  UseAlertFormDataOptions,
  UseAlertFormDataReturn,
} from '../AddObservabilityPage.interface';
import { useAlertFormData } from './useAlertFormData';
import { useSelectedAlertSources } from './useObservabilityAlertResources';

type ObservabilityAlertFormInstance = ReturnType<
  typeof useForm<ModifiedCreateEventSubscription>
>[0];

// The classic antd form types live here, beside the only hook that creates the form, so the
// shared AddObservabilityPage.interface stays antd-free for the AI alert modal.
export interface UseObservabilityAlertFormOptions
  extends Omit<UseAlertFormDataOptions, 'input' | 'sources'> {
  form?: ObservabilityAlertFormInstance;
}

export interface UseObservabilityAlertFormReturn
  extends UseAlertFormDataReturn {
  form: ObservabilityAlertFormInstance;
}

export type ObservabilityAlertFormProps = UseObservabilityAlertFormReturn;

export type ObservabilityAlertFormFieldsProps = Pick<
  ObservabilityAlertFormProps,
  | 'alert'
  | 'extraFormWidgets'
  | 'filterResources'
  | 'form'
  | 'isLoading'
  | 'shouldShowActionsSection'
  | 'shouldShowFiltersSection'
  | 'templateResourcePermission'
  | 'templates'
>;

export function useObservabilityAlertForm({
  form: providedForm,
  ...options
}: UseObservabilityAlertFormOptions = {}): UseObservabilityAlertFormReturn {
  const [internalForm] = useForm<ModifiedCreateEventSubscription>();
  const form = providedForm ?? internalForm;
  const { sources, input } = useSelectedAlertSources(form);

  return { ...useAlertFormData({ ...options, sources, input }), form };
}
