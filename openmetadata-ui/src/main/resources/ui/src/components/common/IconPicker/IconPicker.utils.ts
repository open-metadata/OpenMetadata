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
import { SelectItemType } from '@openmetadata/ui-core-components';
import { AVAILABLE_ICONS, DEFAULT_ICON_NAME } from './IconPicker.constants';
import { IconDefinition } from './IconPicker.interface';

export const getIconPickerItems = (
  defaultIcon?: IconDefinition
): SelectItemType[] => {
  const resolvedDefault =
    defaultIcon ??
    AVAILABLE_ICONS.find((icon) => icon.name === DEFAULT_ICON_NAME);

  const orderedIcons = resolvedDefault
    ? [
        resolvedDefault,
        ...AVAILABLE_ICONS.filter((icon) => icon.name !== resolvedDefault.name),
      ]
    : AVAILABLE_ICONS;

  return orderedIcons.map((icon) => ({
    id: icon.name,
    label: icon.name,
    icon: icon.component,
  }));
};
