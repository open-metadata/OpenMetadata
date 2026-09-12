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

import {
    Accordion,
    AccordionHeader,
    AccordionItem,
    AccordionPanel,
    Badge, Box, Card, Typography
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityType } from '../../../../../../enums/entity.enum';
import {
    DirectRolePermission,
    getMyPermissionDebugInfo,
    getPermissionDebugInfo,
    InheritedPermission,
    PermissionDebugInfo,
    PolicyInfo,
    RolePermission,
    RuleInfo,
    TeamPermission
} from '../../../../../../rest/permissionAPI';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import {
    getEntityDetailsPath,
    getPolicyWithFqnPath,
    getRoleWithFqnPath,
    getTeamsWithFqnPath
} from '../../../../../../utils/RouterUtils';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import Loader from '../../../../../common/Loader/Loader';

interface AccessControlUserPermissionsProps {
  username: string;
  isLoggedInUser: boolean;
}

const getEntityLink = (entityType: string, fqn: string) => {
  switch (entityType) {
    case EntityType.POLICY:
      return getPolicyWithFqnPath(fqn);
    case EntityType.ROLE:
      return getRoleWithFqnPath(fqn);
    case EntityType.TEAM:
      return getTeamsWithFqnPath(fqn);
    default:
      return getEntityDetailsPath(entityType as EntityType, fqn);
  }
};

const ruleEffectColor = (effect: string) =>
  effect === 'ALLOW' ? 'success' : 'error';

const renderRule = (rule: RuleInfo, index: number) => (
  <Box className="tw:mb-3" direction="col" gap={2} key={index}>
    <Box className="tw:flex-wrap" align="center" direction="row" gap={2} direction="row">
      <Typography className="tw:text-sm tw:font-semibold tw:text-primary">
        {rule.name}
      </Typography>
      <Badge color={ruleEffectColor(rule.effect)} size="sm" type="color">
        {rule.effect}
      </Badge>
    </Box>
    {!isEmpty(rule.operations) && (
      <Box className="tw:flex-wrap" align="center" direction="row" gap={1}>
        <Typography className="tw:text-sm tw:text-secondary tw:mr-1">
          Operations:
        </Typography>
        {rule.operations.map((op) => (
          <Badge key={op} size="sm" type="modern">
            {op}
          </Badge>
        ))}
      </Box>
    )}
    {!isEmpty(rule.resources) && (
      <Box className="tw:flex-wrap" align="center" direction="row" gap={1}>
        <Typography className="tw:text-sm tw:text-secondary tw:mr-1">
          Resources:
        </Typography>
        {rule.resources.map((res) => (
          <Badge key={res} size="sm" type="modern">
            {res}
          </Badge>
        ))}
      </Box>
    )}
    {rule.condition && (
      <Box align="center" direction="row" gap={2}>
        <Typography className="tw:text-sm tw:text-secondary">
          Condition:
        </Typography>
        <code className="tw:font-mono tw:bg-secondary tw:px-1 tw:rounded tw:text-sm">
          {rule.condition}
        </code>
      </Box>
    )}
  </Box>
);

const renderPolicy = (policy: PolicyInfo, index: number) => {
  const nonAllowColor = policy.effect === 'DENY' ? 'error' : 'warning';
  const policyColor =
    policy.effect === 'ALLOW' ? 'success' : nonAllowColor;

  return (
    <AccordionItem id={`policy-${index}`} key={index}>
      <AccordionHeader showChevron>
        <Box className="tw:flex-wrap" align="center" direction="row" gap={2} direction="row">
          <Link
            to={getEntityLink('policy', policy.policy.fullyQualifiedName || '')}
            onClick={(e) => e.stopPropagation()}>
            {getEntityName(policy.policy)}
          </Link>
          <Badge color={policyColor} size="sm" type="color">
            {policy.effect}
          </Badge>
          <Typography className="tw:text-sm tw:text-secondary">
            {`${policy.rules.length} rules`}
          </Typography>
        </Box>
      </AccordionHeader>
      <AccordionPanel>
        <Box className="tw:w-full" direction='col'>
          {policy.rules.map((rule, ruleIndex) => renderRule(rule, ruleIndex))}
        </Box>
      </AccordionPanel>
    </AccordionItem>
  );
};

const SectionCard = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <Card className="tw:overflow-hidden tw:mb-4">
    <Box className="tw:px-6 tw:py-4 tw:border-b tw:border-secondary">
      <Typography className="tw:text-sm tw:font-semibold tw:text-primary">
        {title}
      </Typography>
    </Box>
    <Box className="tw:p-6" direction='col' gap={4}>{children}</Box>
  </Card>
);

const AccessControlUserPermissions: React.FC<
  AccessControlUserPermissionsProps
> = ({ username, isLoggedInUser }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [permissionInfo, setPermissionInfo] = useState<PermissionDebugInfo>();

  useEffect(() => {
    setLoading(true);
    const fetchFn = isLoggedInUser
      ? getMyPermissionDebugInfo()
      : getPermissionDebugInfo(username);

    fetchFn
      .then((resp) => setPermissionInfo(resp.data))
      .catch((error: AxiosError) => showErrorToast(error))
      .finally(() => setLoading(false));
  }, [username, isLoggedInUser]);

  if (loading) {
    return (
      <Box className="tw:py-8" justify="center">
        <Loader />
      </Box>
    );
  }

  const renderSummary = () => {
    const { summary } = permissionInfo ?? {};
    if (!summary) {
      return null;
    }

    return (
      <SectionCard title={t('label.permission-summary')}>
        <Box className="tw:grid tw:grid-cols-3 tw:gap-4 tw:mb-4">
          <Box direction="col" gap={1}>
            <Typography className="tw:text-sm tw:text-secondary">
              {t('label.total-role-plural')}
            </Typography>
            <Typography className="tw:text-xl tw:font-bold tw:text-primary">
              {String(summary.totalRoles)}
            </Typography>
            <Typography className="tw:text-sm tw:text-secondary">
              {`${summary.directRoles} ${t('label.direct-lowercase')}, ${summary.inheritedRoles} ${t('label.inherited')}`}
            </Typography>
          </Box>
          <Box direction="col" gap={1}>
            <Typography className="tw:text-sm tw:text-secondary">
              {t('label.policy-plural')}
            </Typography>
            <Typography className="tw:text-xl tw:font-bold tw:text-primary">
              {String(summary.totalPolicies)}
            </Typography>
            <Typography className="tw:text-sm tw:text-secondary">
              {`${summary.totalRules} ${t('label.rule-lowercase-plural')}`}
            </Typography>
          </Box>
          <Box direction="col" gap={1}>
            <Typography className="tw:text-sm tw:text-secondary">
              {t('label.team-plural')}
            </Typography>
            <Typography className="tw:text-xl tw:font-bold tw:text-primary">
              {String(summary.teamCount)}
            </Typography>
            <Typography className="tw:text-sm tw:text-secondary">
              {`${t('label.max-hierarchy-depth')}: ${summary.maxHierarchyDepth}`}
            </Typography>
          </Box>
        </Box>

        {!isEmpty(summary.effectiveOperations) && (
          <Box className="tw:mb-3" direction='col' gap={2}>
            <Typography className="tw:text-sm tw:font-semibold tw:text-primary tw:mb-2">
              {`${t('label.allowed-operation-plural')}:`}
            </Typography>
            <Box className="tw:flex-wrap" direction="row" gap={1}>
              {summary.effectiveOperations.map((op) => (
                <Badge color="success" key={op} size="sm" type="color">
                  {op}
                </Badge>
              ))}
            </Box>
          </Box>
        )}

        {!isEmpty(summary.deniedOperations) && (
          <Box direction='col' gap={2}>
            <Typography className="tw:text-sm tw:font-semibold tw:text-primary tw:mb-2">
              {`${t('label.denied-operation-plural')}:`}
            </Typography>
            <Box className="tw:flex-wrap" direction="row" gap={1}>
              {summary.deniedOperations.map((op) => (
                <Badge color="error" key={op} size="sm" type="color">
                  {op}
                </Badge>
              ))}
            </Box>
          </Box>
        )}
      </SectionCard>
    );
  };

  const renderDirectRoles = () => {
    if (isEmpty(permissionInfo?.directRoles)) {
      return null;
    }

    return (
      <SectionCard title={t('label.direct-role-plural')}>
        {permissionInfo?.directRoles.map(
          (rolePermission: DirectRolePermission) => (
            <Box className="tw:mb-6" direction='col' key={rolePermission.role.id}>
              <Box
                className="tw:mb-3" align="center" direction="row" gap={2}
                direction="row">
                <Typography className="tw:text-sm tw:font-semibold tw:text-secondary">
                  {`${t('label.role')}:`}
                </Typography>
                <Link
                  to={getEntityLink(
                    'role',
                    rolePermission.role.fullyQualifiedName || ''
                  )}>
                  {getEntityName(rolePermission.role)}
                </Link>
              </Box>
              {rolePermission.policies.length > 0 && (
                <Accordion allowsMultipleExpanded>
                  {rolePermission.policies.map((policy, policyIndex) =>
                    renderPolicy(policy, policyIndex)
                  )}
                </Accordion>
              )}
            </Box>
          )
        )}
      </SectionCard>
    );
  };

  const renderRolePermission = (
    rolePermission: RolePermission,
    index: number
  ) => (
    <Box className="tw:mb-6" key={index}>
      <Box
        className="tw:flex-wrap tw:mb-2" align="center" direction="row" gap={2}
        direction="row">
        <Typography className="tw:text-sm tw:font-semibold tw:text-secondary">
          {`${t('label.role')}:`}
        </Typography>
        <Link
          to={getEntityLink(
            'role',
            rolePermission.role.fullyQualifiedName || ''
          )}>
          {getEntityName(rolePermission.role)}
        </Link>
        {rolePermission.isDefaultRole && (
          <Badge color="brand" size="sm" type="color">
            {t('label.default-role')}
          </Badge>
        )}
      </Box>
      <Typography className="tw:text-sm tw:text-secondary tw:mb-3">
        {`${t('label.inherited-from')}: ${rolePermission.inheritedFrom}`}
      </Typography>
      {rolePermission.policies.length > 0 && (
        <Accordion allowsMultipleExpanded>
          {rolePermission.policies.map((policy, policyIndex) =>
            renderPolicy(policy, policyIndex)
          )}
        </Accordion>
      )}
    </Box>
  );

  const renderTeamPermissions = () => {
    if (isEmpty(permissionInfo?.teamPermissions)) {
      return null;
    }

    return (
      <SectionCard title={t('label.team-permission-plural')}>
        {permissionInfo?.teamPermissions.map(
          (teamPermission: TeamPermission) => (
            <Box direction='col' gap={2} key={teamPermission.team.id}>
              <Box
                className="tw:flex-wrap tw:mb-3" align="center" direction="row" gap={2}
                direction="row">
                <Typography className="tw:text-sm tw:font-semibold tw:text-secondary">
                  {`${t('label.team')}:`}
                </Typography>
                <Link
                  to={getEntityLink(
                    'team',
                    teamPermission.team.fullyQualifiedName || ''
                  )}>
                  {getEntityName(teamPermission.team)}
                </Link>
                <Badge size="sm" type="modern">
                  {teamPermission.teamType}
                </Badge>
                {teamPermission.hierarchyLevel > 0 && (
                  <Badge color="warning" size="sm" type="color">
                    {`${t('label.level')} ${teamPermission.hierarchyLevel} ${t('label.inherited')}`}
                  </Badge>
                )}
              </Box>

              {!isEmpty(teamPermission.teamHierarchy) &&
                teamPermission.teamHierarchy.length > 1 && (
                  <Box
                    className="tw:flex-wrap tw:mb-3" align="center" direction="row" gap={1}
                    direction="row">
                    <Typography className="tw:text-sm tw:text-secondary">
                      {`${t('label.hierarchy')}: `}
                    </Typography>
                    {teamPermission.teamHierarchy.map((team, idx) => (
                      <React.Fragment key={team.id}>
                        <Link
                          to={getEntityLink(
                            'team',
                            team.fullyQualifiedName || ''
                          )}>
                          {getEntityName(team)}
                        </Link>
                        {idx < teamPermission.teamHierarchy.length - 1 && (
                          <Typography className="tw:text-sm tw:text-secondary">
                            →
                          </Typography>
                        )}
                      </React.Fragment>
                    ))}
                  </Box>
                )}

              {!isEmpty(teamPermission.rolePermissions) && (
                <Box className="tw:mt-3 tw:mb-3">
                  <Typography className="tw:text-sm tw:font-semibold tw:text-primary tw:mb-3">
                    {`${t('label.team-role-plural')}:`}
                  </Typography>
                  {teamPermission.rolePermissions.map(
                    (rolePermission, roleIndex) =>
                      renderRolePermission(rolePermission, roleIndex)
                  )}
                </Box>
              )}

              {!isEmpty(teamPermission.directPolicies) && (
                <Box className="tw:mt-3 tw:mb-3" direction='col' gap={2}>
                  <Typography className="tw:text-sm tw:font-semibold tw:text-primary tw:mb-3">
                    {`${t('label.direct-team-policy-plural')}:`}
                  </Typography>
                  <Accordion allowsMultipleExpanded>
                    {teamPermission.directPolicies.map((policy, policyIndex) =>
                      renderPolicy(policy, policyIndex)
                    )}
                  </Accordion>
                </Box>
              )}

              <Box className="tw:h-px tw:my-5" />
            </Box>
          )
        )}
      </SectionCard>
    );
  };

  const renderInheritedPermissions = () => {
    if (isEmpty(permissionInfo?.inheritedPermissions)) {
      return null;
    }

    return (
      <SectionCard title={t('label.other-inherited-permission-plural')}>
        {permissionInfo?.inheritedPermissions.map(
          (inherited: InheritedPermission) => (
            <Box
              className="tw:mb-4"
              key={`${inherited.permissionType}-${inherited.source?.id ?? 'none'}`}>
              <Box
                className="tw:mb-1" align="center" direction="row" gap={2}
                direction="row">
                <Typography className="tw:text-sm tw:font-semibold tw:text-secondary">
                  {`${t('label.type')}:`}
                </Typography>
                <Badge color="gray" size="sm" type="color">
                  {inherited.permissionType}
                </Badge>
              </Box>
              <Typography className="tw:text-sm tw:text-primary tw:mb-1">
                {inherited.description}
              </Typography>
              {inherited.source && (
                <Box
                  className="tw:mb-2" align="center" direction="row" gap={1}
                  direction="row">
                  <Typography className="tw:text-sm tw:text-secondary">
                    {`${t('label.source')}:`}
                  </Typography>
                  <Link
                    to={getEntityLink(
                      inherited.source.type || '',
                      inherited.source.fullyQualifiedName || ''
                    )}>
                    {getEntityName(inherited.source)}
                  </Link>
                </Box>
              )}
              {inherited.policies.length > 0 && (
                <Accordion allowsMultipleExpanded>
                  {inherited.policies.map((policy, policyIndex) =>
                    renderPolicy(policy, policyIndex)
                  )}
                </Accordion>
              )}
            </Box>
          )
        )}
      </SectionCard>
    );
  };

  return (
    <Box className="tw:w-full" direction='col'>
      {renderSummary()}
      {renderDirectRoles()}
      {renderTeamPermissions()}
      {renderInheritedPermissions()}
    </Box>
  );
};

export default AccessControlUserPermissions;
