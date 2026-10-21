/*
 *  Copyright 2023 Collate.
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

import { PAGE_SIZE_BASE } from '../../../../../../constants/constants';
import {
  CATEGORIES,
  DURATIONS,
  LearningResourceStatus,
  MAX_CHAIN_PAGES,
  PAGE_IDS,
} from '../../../../../../constants/Learning.constants';
import type { PageViewMode } from '../../../../../../generated/type/personaPreferences';
import {
  CreateLearningResource,
  LearningResource,
  LearningResourceType,
} from '../../../../../../rest/learningResourceAPI';

export interface SelectItem {
  id: string;
  label: string;
}

export interface LearningResourceFormValues {
  name: string;
  description: string;
  resourceType: SelectItem | null;
  categories: SelectItem[];
  contexts: SelectItem[];
  sourceUrl: string;
  sourceProvider: string;
  estimatedDuration: SelectItem | null;
  status: SelectItem | null;
}

export const CATEGORY_ITEMS: SelectItem[] = CATEGORIES.map(
  ({ value, label }) => ({ id: value, label })
);

export const CONTEXT_ITEMS: SelectItem[] = PAGE_IDS.map(({ value, label }) => ({
  id: value,
  label,
}));

export const STATUS_ITEMS: SelectItem[] = Object.values(
  LearningResourceStatus
).map((status) => ({ id: status, label: status }));

/** "5 mins" → 300 seconds, the unit the API stores. */
export const parseDuration = (duration: string): number => {
  const match = /(\d+)/.exec(duration);

  return match ? Number.parseInt(match[1], 10) * 60 : 0;
};

export const DURATION_ITEMS: SelectItem[] = DURATIONS.map((duration) => ({
  id: String(parseDuration(duration)),
  label: duration,
}));

const findItems = (items: SelectItem[], ids: string[] = []) =>
  ids.map((id) => items.find((item) => item.id === id) ?? { id, label: id });

export const toLearningResourceFormValues = (
  resource?: LearningResource,
  typeLabel: (type: LearningResourceType) => string = (type) => type
): LearningResourceFormValues => ({
  name: resource?.name ?? '',
  description: resource?.description ?? '',
  resourceType: resource
    ? { id: resource.resourceType, label: typeLabel(resource.resourceType) }
    : null,
  categories: findItems(CATEGORY_ITEMS, resource?.categories),
  contexts: findItems(
    CONTEXT_ITEMS,
    resource?.contexts?.map((context) => context.pageId)
  ),
  sourceUrl: resource?.source.url ?? '',
  sourceProvider: resource?.source.provider ?? '',
  estimatedDuration: resource?.estimatedDuration
    ? findItems(DURATION_ITEMS, [String(resource.estimatedDuration)])[0]
    : null,
  status: findItems(STATUS_ITEMS, [
    resource?.status ?? LearningResourceStatus.Active,
  ])[0],
});

/**
 * Builds the create/update payload. Fields the form does not edit (difficulty,
 * a context's componentId) are carried over from the resource being edited.
 */
export const toLearningResourcePayload = (
  values: LearningResourceFormValues,
  original?: LearningResource
): CreateLearningResource => ({
  name: values.name,
  description: values.description,
  resourceType: values.resourceType?.id as LearningResourceType,
  categories: values.categories.map(
    (item) => item.id
  ) as CreateLearningResource['categories'],
  contexts: values.contexts.map(({ id }) => ({
    pageId: id,
    componentId: original?.contexts?.find((context) => context.pageId === id)
      ?.componentId,
  })),
  difficulty: original?.difficulty,
  estimatedDuration: values.estimatedDuration
    ? Number(values.estimatedDuration.id)
    : undefined,
  source: {
    url: values.sourceUrl,
    provider: values.sourceProvider || undefined,
  },
  status: values.status?.id as CreateLearningResource['status'],
});

/** Learning Resources list state kept while one of its resources is open. */
export interface LearningListState {
  searchText: string;
  filterState: Partial<
    Record<'type' | 'category' | 'context' | 'status', string[]>
  >;
  currentPage: number;
  pageSize: number;
  selectedView?: PageViewMode;
}

/**
 * The list state to start from: what was saved, else the defaults. A remounted
 * list rebuilds its cursors by walking up to `MAX_CHAIN_PAGES`; past that it can
 * only show page 1, so a later saved page restarts at page 1 rather than show
 * page 1's rows under another page number.
 */
export const getInitialLearningListState = (
  saved: unknown
): LearningListState => {
  const state: LearningListState = {
    searchText: '',
    filterState: {},
    currentPage: 1,
    pageSize: PAGE_SIZE_BASE,
    ...(saved as Partial<LearningListState> | undefined),
  };

  return state.currentPage > MAX_CHAIN_PAGES
    ? { ...state, currentPage: 1 }
    : state;
};
