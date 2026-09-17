/*
 *  Copyright 2025 Collate.
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
import type { OwnerRef } from '@openmetadata/ui-core-components';
import { useCallback } from 'react';
import { ReactComponent as IconTeams } from '../assets/svg/common/teams.svg';
import type { EntityReference } from '../generated/type/entityReference';
import { getOwnersWithHref } from '../utils/ownerUtils';

/**
 * Stable callback that maps owner refs to core-component `OwnerRef`s with the
 * correct in-app profile href and a team icon. The owner hover card itself is
 * registered app-wide via `setOwnerRenderer` (see index.tsx), so consumers no
 * longer pass a `renderOwnerContent` prop.
 */
export const useOwnerDisplayProps = () => {
  const toOwnersWithHref = useCallback(
    (refs: EntityReference[] | undefined): OwnerRef[] =>
      getOwnersWithHref(refs ?? []).map((o) => ({
        ...o,
        icon: o.type === 'team' ? IconTeams : undefined,
      })),
    []
  );

  return { toOwnersWithHref };
};
