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
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE_LARGE } from '../../../constants/constants';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ProviderType } from '../../../generated/entity/events/notificationTemplate';
import { Operation } from '../../../generated/entity/policies/policy';
import { getAllNotificationTemplates } from '../../../rest/notificationtemplateAPI';
import {
  DEFAULT_ENTITY_PERMISSION,
  getPrioritizedViewPermission,
} from '../../../utils/PermissionsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  UseObservabilityAlertTemplatesOptions,
  UseObservabilityAlertTemplatesReturn,
} from '../AddObservabilityPage.interface';

export function useObservabilityAlertTemplates({
  extraFormWidgets,
  getResourcePermission,
}: UseObservabilityAlertTemplatesOptions): UseObservabilityAlertTemplatesReturn {
  const { t } = useTranslation();
  const getResourcePermissionRef = useRef(getResourcePermission);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<
    UseObservabilityAlertTemplatesReturn['templates']
  >([]);
  const [templateResourcePermission, setTemplateResourcePermission] = useState<
    UseObservabilityAlertTemplatesReturn['templateResourcePermission']
  >(DEFAULT_ENTITY_PERMISSION);

  useEffect(() => {
    getResourcePermissionRef.current = getResourcePermission;
  }, [getResourcePermission]);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const permission = await getResourcePermissionRef.current(
        ResourceEntity.NOTIFICATION_TEMPLATE
      );

      setTemplateResourcePermission(permission);

      if (getPrioritizedViewPermission(permission, Operation.ViewAll)) {
        const { data } = await getAllNotificationTemplates({
          limit: PAGE_SIZE_LARGE,
          provider: ProviderType.User,
        });

        setTemplates(data);
      }
    } catch {
      showErrorToast(
        t('server.entity-fetch-error', { entity: t('label.template-plural') })
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!isEmpty(extraFormWidgets)) {
      fetchTemplates();
    }
  }, [extraFormWidgets, fetchTemplates]);

  return {
    loading,
    templateResourcePermission,
    templates,
  };
}
