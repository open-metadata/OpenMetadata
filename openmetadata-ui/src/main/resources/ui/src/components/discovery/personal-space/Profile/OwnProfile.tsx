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
import { FC, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import SomethingWentWrongPlaceholder from '../../../common/EmptyPlaceholder/SomethingWentWrongPlaceholder';
import ProfileDetailsPanel from './ProfileDetailsPanel';
import type { ProfileNavRenderContext } from './profileNavConfig';
import { buildUserIdentityHeader } from './tabs/members/useMembersUserDetailHeader';

/** Your own Profile tab: the identity header, then the panel. */
const OwnProfile: FC<ProfileNavRenderContext> = ({
  userData,
  isProfileLoading,
  loadError,
  onReload,
  updateUserDetails,
  onHeaderChange,
}) => {
  const { t } = useTranslation();
  useEffect(() => {
    onHeaderChange?.(buildUserIdentityHeader(t, userData, true));
  }, [onHeaderChange, t, userData]);

  useEffect(() => () => onHeaderChange?.(null), [onHeaderChange]);

  if (loadError) {
    return (
      <Box className="tw:relative tw:min-h-90 tw:flex-1">
        <SomethingWentWrongPlaceholder
          data-testid="profile-load-error"
          onReload={onReload}
        />
      </Box>
    );
  }

  return (
    <Box
      className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:p-8 tw:pt-0"
      data-testid="profile-content-body"
      direction="col">
      <ProfileDetailsPanel
        showCustomProperties
        isProfileLoading={isProfileLoading}
        updateUserDetails={updateUserDetails}
        userData={userData}
      />
    </Box>
  );
};

export default OwnProfile;
