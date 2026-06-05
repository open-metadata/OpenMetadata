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

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ServiceCategory } from '../../enums/service.enum';
import { getServiceByFQN } from '../../rest/serviceAPI';

const SERVICE_NAME_VALIDATION_DEBOUNCE_MS = 400;
const SERVICE_CATEGORY_LABEL_KEYS: Partial<Record<ServiceCategory, string>> = {
  [ServiceCategory.API_SERVICES]: 'label.api-service',
  [ServiceCategory.DASHBOARD_SERVICES]: 'label.dashboard-service',
  [ServiceCategory.DATABASE_SERVICES]: 'label.database-service',
  [ServiceCategory.DRIVE_SERVICES]: 'label.drive',
  [ServiceCategory.MESSAGING_SERVICES]: 'label.messaging-service',
  [ServiceCategory.METADATA_SERVICES]: 'label.metadata-service',
  [ServiceCategory.ML_MODEL_SERVICES]: 'label.mlmodel-service',
  [ServiceCategory.PIPELINE_SERVICES]: 'label.pipeline-service',
  [ServiceCategory.SEARCH_SERVICES]: 'label.search-service',
  [ServiceCategory.SECURITY_SERVICES]: 'label.security-service',
  [ServiceCategory.STORAGE_SERVICES]: 'label.storage-service',
};

const getSuggestedServiceName = (serviceName: string) => {
  const match = serviceName.match(/^(.*?)(?:_(\d+))?$/);
  const baseName = match?.[1] || serviceName;
  const nextSuffix = Number(match?.[2] ?? 1) + 1;

  return `${baseName}_${nextSuffix}`;
};

export const useServiceNameValidation = ({
  enabled,
  serviceCategory,
  serviceName,
}: {
  enabled: boolean;
  serviceCategory: ServiceCategory;
  serviceName: string;
}) => {
  const { t } = useTranslation();
  const [nameError, setNameError] = useState('');
  const [isServiceNameChecking, setIsServiceNameChecking] = useState(false);
  const validationRequestIdRef = useRef(0);

  const getServiceCategoryLabel = useCallback(() => {
    const labelKey = SERVICE_CATEGORY_LABEL_KEYS[serviceCategory];

    return labelKey ? t(labelKey).toLowerCase() : t('label.service-lowercase');
  }, [serviceCategory, t]);

  const getDuplicateServiceNameError = useCallback(
    (name: string) =>
      t('message.service-name-already-exists-with-suggestion', {
        serviceCategory: getServiceCategoryLabel(),
        serviceName: name,
        suggestedServiceName: getSuggestedServiceName(name),
      }),
    [getServiceCategoryLabel, t]
  );

  const resetNameValidation = useCallback(() => {
    validationRequestIdRef.current += 1;
    setIsServiceNameChecking(false);
    setNameError('');
  }, []);

  const validateServiceName = useCallback(
    async (
      name = serviceName,
      requestId = validationRequestIdRef.current + 1
    ) => {
      const trimmedName = name.trim();

      if (requestId < validationRequestIdRef.current) {
        return false;
      }

      validationRequestIdRef.current = requestId;

      if (!enabled || !trimmedName) {
        setIsServiceNameChecking(false);

        return true;
      }

      setIsServiceNameChecking(true);

      try {
        await getServiceByFQN(serviceCategory, trimmedName);

        if (requestId === validationRequestIdRef.current) {
          setNameError(getDuplicateServiceNameError(trimmedName));
        }

        return false;
      } catch {
        if (requestId === validationRequestIdRef.current) {
          setNameError('');
        }

        return true;
      } finally {
        if (requestId === validationRequestIdRef.current) {
          setIsServiceNameChecking(false);
        }
      }
    },
    [enabled, getDuplicateServiceNameError, serviceCategory, serviceName]
  );

  useEffect(() => {
    const trimmedName = serviceName.trim();
    const requestId = validationRequestIdRef.current + 1;

    validationRequestIdRef.current = requestId;

    if (!enabled || !trimmedName) {
      setIsServiceNameChecking(false);

      return;
    }

    const timer = window.setTimeout(() => {
      validateServiceName(trimmedName, requestId);
    }, SERVICE_NAME_VALIDATION_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [enabled, serviceName, validateServiceName]);

  return {
    isServiceNameChecking,
    nameError,
    resetNameValidation,
    setNameError,
    validateServiceName,
  };
};
