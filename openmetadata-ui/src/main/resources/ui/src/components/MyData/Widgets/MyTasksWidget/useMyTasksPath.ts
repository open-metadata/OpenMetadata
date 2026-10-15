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

import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import { getUserPath } from '../../../../utils/RouterUtils';
import { PERSONAL_SPACE_ROUTES } from '../../../discovery/personal-space/personalSpace.constants';
import { UserPageTabs } from '../../../Settings/Users/Users.interface';

/** Where the viewer's full task list lives: the AI-mode inbox, or Classic's profile tab. */
export const useMyTasksPath = (): string => {
  const isAiMode = useIsAiMode();
  const userName = useApplicationStore(
    (state) => state.currentUser?.name ?? ''
  );

  return isAiMode
    ? PERSONAL_SPACE_ROUTES.INBOX_TASKS
    : getUserPath(userName, UserPageTabs.TASK);
};
