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

import classNames from 'classnames';
import React, { useRef } from 'react';
import AppModeSwitcher from '../../../AppModeSwitcher/AppModeSwitcher';
import { UserProfileIcon } from '../../../Settings/Users/UserProfileIcon/UserProfileIcon.component';

export interface UserProfileCardProps {
  /**
   * `true` in the collapsed 32px rail: show only the avatar and drop the
   * full-width mode switcher (its label can't fit the rail — the switcher is
   * reachable once the panel is expanded).
   */
  compact?: boolean;
}

/**
 * Default user chrome for the ClassicV1 sidebar footer — the shared
 * `UserProfileIcon` (avatar, name, profile dropdown) plus the Classic/ClassicV1
 * `AppModeSwitcher`, mirroring Collate's user card. Rendered by
 * `MainPanel`/`Rail` only when no plugin contributes an
 * `app-mode.sidebar.*.footer` slot, so a downstream (Collate) user card still
 * overrides it. `cardRef` lets the switcher popover treat clicks inside the
 * card as "inside" and not self-close.
 */
const UserProfileCard: React.FC<UserProfileCardProps> = ({
  compact = false,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className={classNames('ask-user-card', {
        'tw:flex tw:flex-col tw:gap-2': !compact,
      })}
      data-testid="ask-user-card"
      ref={cardRef}>
      <UserProfileIcon />
      {compact ? null : <AppModeSwitcher cardRef={cardRef} />}
    </div>
  );
};

export default UserProfileCard;
