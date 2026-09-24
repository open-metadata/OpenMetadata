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

import { useCallback, useEffect, useState } from 'react';
import { EntityType } from '../enums/entity.enum';
import {
  getAllCustomProperties,
  getFieldsForEntity,
} from '../rest/metadataTypeAPI';
import { CustomPropertiesForAssets } from '../rest/metadataTypeAPI.interface';
import { buildFieldOptions } from '../utils/WorkflowConfigUtils';

export const useEntityFields = (entityTypes?: EntityType[]) => {
  const [fieldOptions, setFieldOptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFields = useCallback(async (entityTypesArray: EntityType[]) => {
    if (!entityTypesArray || entityTypesArray.length === 0) {
      setFieldOptions([]);

      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [allFieldsResults, customPropertiesByType] = await Promise.all([
        Promise.all(
          entityTypesArray.map((entityType) => getFieldsForEntity(entityType))
        ),
        // One bulk call returns custom properties for every entity type; index it
        // by type below. Best-effort: on failure fall back to bare names rather
        // than breaking the whole field picker.
        getAllCustomProperties().catch(() => ({}) as CustomPropertiesForAssets),
      ]);

      // Build options per entity type so a custom-property name on one type does not
      // prefix (and hide) a standard field of the same name on another type.
      const perTypeOptions = entityTypesArray.map((entityType, index) =>
        buildFieldOptions(
          (allFieldsResults[index] ?? []).filter(Boolean),
          new Set(
            (customPropertiesByType[entityType] ?? []).map(({ name }) => name)
          )
        )
      );

      setFieldOptions(Array.from(new Set(perTypeOptions.flat())));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fields');
      setFieldOptions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (entityTypes && entityTypes.length > 0) {
      loadFields(entityTypes);
    } else {
      setFieldOptions([]);
    }
  }, [entityTypes, loadFields]);

  return {
    fieldOptions,
    isLoading,
    error,
    refetchFields: () => {
      if (entityTypes && entityTypes.length > 0) {
        loadFields(entityTypes);
      }
    },
  };
};
