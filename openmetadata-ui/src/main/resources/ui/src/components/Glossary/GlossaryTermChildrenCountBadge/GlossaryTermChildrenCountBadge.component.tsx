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
import { useEffect, useState } from 'react';
import { getFirstLevelGlossaryTermsPaginated } from '../../../rest/glossaryAPI';
import { getCountBadge } from '../../../utils/EntityDisplayPureUtils';
import { useGlossaryStore } from '../useGlossary.store';

interface GlossaryTermChildrenCountBadgeProps {
  fqn?: string;
  initialCount?: number;
  isActive?: boolean;
  // Bump this (e.g. a counter) to force a re-fetch after a mutation the badge
  // wouldn't otherwise notice, such as a term just added via the Add Term modal.
  refreshTrigger?: number;
}

// Fetches the direct-children count with the same entityStatus filter the Terms table
// applies (`directChildrenOf` + `limit=0`), so the tab badge always matches what the
// table actually lists instead of the unfiltered, all-descendants `childrenCount` field.
// The filter itself comes from useGlossaryStore's termsStatusFilter, kept live by
// GlossaryTermTab (see its getEntityStatusParamFromSelection effect) — a genuinely
// undefined value there means the user explicitly selected All statuses (no filter),
// so it is passed straight through here, not defaulted.
const GlossaryTermChildrenCountBadge = ({
  fqn,
  initialCount,
  isActive,
  refreshTrigger,
}: GlossaryTermChildrenCountBadgeProps) => {
  const [childrenCount, setChildrenCount] = useState(initialCount ?? 0);
  const { termsStatusFilter } = useGlossaryStore();

  useEffect(() => {
    if (!fqn) {
      return;
    }

    let isMounted = true;

    const fetchChildrenCount = async () => {
      try {
        const { paging } = await getFirstLevelGlossaryTermsPaginated(
          fqn,
          0,
          undefined,
          termsStatusFilter
        );
        if (isMounted) {
          setChildrenCount(paging.total ?? 0);
        }
      } catch {
        if (isMounted) {
          setChildrenCount(0);
        }
      }
    };

    fetchChildrenCount();

    return () => {
      isMounted = false;
    };
  }, [fqn, refreshTrigger, termsStatusFilter]);

  return <>{getCountBadge(childrenCount, '', isActive)}</>;
};

export default GlossaryTermChildrenCountBadge;
