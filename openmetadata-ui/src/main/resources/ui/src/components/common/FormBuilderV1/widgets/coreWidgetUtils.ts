/*
 *  Copyright 2025 Collate.
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

import { WidgetProps } from '@rjsf/utils';
import { getFormDisplayLabel } from '../formBuilderV1LabelUtils';

export const getWidgetHint = ({
  rawErrors,
  schema,
  options,
}: Pick<WidgetProps, 'rawErrors' | 'schema' | 'options'>) => {
  return rawErrors?.[0] ?? options.help ?? schema.description;
};

export const getWidgetLabel = ({
  hideLabel,
  label,
}: Pick<WidgetProps, 'hideLabel' | 'label'>) => {
  const looksLikeRawKey = (s: string) => /^[a-z][a-zA-Z0-9]*$/.test(s); // camelCase id

  return hideLabel
    ? undefined
    : looksLikeRawKey(label)
    ? getFormDisplayLabel(label)
    : label;
};
