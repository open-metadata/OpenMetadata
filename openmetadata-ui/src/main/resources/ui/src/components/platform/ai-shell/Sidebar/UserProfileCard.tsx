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
import React from 'react';
import AppModeSwitcher from '../../../AppModeSwitcher/AppModeSwitcher';
import AIUserMenu from '../../../discovery/personal-space/AIUserMenu/AIUserMenu';
import InboxIconButton from '../../../discovery/personal-space/InboxIconButton/InboxIconButton';

export interface UserProfileCardProps {
  /** `true` in the collapsed rail: inbox, avatar and the compact mode switcher stacked. */
  compact?: boolean;
}

/**
 * User chrome for the AI sidebar footer — one card holding the AI user menu
 * (avatar, name, domain scope, profile dropdown) beside the inbox launcher,
 * and below a divider the Classic/AI `AppModeSwitcher`.
 */
const UserProfileCard: React.FC<UserProfileCardProps> = ({
  compact = false,
}) => {
  if (compact) {
    // The compact switcher is wider than the rail card, so it sits below it.
    return (
      <>
        <Card
          className="tw:mx-auto tw:w-14 tw:bg-primary tw:p-1.5 tw:shadow-xs"
          data-testid="ask-user-card">
          <Box align="center" direction="col" gap={1}>
            <Box align="center" className="tw:size-11" justify="center">
              <InboxIconButton />
            </Box>
            <Divider className="tw:w-7" />
            <AIUserMenu collapsed />
          </Box>
        </Card>
        <AppModeSwitcher compact />
      </>
    );
  }

  return (
    <Card
      className="tw:w-full tw:bg-primary tw:py-2.5 tw:pr-2.5 tw:pl-3 tw:shadow-xs"
      data-testid="ask-user-card">
      <Box align="center" gap={2}>
        <AIUserMenu />
        {/* Concentric with the 32px launcher inside it: its 4px radius plus
            the ~4px inset gives this frame its 8px. */}
        <Box
          align="center"
          className="tw:size-10 tw:shrink-0 tw:rounded-lg tw:border tw:border-secondary tw:bg-surface"
          justify="center">
          <InboxIconButton />
        </Box>
      </Box>
      <Divider className="tw:my-2.5" />
      <AppModeSwitcher />
    </Card>
  );
};

export default UserProfileCard;
