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

import { isEmpty } from 'lodash';
import type { Destination } from '../../../generated/events/eventSubscription';
import { SubscriptionCategory } from '../../../generated/events/eventSubscription';
import { EXTERNAL_DESTINATION_TYPES } from './DestinationFormItem.constants';

export const hasExternalDestination = (
  destinations: Array<Pick<Destination, 'category' | 'type'>>
) =>
  destinations.some(
    ({ category, type }) =>
      category === SubscriptionCategory.External &&
      EXTERNAL_DESTINATION_TYPES.includes(type ?? '')
  );

export const isTestableExternalDestination = (destination: Destination) =>
  destination.category === SubscriptionCategory.External &&
  !isEmpty(destination.config);

export const getTestableExternalDestinations = (
  destinations: Destination[] = []
) => destinations.filter(isTestableExternalDestination);

/**
 * Re-aligns the per-tested-destination status list back to the form's full
 * destination row order. `getTestableExternalDestinations` filters the form
 * destinations down to only testable external rows before testing, so the
 * paired status list is shorter than the form. This rebuilds one entry per
 * form row — placing each tested row's result at its original form index and
 * `undefined` for non-tested (internal / empty-config) rows — so each row can
 * look its own status up by form index instead of by value-equality, which
 * collapses duplicate destinations onto the first matching entry.
 */
export const alignDestinationsWithTestStatus = (
  formDestinations: Destination[] = [],
  testedDestinationsWithStatus: Destination[]
): (Destination | undefined)[] => {
  let testedIndex = 0;

  return formDestinations.map((destination) =>
    isTestableExternalDestination(destination)
      ? testedDestinationsWithStatus[testedIndex++]
      : undefined
  );
};
