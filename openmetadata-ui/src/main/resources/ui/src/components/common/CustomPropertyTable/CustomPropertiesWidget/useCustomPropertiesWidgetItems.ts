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
import { useEntityTypeCustomProperties } from '../../../../hooks/useEntityTypeCustomProperties';
import { CustomPropertiesWidgetSettings } from './CustomPropertiesWidget.interface';
import {
  applyPropertyLayout,
  getWidgetDefaultWidth,
  selectWidgetProperties,
} from './CustomPropertiesWidget.utils';

/** The properties a widget shows, in its layout order and widths. */
export const useCustomPropertiesWidgetItems = (
  entityType: string | undefined,
  settings: CustomPropertiesWidgetSettings
) => {
  const { customProperties, isLoading } =
    useEntityTypeCustomProperties(entityType);
  const items = useMemo(
    () =>
      applyPropertyLayout(
        selectWidgetProperties(customProperties, settings),
        settings.propertyLayout,
        getWidgetDefaultWidth
      ),
    [customProperties, settings]
  );

  return { items, isLoading };
};
