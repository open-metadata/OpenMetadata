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
import { renderOwnerPopover } from '../utils/ownerRenderUtils';
import { getOwnersWithHref } from '../utils/ownerUtils';

/**
 * Stable callbacks for rendering owners with hover pop-over cards and
 * correct UI-path hrefs. Use in any component that renders <Owner> or
 * <OwnerAvatarStack> with isCompactView={false}.
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

  return { toOwnersWithHref, renderOwnerContent: renderOwnerPopover };
};
