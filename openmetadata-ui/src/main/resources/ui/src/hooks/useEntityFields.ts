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
import { getFieldsForEntity } from '../rest/metadataTypeAPI';
import { filterExcludeFields } from '../utils/WorkflowConfigUtils';

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
      const allFieldsPromises = entityTypesArray.map((entityType) =>
        getFieldsForEntity(entityType)
      );
      const allFieldsResults = await Promise.all(allFieldsPromises);

      const allFields = allFieldsResults.flat().filter(Boolean);
      const filteredFields = filterExcludeFields(allFields);

      const fieldOptionsMap = new Map();
      filteredFields.forEach(({ name }) => {
        if (name && !fieldOptionsMap.has(name)) {
          fieldOptionsMap.set(name, name);
        }
      });

      setFieldOptions(Array.from(fieldOptionsMap.values()));
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
