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

import type { SelectItemType } from '@openmetadata/ui-core-components';
import { startCase } from 'lodash';
import {
  DESTINATION_DROPDOWN_TABS,
  DESTINATION_SOURCE_ITEMS,
} from '../../../../constants/Alerts.constants';
import { getAlertDestinationCategoryIcons } from '../../../../utils/ObservabilityUtils';

/**
 * The recipients inside the platform the selected sources can reach, as the server offers them,
 * and the one this destination already has, so an alert saved with another stays editable. Until
 * the server has answered, only that one.
 */
export const buildGroupedOptions = (
  internalLabel: string,
  externalLabel: string,
  offeredCategories: string[] = [],
  currentCategory?: string
): SelectItemType[] => {
  const shown = new Set(offeredCategories);
  if (currentCategory) {
    shown.add(currentCategory);
  }
  const internalOptions = DESTINATION_SOURCE_ITEMS[
    DESTINATION_DROPDOWN_TABS.internal
  ].filter(({ value }) => shown.has(value));
  const externalOptions =
    DESTINATION_SOURCE_ITEMS[DESTINATION_DROPDOWN_TABS.external];

  return [
    { id: 'header-internal', label: internalLabel, isDisabled: true },
    ...internalOptions.map(({ value }) => ({
      id: value,
      label: startCase(value),
      icon: getAlertDestinationCategoryIcons(value),
    })),
    { id: 'header-external', label: externalLabel, isDisabled: true },
    ...externalOptions.map(({ value }) => ({
      id: value,
      label: startCase(value),
      icon: getAlertDestinationCategoryIcons(value),
    })),
  ];
};
