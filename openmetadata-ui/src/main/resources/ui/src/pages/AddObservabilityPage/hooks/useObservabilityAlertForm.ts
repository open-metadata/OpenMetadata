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

import { Form } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { CreateEventSubscription } from '../../../generated/events/api/createEventSubscription';
import {
  ModifiedCreateEventSubscription,
  UseObservabilityAlertFormOptions,
  UseObservabilityAlertFormReturn,
} from '../AddObservabilityPage.interface';
import { useAlertFormData } from './useAlertFormData';

export function useObservabilityAlertForm({
  form: providedForm,
  ...options
}: UseObservabilityAlertFormOptions = {}): UseObservabilityAlertFormReturn {
  const [internalForm] = useForm<ModifiedCreateEventSubscription>();
  const form = providedForm ?? internalForm;
  const [selectedResource] =
    Form.useWatch<CreateEventSubscription['resources']>(['resources'], form) ??
    [];

  return { ...useAlertFormData({ ...options, selectedResource }), form };
}
