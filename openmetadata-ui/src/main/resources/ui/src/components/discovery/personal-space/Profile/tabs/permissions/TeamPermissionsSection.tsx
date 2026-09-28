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
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { TeamPermission } from '../../../../../../rest/permissionAPI';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { getPermissionEntityLink } from './permissions.utils';
import PermissionSectionSkeleton from './PermissionSectionSkeleton';
import PolicyAccordion from './PolicyAccordion';
import RoleCard from './RoleCard';

export interface TeamPermissionsSectionProps {
  teams: TeamPermission[];
  isLoading?: boolean;
}

const TeamCard: React.FC<{ team: TeamPermission }> = ({ team }) => {
  const { t } = useTranslation();

  return (
    <Box
      className="tw:rounded-xl tw:border tw:border-secondary tw:p-4"
      direction="col"
      gap={3}>
      <Box align="center" className="tw:flex-wrap tw:gap-2">
        <Typography
          className="tw:text-secondary"
          size="text-sm"
          weight="regular">
          {t('label.team')}
        </Typography>
        <Link
          className="tw:text-sm tw:font-medium tw:text-utility-blue-dark-500"
          to={getPermissionEntityLink(team.team)}>
          {getEntityName(team.team)}
        </Link>
        {team.teamType && (
          <Badge size="sm" type="modern">
            {team.teamType}
          </Badge>
        )}
        {team.hierarchyLevel > 0 && (
          <Badge color="warning" size="sm">
            {`${t('label.level')} ${team.hierarchyLevel} ${t(
              'label.inherited'
            )}`}
          </Badge>
        )}
      </Box>

      {team.teamHierarchy.length > 1 && (
        <Box align="center" className="tw:flex-wrap tw:gap-1">
          <Typography className="tw:text-secondary" size="text-xs">
            {`${t('label.hierarchy')} :`}
          </Typography>
          {team.teamHierarchy.map((node, index) => (
            <Box align="center" className="tw:gap-1" key={node.id ?? index}>
              <Link
                className="tw:text-xs tw:text-utility-blue-dark-500"
                to={getPermissionEntityLink(node)}>
                {getEntityName(node)}
              </Link>
              {index < team.teamHierarchy.length - 1 && (
                <Typography className="tw:text-secondary" size="text-xs">
                  →
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      )}

      {team.rolePermissions.length > 0 && (
        <Box direction="col" gap={2}>
          <Typography
            className="tw:text-secondary"
            size="text-xs"
            weight="medium">
            {t('label.team-role-plural')}
          </Typography>
          {team.rolePermissions.map((rolePermission) => (
            <RoleCard
              inheritedFrom={rolePermission.inheritedFrom}
              key={
                rolePermission.role.fullyQualifiedName ??
                rolePermission.role.name
              }
              policies={rolePermission.policies}
              role={rolePermission.role}
            />
          ))}
        </Box>
      )}

      {team.directPolicies.length > 0 && (
        <Box direction="col" gap={2}>
          <Typography
            className="tw:text-secondary"
            size="text-xs"
            weight="medium">
            {t('label.direct-team-policy-plural')}
          </Typography>
          {team.directPolicies.map((policy) => (
            <PolicyAccordion
              key={policy.policy.fullyQualifiedName ?? policy.policy.name}
              policy={policy}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

const TeamPermissionsSection: React.FC<TeamPermissionsSectionProps> = ({
  teams,
  isLoading,
}) => {
  const { t } = useTranslation();

  if (isLoading) {
    return <PermissionSectionSkeleton />;
  }

  return teams.length === 0 ? (
    <Typography className="tw:text-tertiary" size="text-sm">
      {t('label.no-team-permissions')}
    </Typography>
  ) : (
    <Box direction="col" gap={4}>
      {teams.map((team) => (
        <TeamCard
          key={team.team.fullyQualifiedName ?? team.team.name}
          team={team}
        />
      ))}
    </Box>
  );
};

export default TeamPermissionsSection;
