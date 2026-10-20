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
import { AlertType as CapabilitiesAlertType } from '../../../generated/events/api/alertCapabilitiesRequest';
import { AlertType } from '../../../generated/events/eventSubscription';
import { useAlertSelection } from '../../../hooks/useAlertSelection';
import {
  shouldShowRuleSection,
  toCapabilitiesInput,
} from '../../../utils/Alerts/AlertSelectionUtil';
import { UseObservabilityAlertResourcesReturn } from '../AddObservabilityPage.interface';

// One array for "nothing selected", so what depends on the sources does not change every render.
const NO_SOURCES: string[] = [];

/**
 * Asks the server what the chosen sources support, without a form. The caller passes the sources
 * and the filters and triggers chosen so far.
 */
export function useAlertResources(
  alertType: AlertType = AlertType.Observability,
  sources: string[] = NO_SOURCES,
  chosenSoFar?: Parameters<typeof toCapabilitiesInput>[0]
): UseObservabilityAlertResourcesReturn {
  const capabilitiesInput = useMemo(
    () => toCapabilitiesInput(chosenSoFar),
    [chosenSoFar]
  );

  const selection = useAlertSelection({
    alertType:
      alertType === AlertType.Notification
        ? CapabilitiesAlertType.Notification
        : CapabilitiesAlertType.Observability,
    sources,
    input: capabilitiesInput,
  });
  const { supportedFilters, supportedTriggers } = selection.support;

  const shouldShowFiltersSection = useMemo(
    () =>
      shouldShowRuleSection(sources, supportedFilters, chosenSoFar?.filters),
    [sources, supportedFilters, chosenSoFar?.filters]
  );

  const shouldShowActionsSection = useMemo(
    () =>
      shouldShowRuleSection(sources, supportedTriggers, chosenSoFar?.actions),
    [sources, supportedTriggers, chosenSoFar?.actions]
  );

  return {
    loading: !selection.ready,
    selection,
    shouldShowActionsSection,
    shouldShowFiltersSection,
  };
}
