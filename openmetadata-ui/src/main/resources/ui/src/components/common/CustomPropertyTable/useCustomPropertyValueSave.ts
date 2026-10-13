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
import { isUndefined } from 'lodash';
import { useCallback } from 'react';
import { CustomProperty } from '../../../generated/type/customProperty';
import { buildUpdatedExtension } from '../../../utils/CustomProperty.utils';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import { EntityWithExtension } from './useCustomPropertyValueSave.interface';

/**
 * Persists custom property values through the entity page's GenericProvider, or through
 * the caller's own entity and update handler when it has no provider to read from (the
 * team and user detail pages are outside the customizable-page system).
 */
export const useCustomPropertyValueSave = <
  T extends EntityWithExtension
>(source?: {
  entityDetails?: T;
  onUpdate?: (updatedData: T, key?: keyof T) => Promise<void>;
}) => {
  const context = useGenericContext<T>();
  const entityDetails = source?.entityDetails ?? context.data;
  const onUpdate = source?.onUpdate ?? context.onUpdate;

  const onPropertyValueSave = useCallback(
    async (property: CustomProperty, value: unknown) => {
      if (isUndefined(onUpdate) || !entityDetails) {
        return;
      }

      await onUpdate(
        {
          ...entityDetails,
          extension: buildUpdatedExtension(
            entityDetails.extension,
            property.name,
            property.propertyType.name ?? '',
            value
          ),
        },
        'extension' as keyof T
      );
    },
    [entityDetails, onUpdate]
  );

  return { onPropertyValueSave };
};
