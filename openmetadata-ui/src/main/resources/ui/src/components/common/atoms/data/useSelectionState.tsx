/*
 *  Copyright 2024 Collate.
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

import { useCallback, useMemo, useState } from 'react';
import { SelectionState } from '../shared/types';

export const useSelectionState = <T extends { id: string }>(
  entities: T[]
): SelectionState => {
  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);

  const entityIds = useMemo(
    () => entities.map((entity) => entity.id),
    [entities]
  );

  const isAllSelected = useMemo(() => {
    return entityIds.length > 0 && selectedEntities.length === entityIds.length;
  }, [entityIds.length, selectedEntities.length]);

  const isIndeterminate = useMemo(() => {
    return (
      selectedEntities.length > 0 && selectedEntities.length < entityIds.length
    );
  }, [selectedEntities.length, entityIds.length]);

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedEntities(entityIds);
      } else {
        setSelectedEntities([]);
      }
    },
    [entityIds]
  );

  const handleSelect = useCallback((id: string, checked: boolean) => {
    if (checked) {
      setSelectedEntities((prev) => (prev.includes(id) ? prev : [...prev, id]));
    } else {
      setSelectedEntities((prev) => prev.filter((entityId) => entityId !== id));
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedEntities([]);
  }, []);

  const isSelected = useCallback(
    (id: string) => {
      return selectedEntities.includes(id);
    },
    [selectedEntities]
  );

  return {
    selectedEntities,
    isAllSelected,
    isIndeterminate,
    handleSelectAll,
    handleSelect,
    clearSelection,
    isSelected,
  };
};
