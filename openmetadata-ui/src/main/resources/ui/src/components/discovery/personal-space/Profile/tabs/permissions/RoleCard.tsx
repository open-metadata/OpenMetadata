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
import { Link } from 'react-router-dom';
import { EntityReference } from '../../../../../../generated/entity/type';
import { PolicyInfo } from '../../../../../../rest/permissionAPI';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { getPermissionEntityLink } from './permissions.utils';
import PolicyAccordion from './PolicyAccordion';

export interface RoleCardProps {
  role: EntityReference;
  policies: PolicyInfo[];
  inheritedFrom?: string;
}

/**
 * A role with its policies, used by both Direct Roles and team role lists.
 * Header shows the role link + policy and rule counts; body lists each policy
 * as an expandable accordion.
 */
const RoleCard: React.FC<RoleCardProps> = ({
  role,
  policies,
  inheritedFrom,
}) => {
  const { t } = useTranslation();
  const ruleCount = policies.reduce((sum, p) => sum + p.rules.length, 0);

  return (
    <Box direction="col" gap={3}>
      <Box align="center" className="tw:flex-wrap tw:gap-3">
        <Box align="center" className="tw:gap-1">
          <Typography size="text-sm" weight="semibold">
            {`${t('label.role')} :`}
          </Typography>
          <Link
            className="tw:text-sm tw:font-medium tw:text-utility-blue-dark-500"
            to={getPermissionEntityLink(role)}>
            {getEntityName(role)}
          </Link>
        </Box>
        <Typography className="tw:text-secondary" size="text-xs">
          {`${t('label.policy-plural')} : ${policies.length}`}
        </Typography>
        <Typography className="tw:text-secondary" size="text-xs">
          {`${t('label.rule-plural')} : ${ruleCount}`}
        </Typography>
      </Box>

      {inheritedFrom && (
        <Typography className="tw:text-secondary" size="text-xs">
          {`${t('label.inherited-from')} : ${inheritedFrom}`}
        </Typography>
      )}

      <Box direction="col" gap={2}>
        {policies.map((policy, index) => (
          <PolicyAccordion
            defaultExpanded={index === 0}
            key={policy.policy.fullyQualifiedName ?? policy.policy.name}
            policy={policy}
          />
        ))}
      </Box>
    </Box>
  );
};

export default RoleCard;
