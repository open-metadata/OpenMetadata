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
import { useMemo } from 'react';
import { SettingType } from '../../../../../../generated/settings/settings';
import { useSettingsSource } from '../../../../../../hooks/platform/useSettingsSource';
import {
  findSettingSource,
  isPathManaged,
  toJsonPointer,
} from '../../../../../../utils/platform/settingsSource.utils';

/**
 * Which of `fields` (top-level keys of the setting) the deployment configuration owns. Pass a
 * module-level array: `fields` is a memo dependency.
 */
export const useDeploymentManagedFields = <F extends string>(
  settingType: SettingType,
  fields: readonly F[]
) => {
  const { sources, isLoading, refetch } = useSettingsSource([settingType]);

  const managedFields = useMemo(() => {
    const source = findSettingSource(sources, settingType);

    return fields.filter((field) =>
      isPathManaged(source, toJsonPointer(field))
    );
  }, [sources, settingType, fields]);

  return {
    sources,
    isLoading,
    refetch,
    managedFields,
    managedPaths: managedFields.map((field) => toJsonPointer(field)),
    isFieldManaged: (field: F) => managedFields.includes(field),
    /** Nothing the page shows can be changed, so it offers no edit. */
    isFullyManaged: fields.length > 0 && managedFields.length === fields.length,
  };
};
