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
import { useCallback, useState } from 'react';
import { EntityType } from '../../../../../enums/entity.enum';
import { CustomProperty } from '../../../../../generated/type/customProperty';
import { useEntityTypeCustomProperties } from '../../../../../hooks/useEntityTypeCustomProperties';
import { buildUpdatedExtension } from '../../../../../utils/CustomProperty.utils';

export interface CustomPropertyEditorOptions {
  entityType: EntityType;
  extension?: Record<string, unknown>;
  // Saves the whole new extension and resolves to whether the save landed.
  onUpdate: (
    extension: Record<string, unknown> | undefined
  ) => Promise<boolean>;
}

/** An entity type's custom-property definitions plus the one-row-at-a-time inline-edit state. */
export const useCustomPropertyEditor = ({
  entityType,
  extension,
  onUpdate,
}: CustomPropertyEditorOptions) => {
  const { customProperties, isLoading } =
    useEntityTypeCustomProperties(entityType);
  const [editingProperty, setEditingProperty] = useState<CustomProperty>();
  const [isSaving, setIsSaving] = useState(false);

  const stopEditing = useCallback(() => setEditingProperty(undefined), []);

  const saveValue = useCallback(
    async (value: unknown) => {
      if (!editingProperty) {
        return;
      }
      setIsSaving(true);
      const saved = await onUpdate(
        buildUpdatedExtension(
          extension,
          editingProperty.name,
          editingProperty.propertyType.name ?? '',
          value
        )
      );
      setIsSaving(false);
      // A failed save keeps the editor open with what the user typed; the
      // update handler has already shown the error.
      if (saved) {
        setEditingProperty(undefined);
      }
    },
    [editingProperty, extension, onUpdate]
  );

  return {
    customProperties,
    isLoading,
    editingProperty,
    isSaving,
    startEditing: setEditingProperty,
    stopEditing,
    saveValue,
  };
};
