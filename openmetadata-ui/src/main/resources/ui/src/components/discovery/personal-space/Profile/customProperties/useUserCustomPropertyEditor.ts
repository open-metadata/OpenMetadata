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
import { EntityType } from '../../../../../enums/entity.enum';
import { CustomProperty } from '../../../../../generated/type/customProperty';
import { useEntityTypeCustomProperties } from '../../../../../hooks/useEntityTypeCustomProperties';
import { buildUpdatedExtension } from '../../../../../utils/CustomProperty.utils';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import { UserCustomPropertiesProps } from './UserCustomProperties.interface';

/** User custom-property definitions plus the edit-modal state shared by the tab and the Profile section. */
export const useUserCustomPropertyEditor = ({
  user,
  onUpdate,
}: UserCustomPropertiesProps) => {
  const { customProperties, isLoading } = useEntityTypeCustomProperties(
    EntityType.USER
  );
  const [editingProperty, setEditingProperty] = useState<CustomProperty>();
  const [isSaving, setIsSaving] = useState(false);
  const extension = user.extension as Record<string, unknown> | undefined;

  const stopEditing = useCallback(() => setEditingProperty(undefined), []);

  const saveValue = useCallback(
    async (value: unknown) => {
      if (!editingProperty) {
        return;
      }
      setIsSaving(true);
      try {
        await onUpdate(
          {
            extension: buildUpdatedExtension(
              extension,
              editingProperty.name,
              editingProperty.propertyType.name ?? '',
              value
            ),
          },
          'extension'
        );
        setEditingProperty(undefined);
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
    extension,
    editingProperty,
    isSaving,
    startEditing: setEditingProperty,
    stopEditing,
    saveValue,
  };
};
