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
import classNames from 'classnames';
import React, { useRef } from 'react';
import AppModeSwitcher from '../../../AppModeSwitcher/AppModeSwitcher';
import AIUserMenu from '../../../discovery/personal-space/AIUserMenu/AIUserMenu';
import InboxIconButton from '../../../discovery/personal-space/InboxIconButton/InboxIconButton';

export interface UserProfileCardProps {
  /**
   * `true` in the collapsed 32px rail: show only the avatar and drop the
   * full-width mode switcher (its label can't fit the rail — the switcher is
   * reachable once the panel is expanded).
   */
  compact?: boolean;
}

/**
 * User chrome for the AI sidebar footer — the AI user menu (avatar,
 * name, profile dropdown), the inbox launcher, and the Classic/AI
 * `AppModeSwitcher`. `cardRef` lets the switcher popover treat clicks inside
 * the card as "inside" and not self-close. In the collapsed rail the card
 * mirrors the compact profile: inbox, user menu, mode switcher — no full-width
 * wrapper.
 */
const UserProfileCard: React.FC<UserProfileCardProps> = ({
  compact = false,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className={classNames('ask-user-card', {
        'tw:flex tw:flex-col tw:gap-2 tw:px-3 tw:py-2 tw:bg-primary tw:rounded-md':
          !compact,
        // Collapsed rail: no card box — `.ask-rail__profile` already stacks and
        // centers inbox / avatar / switcher. `display: contents` lets them be
        // its direct flex children (matching the old SidebarRailProfile).
        'ask-user-card--compact': compact,
      })}
      data-testid="ask-user-card"
      ref={cardRef}>
      {compact ? (
        <>
          <InboxIconButton />
          <AIUserMenu collapsed />
          <AppModeSwitcher compact />
        </>
      ) : (
        <>
          <Box>
            <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1.5">
              <AIUserMenu />
            </div>
            <InboxIconButton />
          </Box>
          <AppModeSwitcher cardRef={cardRef} />
        </>
      )}
    </div>
  );
};

export default UserProfileCard;
