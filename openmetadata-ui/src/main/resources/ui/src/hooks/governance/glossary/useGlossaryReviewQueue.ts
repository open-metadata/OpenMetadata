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
import { useEffect, useMemo, useState } from 'react';
import { ProposalFilter } from '../../../utils/GlossaryReview/GlossaryReview.types';
import {
  getActiveFilter,
  getTotalPages,
} from '../../../utils/GlossaryReview/GlossaryReview.utils';
import {
  ProposalScope,
  PROPOSALS_PAGE_SIZE,
  useGlossaryProposal,
  useGlossaryProposalCounts,
  useGlossaryProposalPage,
} from './useGlossaryProposals';

/**
 * The server pages the queue; a selected off-page proposal is shown first so selecting a table
 * row always opens its proposal.
 */
export const useGlossaryReviewQueue = (
  scope: ProposalScope | undefined,
  selectedProposalId?: string
) => {
  const [filter, setFilter] = useState<ProposalFilter>('all');
  const [page, setPage] = useState(1);
  const { counts, isLoading: isCounting } = useGlossaryProposalCounts(scope);
  const activeFilter = getActiveFilter(counts, filter);
  const totalPages = getTotalPages(counts, activeFilter, PROPOSALS_PAGE_SIZE);
  const currentPage = Math.min(page, totalPages);
  const { proposals, isLoading: isPageLoading } = useGlossaryProposalPage(
    scope,
    activeFilter,
    currentPage,
    counts
  );
  const isSelectedOnPage = proposals.some(
    ({ term }) => term.id === selectedProposalId
  );
  const selected = useGlossaryProposal(
    isSelectedOnPage ? undefined : selectedProposalId
  );
  const visible = useMemo(
    () =>
      scope?.fullyQualifiedName &&
      selected?.term.fullyQualifiedName?.startsWith(
        `${scope.fullyQualifiedName}.`
      )
        ? [selected, ...proposals]
        : proposals,
    [scope?.fullyQualifiedName, selected, proposals]
  );

  useEffect(() => setPage(1), [activeFilter, scope?.id]);

  return {
    activeFilter,
    counts,
    currentPage,
    isLoading: isCounting || isPageLoading,
    setFilter,
    setPage,
    totalPages,
    visible,
  };
};
