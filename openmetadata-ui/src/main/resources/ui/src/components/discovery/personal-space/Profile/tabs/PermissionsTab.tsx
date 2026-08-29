/*
 *  Copyright 2025 Collate.
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
  Badge,
  BadgeColor,
  Box,
  Divider,
  Typography,
} from '@openmetadata/ui-core-components';
import { UserCheck01 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as PoliciesIcon } from '../../../../../assets/svg/policies.svg';
import { ReactComponent as TeamsIcon } from '../../../../../assets/svg/Teams.svg';
import { User } from '../../../../../generated/entity/teams/user';
import { useApplicationStore } from '../../../../../hooks/useApplicationStore';
import {
  getMyPermissionDebugInfo,
  getPermissionDebugInfo,
  PermissionDebugInfo,
} from '../../../../../rest/permissionAPI';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import DirectRolesSection from './permissions/DirectRolesSection';
import InheritedPermissionsSection from './permissions/InheritedPermissionsSection';
import MembershipSection from './permissions/MembershipSection';
import TeamPermissionsSection from './permissions/TeamPermissionsSection';
interface PermissionsTabProps {
  userData: User;
  updateUserDetails: (data: Partial<User>, key: keyof User) => Promise<void>;
}

interface SectionBlockProps {
  title: string;
  children: React.ReactNode;
}

/** A single stacked section: an uppercase heading, then its content below. */
const SectionBlock: React.FC<SectionBlockProps> = ({ title, children }) => (
  <Box direction="col" gap={3}>
    <Typography
      className="tw:text-primary-900 tw:uppercase"
      size="text-xs"
      weight="medium">
      {title}
    </Typography>
    {children}
  </Box>
);

interface StatTileProps {
  count: number;
  label: string;
  subLabel?: string;
  icon?: React.ReactNode;
}

const StatTile: React.FC<StatTileProps> = ({
  count,
  label,
  subLabel,
  icon,
}) => (
  <Box
    className="tw:flex-1 tw:rounded-lg tw:border tw:border-secondary tw:bg-primary tw:p-4"
    direction="col"
    gap={2}>
    <Box align="center" gap={2}>
      <Box className="tw:rounded-md tw:bg-success-50 tw:h-8 tw:w-8 tw:flex tw:items-center tw:justify-center">
        {icon}
      </Box>
      <Box direction="col">
        <Typography className="tw:text-utility-gray-900" weight="semibold">
          {count}
        </Typography>
        <Typography
          className="tw:text-utility-gray-700"
          size="text-sm"
          weight="medium">
          {label}
        </Typography>
      </Box>
    </Box>
    <Divider className="tw:h-0 tw:bg-transparent tw:border-t tw:border-dashed tw:border-border-secondary tw:-mx-1" />
    {subLabel && (
      <Typography
        className="tw:text-utility-gray-700"
        size="text-xs"
        weight="regular">
        {subLabel}
      </Typography>
    )}
  </Box>
);

const OperationChips: React.FC<{
  values: string[];
  color: BadgeColor<'pill-color'>;
}> = ({ values, color }) => (
  <Box align="center" className="tw:flex-wrap tw:gap-2">
    {values.map((operation) => (
      <Badge color={color} key={operation} size="sm" type="pill-color">
        {operation}
      </Badge>
    ))}
  </Box>
);

const PermissionsTab: React.FC<PermissionsTabProps> = ({
  userData,
  updateUserDetails,
}) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const [debugInfo, setDebugInfo] = useState<PermissionDebugInfo>();
  const [isLoading, setIsLoading] = useState(true);

  const isLoggedInUser = useMemo(
    () => userData.name === currentUser?.name,
    [userData.name, currentUser?.name]
  );

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const res = isLoggedInUser
          ? await getMyPermissionDebugInfo()
          : await getPermissionDebugInfo(userData.name);
        setDebugInfo(res.data);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [isLoggedInUser, userData.name]);

  const summary = debugInfo?.summary;
  const allowedOperations = summary?.effectiveOperations ?? [];
  const deniedOperations = summary?.deniedOperations ?? [];

  const sections: React.ReactNode[] = [
    <SectionBlock key="membership" title={t('label.membership')}>
      <MembershipSection
        updateUserDetails={updateUserDetails}
        userData={userData}
      />
    </SectionBlock>,

    <SectionBlock key="summary" title={t('label.permission-summary')}>
      <Box className="tw:flex-wrap" gap={3}>
        <StatTile
          count={summary?.totalRoles ?? 0}
          icon={
            <UserCheck01
              className="tw:text-success-600"
              height={20}
              width={20}
            />
          }
          label={t('label.total-role-plural')}
          subLabel={t('label.direct-inherited-summary', {
            direct: summary?.directRoles ?? 0,
            inherited: summary?.inheritedRoles ?? 0,
          })}
        />
        <StatTile
          count={summary?.totalPolicies ?? 0}
          icon={<PoliciesIcon height={24} width={24} />}
          label={t('label.policy-plural')}
          subLabel={t('label.rule-plural-count', {
            count: summary?.totalRules ?? 0,
          })}
        />
        <StatTile
          count={summary?.teamCount ?? 0}
          icon={<TeamsIcon height={24} width={24} />}
          label={t('label.team-plural')}
          subLabel={t('label.max-hierarchy-depth-value', {
            count: summary?.maxHierarchyDepth ?? 0,
          })}
        />
      </Box>
    </SectionBlock>,

    allowedOperations.length > 0 && (
      <SectionBlock key="allowed" title={t('label.allowed-operation-plural')}>
        <OperationChips color="blue" values={allowedOperations} />
      </SectionBlock>
    ),

    deniedOperations.length > 0 && (
      <SectionBlock key="denied" title={t('label.denied-operation-plural')}>
        <OperationChips color="error" values={deniedOperations} />
      </SectionBlock>
    ),

    <SectionBlock key="direct-roles" title={t('label.direct-role-plural')}>
      <DirectRolesSection
        isLoading={isLoading}
        roles={debugInfo?.directRoles ?? []}
      />
    </SectionBlock>,

    <SectionBlock
      key="team-permissions"
      title={t('label.team-permission-plural')}>
      <TeamPermissionsSection
        isLoading={isLoading}
        teams={debugInfo?.teamPermissions ?? []}
      />
    </SectionBlock>,

    <SectionBlock
      key="inherited"
      title={t('label.other-inherited-permission-plural')}>
      <InheritedPermissionsSection
        isLoading={isLoading}
        items={debugInfo?.inheritedPermissions ?? []}
      />
    </SectionBlock>,
  ].filter((section): section is React.ReactElement => Boolean(section));

  return (
    <Box
      className="tw:w-full tw:max-w-[800px] tw:rounded-b-[10px] tw:bg-primary"
      data-testid="profile-permissions"
      direction="col"
      gap={6}>
      {sections.map((section, index) => (
        <React.Fragment key={section.key}>
          {index > 2 && <Divider className="tw:border-t tw:border-secondary" />}
          {section}
        </React.Fragment>
      ))}
    </Box>
  );
};

export default PermissionsTab;
