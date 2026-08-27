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
import { useGlossaryTermChildrenCount } from '../../../hooks/useGlossaryTermChildrenCount';
import { getCountBadge } from '../../../utils/EntityDisplayPureUtils';

interface GlossaryTermChildrenCountBadgeProps {
  fqn?: string;
  initialCount?: number;
  isActive?: boolean;
  // Bump this (e.g. a counter) to force a re-fetch after a mutation the badge
  // wouldn't otherwise notice, such as a term just added via the Add Term modal.
  refreshTrigger?: number;
}

// Renders the direct-children count with the same entityStatus filter the Terms table
// applies, so the tab badge always matches what the table actually lists instead of
// the unfiltered, all-descendants `childrenCount` field. The fetch/filter/cleanup
// logic itself lives in useGlossaryTermChildrenCount, shared with GlossaryDetails.
const GlossaryTermChildrenCountBadge = ({
  fqn,
  initialCount,
  isActive,
  refreshTrigger,
}: GlossaryTermChildrenCountBadgeProps) => {
  const childrenCount = useGlossaryTermChildrenCount(
    fqn,
    refreshTrigger,
    initialCount ?? 0
  );

  return <>{getCountBadge(childrenCount, '', isActive)}</>;
};

export default GlossaryTermChildrenCountBadge;
