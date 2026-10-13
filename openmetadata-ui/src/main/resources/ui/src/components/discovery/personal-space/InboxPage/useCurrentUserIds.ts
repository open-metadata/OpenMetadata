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
import { useMemo } from 'react';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';

/**
 * The viewer's own id plus their teams': a task assigned to a team is theirs to
 * act on, so both decide whether it reads "pending approval".
 */
export const useCurrentUserIds = (): ReadonlySet<string> => {
  const { currentUser } = useApplicationStore();

  return useMemo(
    () =>
      new Set(
        [currentUser?.id, ...(currentUser?.teams ?? []).map((team) => team.id)]
          .filter(Boolean)
          .map(String)
      ),
    [currentUser?.id, currentUser?.teams]
  );
};
