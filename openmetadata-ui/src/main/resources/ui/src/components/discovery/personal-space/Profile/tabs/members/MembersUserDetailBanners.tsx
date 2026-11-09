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

import { Alert, Button, Typography } from '@openmetadata/ui-core-components';
import {
  ArrowUpRight,
  InfoCircle,
  Server01,
  Trash01,
} from '@openmetadata/ui-core-components/icons';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { User } from '../../../../../../generated/entity/teams/user';
import { useAuth } from '../../../../../../hooks/authHooks';
import { useSettingsHash } from '../../../../../../hooks/useSettingsHash';
import { formatDate } from '../../../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { getUserFirstName } from '../../../../../../utils/UsersPureUtils';
import type { UserDetailTab } from './Members.types';

interface MembersUserDetailBannersProps {
  user: User;
  activeTab: UserDetailTab;
  /** Ungated by `deleted`: restore is the way back for a deleted user. */
  canRestore: boolean;
  onRestore: () => void;
}

/** The deleted / bot / admin notices shown above a user's tab content. */
const MembersUserDetailBanners: FC<MembersUserDetailBannersProps> = ({
  user,
  activeTab,
  canRestore,
  onRestore,
}) => {
  const { t } = useTranslation();
  // The Bots nav item is admin-only (profileNavConfig).
  const { isAdminUser } = useAuth();
  const { setHash } = useSettingsHash();
  const firstName = getUserFirstName(user);

  return (
    <>
      {user.deleted && (
        <Alert
          data-testid="user-deleted-banner"
          icon={Trash01}
          iconSize="sm"
          rightContent={
            canRestore && (
              <Button
                color="secondary-destructive"
                data-testid="banner-restore-user"
                size="sm"
                onPress={onRestore}>
                {t('label.restore-entity', { entity: t('label.user') })}
              </Button>
            )
          }
          variant="error">
          <Typography as="span" size="text-sm" weight="medium">
            {/* updatedAt is the deletion time while the user stays deleted. */}
            {t('message.user-deleted-on', {
              name: getEntityName(user),
              date: formatDate(user.updatedAt),
            })}
          </Typography>{' '}
          {t('message.user-deleted-read-only-description')}
        </Alert>
      )}
      {user.isBot && activeTab === 'overview' && (
        <Alert
          data-testid="user-bot-banner"
          icon={Server01}
          iconSize="sm"
          rightContent={
            isAdminUser && (
              // BotsPanel reads the bot name from the hash as is.
              <Button
                color="link-color"
                data-testid="open-in-bots"
                iconTrailing={ArrowUpRight}
                size="sm"
                onPress={() => setHash('bots', user.name)}>
                {t('label.open-in-bots')}
              </Button>
            )
          }
          variant="gray">
          <Typography as="span" size="text-sm" weight="medium">
            {t('message.this-is-a-bot-account')}
          </Typography>{' '}
          {t('message.bot-account-description')}
        </Alert>
      )}
      {user.isAdmin && !user.isBot && activeTab === 'access' && (
        <Alert
          data-testid="user-admin-banner"
          icon={InfoCircle}
          iconSize="sm"
          variant="brand">
          <Typography as="span" size="text-sm" weight="medium">
            {t('message.user-is-an-admin', { name: firstName })}
          </Typography>{' '}
          {t('message.user-admin-bypasses-policies', { name: firstName })}
        </Alert>
      )}
    </>
  );
};

export default MembersUserDetailBanners;
