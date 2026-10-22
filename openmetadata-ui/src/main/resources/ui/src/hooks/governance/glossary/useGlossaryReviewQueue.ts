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
import { ProposalFilter } from '../../../utils/GlossaryReview/GlossaryReview.types';
import { getActiveFilter } from '../../../utils/GlossaryReview/GlossaryReview.utils';
import {
  ProposalScope,
  PROPOSALS_PAGE_SIZE,
  useGlossaryProposalCounts,
  useGlossaryProposalPage,
} from './useGlossaryProposals';

/**
 * The review queue of a glossary or term: the server filters it by who proposed and by a search,
 * and it grows a page at a time.
 */
export const useGlossaryReviewQueue = (scope: ProposalScope | undefined) => {
  const [filter, setFilter] = useState<ProposalFilter>('all');
  const [search, setSearch] = useState('');
  const [shown, setShown] = useState(PROPOSALS_PAGE_SIZE);
  // Unsearched counts pick the filters; the searched ones size the list.
  const { counts: totals, isLoading: isCounting } =
    useGlossaryProposalCounts(scope);
  const { counts } = useGlossaryProposalCounts(scope, search);
  const activeFilter = getActiveFilter(totals, filter);
  const { proposals, isLoading: isPageLoading } = useGlossaryProposalPage(
    scope,
    activeFilter,
    shown,
    counts,
    search
  );

  useEffect(
    () => setShown(PROPOSALS_PAGE_SIZE),
    [activeFilter, scope?.id, search]
  );

  return {
    activeFilter,
    counts,
    totals,
    isLoading: isCounting || isPageLoading,
    search,
    setFilter,
    setSearch,
    hasMore: proposals.length < counts[activeFilter],
    loadMore: () => setShown((previous) => previous + PROPOSALS_PAGE_SIZE),
    proposals,
  };
};
