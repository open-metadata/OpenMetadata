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

import { EntityTabs } from '../../../../enums/entity.enum';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import { getUserPath } from '../../../../utils/RouterUtils';
import { INBOX_MY_ASSETS_ACTIVITY_PATH } from '../../../discovery/personal-space/personalSpace.constants';

/**
 * Where the card's full feed lives: the AI-mode inbox on My Assets (the same
 * `my-feed` the card reads), or Classic's profile Activity tab.
 */
export const useTeamActivityPath = (): string => {
  const isAiMode = useIsAiMode();
  const userName = useApplicationStore(
    (state) => state.currentUser?.name ?? ''
  );

  return isAiMode
    ? INBOX_MY_ASSETS_ACTIVITY_PATH
    : getUserPath(userName, EntityTabs.ACTIVITY_FEED);
};
