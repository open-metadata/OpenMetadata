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

import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertType as CapabilitiesAlertType } from '../../../generated/events/api/alertCapabilitiesRequest';
import { AlertType } from '../../../generated/events/eventSubscription';
import { useAlertSelection } from '../../../hooks/useAlertSelection';
import { getResourceFunctions as getNotificationResourceFunctions } from '../../../rest/alertsAPI';
import { getResourceFunctions as getObservabilityResourceFunctions } from '../../../rest/observabilityAPI';
import { toCapabilitiesInput } from '../../../utils/Alerts/AlertSelectionUtil';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  ObservabilityFilterResourceDescriptor,
  UseObservabilityAlertResourcesReturn,
} from '../AddObservabilityPage.interface';
import { toObservabilityFilterResourceDescriptor } from '../ObservabilityAlertForm.utils';

// One array for "nothing selected", so what depends on the sources does not change every render.
const NO_SOURCES: string[] = [];

/**
 * Loads the alert source catalogue and asks the server what the chosen sources support,
 * without a form. The caller passes the sources and the filters and triggers chosen so far.
 */
export function useAlertResources(
  alertType: AlertType = AlertType.Observability,
  sources: string[] = NO_SOURCES,
  chosenSoFar?: Parameters<typeof toCapabilitiesInput>[0]
): UseObservabilityAlertResourcesReturn {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [filterResources, setFilterResources] = useState<
    ObservabilityFilterResourceDescriptor[]
  >([]);
  const capabilitiesInput = useMemo(
    () => toCapabilitiesInput(chosenSoFar),
    [chosenSoFar]
  );

  const fetchFunctions = useCallback(async () => {
    try {
      setLoading(true);
      const filterResources =
        alertType === AlertType.Notification
          ? await getNotificationResourceFunctions()
          : await getObservabilityResourceFunctions();

      setFilterResources(
        filterResources.data.map(toObservabilityFilterResourceDescriptor)
      );
    } catch {
      showErrorToast(
        t('server.entity-fetch-error', { entity: t('label.config') })
      );
    } finally {
      setLoading(false);
    }
  }, [alertType, t]);

  useEffect(() => {
    fetchFunctions();
  }, [fetchFunctions]);

  const selection = useAlertSelection({
    alertType:
      alertType === AlertType.Notification
        ? CapabilitiesAlertType.Notification
        : CapabilitiesAlertType.Observability,
    sources,
    input: capabilitiesInput,
    catalog: filterResources,
  });
  const { supportedFilters, supportedTriggers } = selection.support;

  const shouldShowFiltersSection = useMemo(
    () => (isEmpty(sources) ? true : !isEmpty(supportedFilters)),
    [sources, supportedFilters]
  );

  const shouldShowActionsSection = useMemo(
    () => (isEmpty(sources) ? true : !isEmpty(supportedTriggers)),
    [sources, supportedTriggers]
  );

  return {
    filterResources,
    loading,
    selection,
    shouldShowActionsSection,
    shouldShowFiltersSection,
  };
}
