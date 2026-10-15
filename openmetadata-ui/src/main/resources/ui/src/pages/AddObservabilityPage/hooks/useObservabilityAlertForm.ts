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

import { useForm, UseFormReturn } from 'react-hook-form';
import { DEFAULT_READ_TIMEOUT } from '../../../constants/Alerts.constants';
import { ProviderType } from '../../../generated/entity/events/notificationTemplate';
import { AlertType } from '../../../generated/events/eventSubscription';
import {
  ModifiedCreateEventSubscription,
  UseAlertFormDataOptions,
  UseAlertFormDataReturn,
} from '../AddObservabilityPage.interface';
import { useAlertFormData } from './useAlertFormData';
import { useSelectedAlertSources } from './useObservabilityAlertResources';

type ObservabilityAlertFormInstance =
  UseFormReturn<ModifiedCreateEventSubscription>;

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
  const internalForm = useForm<ModifiedCreateEventSubscription>({
    defaultValues: {
      resources: [],
      destinations: [],
      input: {},
      alertType: AlertType.Observability,
      provider: ProviderType.User,
      timeout: 10,
      readTimeout: DEFAULT_READ_TIMEOUT,
    },
  });
  const form = providedForm ?? internalForm;
  const { sources, input } = useSelectedAlertSources(form);

  return { ...useAlertFormData({ ...options, sources, input }), form };
}
