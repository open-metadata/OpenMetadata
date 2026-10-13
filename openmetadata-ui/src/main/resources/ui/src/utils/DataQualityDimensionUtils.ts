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
import { FormSelectItem } from '@openmetadata/ui-core-components';
import { DataQualityDimension } from '../generated/tests/dataQualityDimension';
import { getEntityName } from './EntityNameUtils';

/**
 * Options for a dimension picker. `preserveNames` are dimension names that must stay selectable
 * even when they are not in the registered list — the dimension already set on the entity being
 * edited, say, which may since have been deleted — so opening a form never silently clears it.
 */
export const getDimensionSelectOptions = (
  dimensions: DataQualityDimension[],
  preserveNames: Array<string | undefined | null> = []
): FormSelectItem[] => {
  const options = new Map<string, FormSelectItem>();

  dimensions.forEach((dimension) => {
    options.set(dimension.name, {
      id: dimension.name,
      label: getEntityName(dimension),
    });
  });

  preserveNames.forEach((name) => {
    if (name && !options.has(name)) {
      options.set(name, { id: name, label: name });
    }
  });

  return Array.from(options.values());
};
