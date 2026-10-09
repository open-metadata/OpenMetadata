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
import React, { useRef } from 'react';
import AppModeSwitcher from '../../../AppModeSwitcher/AppModeSwitcher';
import AIUserMenu from '../../../discovery/personal-space/AIUserMenu/AIUserMenu';
import InboxIconButton from '../../../discovery/personal-space/InboxIconButton/InboxIconButton';

export interface UserProfileCardProps {
  /** `true` in the collapsed rail: inbox, avatar and the compact mode switcher stacked. */
  compact?: boolean;
}

/**
 * User chrome for the AI sidebar footer — the profile card (AI user menu with
 * avatar, name, domain scope and profile dropdown, plus the inbox launcher)
 * and, in its own card below, the Classic/AI `AppModeSwitcher`. The switcher
 * gets its card as `cardRef`, so its popover treats clicks inside that card as
 * "inside" and does not self-close.
 */
const UserProfileCard: React.FC<UserProfileCardProps> = ({
  compact = false,
}) => {
  const switcherCardRef = useRef<HTMLDivElement>(null);

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

  // Own wrapper so the two cards sit 6px apart instead of the footer's 12px gap.
  return (
    <Box className="tw:w-full tw:gap-1.5" direction="col">
      <Card
        className="tw:w-full tw:bg-primary tw:py-2.5 tw:pr-2.5 tw:pl-3 tw:shadow-xs"
        data-testid="ask-user-card">
        <Box align="center" gap={2}>
          <AIUserMenu />
          <Box
            align="center"
            className="tw:size-10 tw:shrink-0 tw:rounded-xl tw:border tw:border-secondary tw:bg-surface"
            justify="center">
            <InboxIconButton />
          </Box>
        </Box>
      </Card>
      <Card
        className="tw:w-full tw:bg-primary tw:px-3 tw:py-2 tw:shadow-xs"
        data-testid="ask-app-mode-card"
        ref={switcherCardRef}>
        <AppModeSwitcher cardRef={switcherCardRef} />
      </Card>
    </Box>
  );
};

export default UserProfileCard;
