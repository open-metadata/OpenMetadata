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

/** Persists custom property values through the entity page's GenericProvider. */
export const useCustomPropertyValueSave = <T extends EntityWithExtension>() => {
  const { data: entityDetails, onUpdate } = useGenericContext<T>();

  const onExtensionUpdate = useCallback(
    async (updatedExtension?: Record<string, unknown>) => {
      if (!isUndefined(onUpdate) && entityDetails) {
        await onUpdate(
          { ...entityDetails, extension: updatedExtension },
          'extension' as keyof T
        );
      }
    },
    [entityDetails, onUpdate]
  );

  const onPropertyValueSave = useCallback(
    (property: CustomProperty, value: unknown) =>
      onExtensionUpdate(
        buildUpdatedExtension(
          entityDetails?.extension,
          property.name,
          property.propertyType.name ?? '',
          value
        )
      ),
    [entityDetails?.extension, onExtensionUpdate]
  );

  return { onExtensionUpdate, onPropertyValueSave };
};
