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

import { Box, Typography } from '@openmetadata/ui-core-components';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { DirectRolePermission } from '../../../../../../rest/permissionAPI';
import PermissionSectionSkeleton from './PermissionSectionSkeleton';
import RoleCard from './RoleCard';

export interface DirectRolesSectionProps {
  roles: DirectRolePermission[];
  isLoading?: boolean;
}

const DirectRolesSection: React.FC<DirectRolesSectionProps> = ({
  roles,
  isLoading,
}) => {
  const { t } = useTranslation();

  if (isLoading) {
    return <PermissionSectionSkeleton />;
  }

  return roles.length === 0 ? (
    <Box
      align="center"
      className="tw:rounded-xl tw:border tw:border-dashed tw:border-secondary tw:p-6 tw:text-center tw:bg-utility-gray-50"
      direction="col"
      gap={1}>
      <Typography className="tw:text-tertiary" size="text-xs">
        {t('message.no-direct-roles-assigned')}
      </Typography>
      <Typography className="tw:text-tertiary" size="text-xs">
        {t('message.direct-roles-empty-hint')}
      </Typography>
    </Box>
  ) : (
    <Box direction="col" gap={4}>
      {roles.map((item) => (
        <Box
          className="tw:rounded-xl tw:border tw:border-secondary tw:p-4"
          direction="col"
          key={item.role.fullyQualifiedName ?? item.role.name}>
          <RoleCard policies={item.policies} role={item.role} />
        </Box>
      ))}
    </Box>
  );
};

export default DirectRolesSection;
