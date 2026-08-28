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
import { getResourceFunctions } from '../../../rest/observabilityAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  ModifiedCreateEventSubscription,
  ObservabilityFilterResourceDescriptor,
  UseObservabilityAlertResourcesReturn,
} from '../AddObservabilityPage.interface';
import { toObservabilityFilterResourceDescriptor } from '../ObservabilityAlertForm.utils';

export function useObservabilityAlertResources(
  form: FormInstance<ModifiedCreateEventSubscription>
): UseObservabilityAlertResourcesReturn {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [filterResources, setFilterResources] = useState<
    ObservabilityFilterResourceDescriptor[]
  >([]);

  const [selectedTrigger] =
    Form.useWatch<CreateEventSubscription['resources']>(['resources'], form) ??
    [];

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

  const selectedResource = useMemo(
    () => filterResources.find((resource) => resource.name === selectedTrigger),
    [filterResources, selectedTrigger]
  );

  const supportedFilters = useMemo(
    () => selectedResource?.supportedFilters,
    [selectedResource]
  );

  const containerEntities = useMemo<
    UseObservabilityAlertResourcesReturn['containerEntities']
  >(() => selectedResource?.containerEntities, [selectedResource]);

  const supportedTriggers = useMemo(
    () => selectedResource?.supportedActions,
    [selectedResource]
  );

  const shouldShowFiltersSection = useMemo(
    () => (selectedTrigger ? !isEmpty(supportedFilters) : true),
    [selectedTrigger, supportedFilters]
  );

  const shouldShowActionsSection = useMemo(
    () => (selectedTrigger ? !isEmpty(supportedTriggers) : true),
    [selectedTrigger, supportedTriggers]
  );

  return {
    containerEntities,
    filterResources,
    loading,
    shouldShowActionsSection,
    shouldShowFiltersSection,
    supportedFilters,
    supportedTriggers,
  };
}
