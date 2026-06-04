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

import { Home02 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ContextCenterHeader from '../../../components/ContextCenter/ContextCenterHeader/ContextCenterHeader.component';
import { ROUTES } from '../../../constants/constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

const ContextCenterIntegrationsPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getResourcePermission } = usePermissionProvider();
  const [permissions, setPermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );

  const hasCreatePermission = useMemo(
    () => permissions.Create,
    [permissions.Create]
  );

  const fetchPermission = useCallback(async () => {
    try {
      const response = await getResourcePermission(
        ResourceEntity.KNOWLEDGE_PAGE
      );
      setPermissions(response);
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
  }, [getResourcePermission]);

  useEffect(() => {
    fetchPermission();
  }, [fetchPermission]);

  return (
    <div
      className="tw:flex tw:flex-col tw:w-full tw:bg-secondary tw:px-5"
      data-testid="context-center-integrations-page">
      <ContextCenterHeader
        breadcrumbs={[
          {
            name: '',
            icon: <Home02 size={14} />,
            url: contextCenterClassBase.getHomePath(),
            activeTitle: true,
          },
          {
            name: t('label.context-center'),
            url: contextCenterClassBase.getContextCenterPath(),
          },
          {
            activeTitle: true,
            name: t('label.integration-plural'),
            url: '',
          },
        ]}
        hasPermission={hasCreatePermission}
        subtitle={t('message.context-center-integrations-subtitle')}
        title={t('label.integration-plural')}
        onCreateArticle={() => navigate(ROUTES.CONTEXT_CENTER_ARTICLES)}
      />
    </div>
  );
};

export default ContextCenterIntegrationsPage;
