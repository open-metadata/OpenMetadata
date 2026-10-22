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
import { ProposalFilter } from '../../../../utils/GlossaryReview/GlossaryReview.types';

export const FILTERS: ProposalFilter[] = ['all', 'ai', 'person'];

export const FILTER_LABELS: Record<ProposalFilter, string> = {
  all: 'label.filter-all-count',
  ai: 'label.filter-ai-count',
  person: 'label.filter-people-count',
};

/** "Select AI ≥ N%" picks the AI proposals at or above this confidence. */
export const HIGH_CONFIDENCE_PERCENT = 90;

export const SEARCH_DEBOUNCE_MS = 300;

export const LOCATION_SEPARATOR = ' › ';
