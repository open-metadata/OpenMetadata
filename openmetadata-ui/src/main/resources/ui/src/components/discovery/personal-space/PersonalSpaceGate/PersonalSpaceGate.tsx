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

import { Box } from '@openmetadata/ui-core-components';
import React, { PropsWithChildren, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import { useAuth } from '../../../../hooks/authHooks';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../utils/PermissionsUtils';
import PermissionPlaceholder from '../../../common/EmptyPlaceholder/PermissionPlaceholder';
import Loader from '../../../common/Loader/Loader';
import './personal-space.less';

/**
 * Permission gate for the personal space (Inbox / My Data). Gates its
 * `children` on the USER view permission — mirroring the classic profile,
 * which 403s the page for users lacking it while admins bypass — and renders
 * the personal-space shell once allowed. Mode-agnostic: it holds no AI-only
 * chrome, so it is safe to mount from either route tree.
 */
const PersonalSpaceGate: React.FC<PropsWithChildren> = ({ children }) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const { isAdminUser } = useAuth();
  const { getEntityPermission } = usePermissionProvider();
  const [userPermission, setUserPermission] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );
  const [isPermissionLoading, setIsPermissionLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.id) {
      setIsPermissionLoading(false);

      return;
    }
    getEntityPermission(ResourceEntity.USER, currentUser.id)
      .then(setUserPermission)
      .catch(() => setUserPermission(DEFAULT_ENTITY_PERMISSION))
      .finally(() => setIsPermissionLoading(false));
  }, [currentUser?.id, getEntityPermission]);

  const canView =
    isAdminUser || getDerivedPermissionFlags(userPermission).canViewAll;

  if (isPermissionLoading) {
    return <Loader />;
  }

  if (!canView) {
    return (
      <div className="tw:relative tw:h-full tw:w-full tw:min-h-60 tw:rounded-xl tw:bg-surface">
        <PermissionPlaceholder
          data-testid="permission-error-placeholder"
          permissionValue={t('label.view')}
        />
      </div>
    );
  }

  return (
    <Box
      className="personal-space tw:flex tw:h-full tw:min-h-0 tw:flex-1 tw:flex-col tw:overflow-hidden"
      data-testid="personal-space"
      direction="col">
      {children}
    </Box>
  );
};

export default PersonalSpaceGate;
