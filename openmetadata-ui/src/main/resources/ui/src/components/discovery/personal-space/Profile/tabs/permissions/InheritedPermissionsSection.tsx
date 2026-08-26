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

import { Badge, Box, Typography } from '@openmetadata/ui-core-components';
import { ShieldTick } from '@untitledui/icons';
import { InheritedPermission } from '../../../../../../rest/permissionAPI';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getPermissionEntityLink } from './permissions.utils';
import PermissionSectionSkeleton from './PermissionSectionSkeleton';
import PolicyAccordion from './PolicyAccordion';

export interface InheritedPermissionsSectionProps {
  items: InheritedPermission[];
  isLoading?: boolean;
}

const InheritedPermissionsSection: React.FC<
  InheritedPermissionsSectionProps
> = ({ items, isLoading }) => {
  const { t } = useTranslation();

  if (isLoading) {
    return <PermissionSectionSkeleton />;
  }

  return items.length === 0 ? (
    <Typography className="tw:text-tertiary" size="text-sm">
      {t('label.no-inherited-permissions')}
    </Typography>
  ) : (
    <Box direction="col" gap={4}>
      {items.map((item, index) => (
        <Box
          className="tw:rounded-xl tw:border tw:border-secondary tw:p-4"
          gap={3}
          key={`${item.permissionType}-${index}`}>
          <Box className="tw:h-9 tw:w-9 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-md tw:bg-utility-purple-50 tw:text-utility-purple-600">
            <ShieldTick height={18} width={18} />
          </Box>
          <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={1}>
            <Box align="center" className="tw:flex-wrap tw:gap-2">
              <Typography className="tw:text-secondary" size="text-xs">
                {t('label.type')}
              </Typography>
              <Badge color="purple" size="xs">
                {item.permissionType}
              </Badge>
            </Box>

            {item.description && (
              <Typography className="tw:text-secondary" size="text-xs">
                {item.description}
              </Typography>
            )}

            {item.source && (
              <Box align="center" className="tw:gap-1">
                <Typography className="tw:text-secondary" size="text-xs">
                  {`${t('label.source')} :`}
                </Typography>
                <Link
                  className="tw:text-xs tw:text-utility-blue-dark-500"
                  to={getPermissionEntityLink(item.source)}>
                  {getEntityName(item.source)}
                </Link>
              </Box>
            )}

            {item.policies.length > 0 && (
              <Box direction="col" gap={2}>
                {item.policies.map((policy) => (
                  <PolicyAccordion
                    key={policy.policy.fullyQualifiedName ?? policy.policy.name}
                    policy={policy}
                  />
                ))}
              </Box>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default InheritedPermissionsSection;
