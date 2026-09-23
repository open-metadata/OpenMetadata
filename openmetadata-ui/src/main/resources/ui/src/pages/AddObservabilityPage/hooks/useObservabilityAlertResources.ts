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

import type { FormInstance } from 'antd';
import { Form } from 'antd';
import { isEmpty } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CreateEventSubscription } from '../../../generated/events/api/createEventSubscription';
import { AlertType } from '../../../generated/events/api/alertCapabilitiesRequest';
import { useAlertSelection } from '../../../hooks/useAlertSelection';
import { getResourceFunctions } from '../../../rest/observabilityAPI';
import { toCapabilitiesInput } from '../../../utils/Alerts/AlertSelectionUtil';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  ModifiedCreateEventSubscription,
  ObservabilityFilterResourceDescriptor,
  UseObservabilityAlertResourcesReturn,
} from '../AddObservabilityPage.interface';
import { toObservabilityFilterResourceDescriptor } from '../ObservabilityAlertForm.utils';

// One array for "nothing selected", so what depends on the selection does not change every render.
const NO_SOURCES: string[] = [];

export function useObservabilityAlertResources(
  form: FormInstance<ModifiedCreateEventSubscription>
): UseObservabilityAlertResourcesReturn {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [filterResources, setFilterResources] = useState<
    ObservabilityFilterResourceDescriptor[]
  >([]);

  const resources =
    Form.useWatch<CreateEventSubscription['resources']>(['resources'], form) ??
    NO_SOURCES;
  const chosenSoFar = Form.useWatch('input', form);
  const capabilitiesInput = useMemo(
    () => toCapabilitiesInput(chosenSoFar),
    [chosenSoFar]
  );

  const fetchFunctions = async () => {
    try {
      setLoading(true);
      const filterResources = await getResourceFunctions();

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
  };

  useEffect(() => {
    fetchFunctions();
  }, []);

  const selection = useAlertSelection({
    alertType: AlertType.Observability,
    sources: resources,
    input: capabilitiesInput,
    catalog: filterResources,
  });
  const { supportedFilters, supportedTriggers } = selection.support;

  const shouldShowFiltersSection = useMemo(
    () => (isEmpty(resources) ? true : !isEmpty(supportedFilters)),
    [resources, supportedFilters]
  );

  const shouldShowActionsSection = useMemo(
    () => (isEmpty(resources) ? true : !isEmpty(supportedTriggers)),
    [resources, supportedTriggers]
  );

  return {
    filterResources,
    loading,
    selection,
    shouldShowActionsSection,
    shouldShowFiltersSection,
  };
}
