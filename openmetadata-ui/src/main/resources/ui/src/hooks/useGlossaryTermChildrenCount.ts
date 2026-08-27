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
import { useGlossaryStore } from '../components/Glossary/useGlossary.store';
import { getFirstLevelGlossaryTermsPaginated } from '../rest/glossaryAPI';

// Fetches the direct-children count for a glossary/glossary-term FQN, filtered to the
// same entityStatus the Terms table is currently using, via limit=0 (count-only, no
// row fetch) — shared by GlossaryDetails (Glossary root page) and
// GlossaryTermChildrenCountBadge (Glossary Term page), which both need the exact same
// fetch/guard/cleanup logic so their counts always agree with the table.
// termsStatusFilter is seeded in useGlossary.store with the table's own default filter
// (not undefined), so once the table has mounted and pushed its live filter via
// setTermsStatusFilter (see GlossaryTermTab.component.tsx), a genuinely-undefined value
// here means the user explicitly selected All statuses (no filter) — not "not yet
// published" — so it must be passed straight through, not defaulted.
export const useGlossaryTermChildrenCount = (
  fqn: string | undefined,
  refreshTrigger?: unknown,
  initialCount = 0
): number => {
  const [count, setCount] = useState(initialCount);
  const { termsStatusFilter } = useGlossaryStore();

  useEffect(() => {
    if (!fqn) {
      return;
    }

    let isMounted = true;

    const fetchCount = async () => {
      try {
        const { paging } = await getFirstLevelGlossaryTermsPaginated(
          fqn,
          0,
          undefined,
          termsStatusFilter
        );
        if (isMounted) {
          setCount(paging.total ?? 0);
        }
      } catch {
        if (isMounted) {
          setCount(0);
        }
      }
    };

    fetchCount();

    return () => {
      isMounted = false;
    };
  }, [fqn, refreshTrigger, termsStatusFilter]);

  return count;
};
