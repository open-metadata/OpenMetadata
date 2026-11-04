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
import { AxiosError } from 'axios';
import { useCallback, useState } from 'react';
import { EntityType } from '../../../enums/entity.enum';
import { CustomProperty } from '../../../generated/type/customProperty';
import { buildUpdatedExtension } from '../../../utils/CustomProperty.utils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useEntityTypeCustomProperties } from '../../useEntityTypeCustomProperties';

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
      const savedName = editingProperty.name;
      setIsSaving(true);
      try {
        const saved = await onUpdate(
          buildUpdatedExtension(
            extension,
            savedName,
            editingProperty.propertyType.name ?? '',
            value
          )
        );
        // A failed save keeps the editor open with what the user typed; the
        // update handler has already shown the error. A row opened while this
        // save was in flight stays open.
        if (saved) {
          setEditingProperty((current) =>
            current?.name === savedName ? undefined : current
          );
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsSaving(false);
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
