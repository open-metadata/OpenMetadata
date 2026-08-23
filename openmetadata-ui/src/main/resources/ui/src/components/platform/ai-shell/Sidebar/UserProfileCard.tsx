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

import React from 'react';
import { UserProfileIcon } from '../../../Settings/Users/UserProfileIcon/UserProfileIcon.component';

/**
 * Default user chrome for the ClassicV1 sidebar footer — reuses the shared
 * `UserProfileIcon` (avatar, name, and the profile dropdown that also carries
 * the Classic/ClassicV1 mode switcher). Rendered by `MainPanel`/`Rail` only
 * when no plugin contributes an `app-mode.sidebar.*.footer` slot, so a
 * downstream (Collate) user card still overrides it.
 */
const UserProfileCard: React.FC = () => (
  <div className="ask-user-card" data-testid="ask-user-card">
    <UserProfileIcon />
  </div>
);

export default UserProfileCard;
