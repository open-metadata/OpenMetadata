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

import type { FormInstance } from 'antd';
import { Form } from 'antd';
import { CreateEventSubscription } from '../../../generated/events/api/createEventSubscription';
import { ModifiedCreateEventSubscription } from '../AddObservabilityPage.interface';

// One array for "nothing selected", so what depends on the sources does not change every render.
const NO_SOURCES: string[] = [];

/**
 * The sources and the choices so far of a classic antd alert form. Kept in this file, which already
 * imports antd Form, so the antd import does not spread to a new file.
 */
export function useSelectedAlertSources(
  form: FormInstance<ModifiedCreateEventSubscription>
): {
  sources: string[];
  input?: ModifiedCreateEventSubscription['input'];
} {
  // The AI alert form copies its sources into this form without a field for them, so read the store.
  const sources =
    Form.useWatch<CreateEventSubscription['resources']>(['resources'], {
      form,
      preserve: true,
    }) ?? NO_SOURCES;
  const input = Form.useWatch('input', form);

  return { sources, input };
}
