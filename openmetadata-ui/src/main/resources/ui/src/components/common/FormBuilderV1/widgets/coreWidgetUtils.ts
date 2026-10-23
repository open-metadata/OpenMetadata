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

import { ADDITIONAL_PROPERTY_FLAG, WidgetProps } from '@rjsf/utils';
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
  schema,
}: Pick<WidgetProps, 'hideLabel' | 'label' | 'schema'>) => {
  const looksLikeRawKey = (s: string) => /^[a-z][a-zA-Z0-9]*$/.test(s); // camelCase id

  // A map entry's label is its key, which CoreWrapIfAdditionalTemplate already
  // shows as an editable input beside the value.
  if (hideLabel || (schema && ADDITIONAL_PROPERTY_FLAG in schema)) {
    return undefined;
  }

  return looksLikeRawKey(label) ? getFormDisplayLabel(label) : label;
};

// A map entry's value has no visible label, so its key names it for assistive tech.
export const getWidgetAriaProps = ({
  label,
  schema,
}: Pick<WidgetProps, 'label' | 'schema'>): { 'aria-label'?: string } =>
  schema && ADDITIONAL_PROPERTY_FLAG in schema ? { 'aria-label': label } : {};
