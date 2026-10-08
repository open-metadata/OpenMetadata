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

import { Box, Card, Divider } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import React from 'react';
import AIUserMenu from '../../../discovery/personal-space/AIUserMenu/AIUserMenu';
import InboxIconButton from '../../../discovery/personal-space/InboxIconButton/InboxIconButton';

export interface UserProfileCardProps {
  /** `true` in the collapsed rail: inbox stacked over the avatar. */
  compact?: boolean;
}

/**
 * User chrome for the AI sidebar footer — the AI user menu (avatar, name,
 * domain scope, profile dropdown) and the inbox launcher. The card border
 * highlights while the profile menu it opens is showing.
 */
const UserProfileCard: React.FC<UserProfileCardProps> = ({
  compact = false,
}) => (
  <Card
    className={classNames(
      'tw:w-full tw:has-[[aria-expanded=true]]:border-brand-subtle',
      compact ? 'tw:p-2' : 'tw:py-2 tw:pr-2 tw:pl-3'
    )}
    data-testid="ask-user-card">
    <Box
      align="center"
      direction={compact ? 'col' : 'row'}
      gap={compact ? 3 : 2}>
      {compact ? (
        <>
          <InboxIconButton />
          <Divider />
          <AIUserMenu collapsed />
        </>
      ) : (
        <>
          <AIUserMenu />
          <Box className="tw:rounded-lg tw:border tw:border-secondary tw:bg-primary tw:p-1 tw:shadow-xs">
            <InboxIconButton />
          </Box>
        </>
      )}
    </Box>
  </Card>
);

export default UserProfileCard;
