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
import type { ReactNode } from 'react';
import { useCallback } from 'react';
import { ReactComponent as IconTeams } from '../assets/svg/common/teams.svg';
import UserPopOverCard from '../components/common/PopOverCard/UserPopOverCard';
import { OwnerType } from '../enums/user.enum';
import type { EntityReference } from '../generated/type/entityReference';
import { toOwnerRefs } from '../utils/Owner/ownerConversionUtils';
import { getOwnerPath } from '../utils/ownerUtils';

/**
 * Stable callbacks for rendering owners with hover pop-over cards and
 * correct UI-path hrefs. Use in any component that renders <Owner> or
 * <OwnerAvatarStack> with isCompactView={false}.
 */
export const useOwnerDisplayProps = () => {
  const toOwnersWithHref = useCallback(
    (refs: EntityReference[] | undefined): OwnerRef[] =>
      toOwnerRefs(refs ?? []).map((o) => ({
        ...o,
        href: getOwnerPath({
          id: o.id,
          name: o.name,
          type: o.type,
        } as EntityReference),
        icon: o.type === 'team' ? IconTeams : undefined,
      })),
    []
  );

  const renderOwnerContent = useCallback(
    (owner: { name?: string; type?: string }, chip: ReactNode): ReactNode => (
      <UserPopOverCard
        type={owner.type === 'team' ? OwnerType.TEAM : OwnerType.USER}
        userName={owner.name ?? ''}>
        {chip}
      </UserPopOverCard>
    ),
    []
  );

  return { toOwnersWithHref, renderOwnerContent };
};
