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
// ─── File type badge ──────────────────────────────────────────────────────────

import { EntityFields } from '../enums/AdvancedSearch.enum';
import { Reason } from '../generated/api/context/extractionAvailability';
import {
  ContextMemoryStatus,
  MemoryType,
  ShareVisibility,
} from '../generated/entity/context/contextMemory';
import { ExploreQuickFilterField } from '../interface/quickFilter.interface';

export const DOCUMENT_MAX_FILE_SIZE = 5 * 1024 * 1024;
export const CONTEXT_FILE_ENTITY_TYPE = 'contextFile';
/**
 * The fields every file read asks for. They match the server's EXTRACTION_RESPONSE_FIELDS, so an
 * Extract response replaces a Documents row as it is; owners gate Extract and Retry
 * (ADR:2026-11-09-a-documents-owner-or-an-admin-starts-or-retries-its-extraction).
 */
export const CONTEXT_FILE_FIELDS = 'owners,folder,memoryCount,neverExtracted';

/** What a document's owners and admins can do about its memories, by the document's state. */
export enum MemoryExtractionAction {
  Extract = 'extract',
  Retry = 'retry',
}

export const MEMORY_EXTRACTION_MENU_ITEM_KEY = 'memory-extraction';

export const MEMORY_EXTRACTION_ACTION_LABEL_KEYS: Record<
  MemoryExtractionAction,
  string
> = {
  [MemoryExtractionAction.Extract]: 'label.extract',
  [MemoryExtractionAction.Retry]: 'label.retry',
};

export const EXTRACTION_UNAVAILABLE_MESSAGE_KEYS: Record<Reason, string> = {
  [Reason.ExtractionDisabled]: 'message.memory-extraction-off',
  [Reason.ProviderDisabled]: 'message.memory-extraction-ai-platform-off',
  [Reason.ProviderUnavailable]: 'message.memory-extraction-service-unavailable',
};

/**
 * The status reason the server stores when a Query a memory cites is deleted (MemoryEvidenceHolds),
 * with the Query's id between the two parts. Only matched to recognise that hold, so it stays in
 * English; the UI shows `message.memory-supporting-query-deleted` instead.
 */
export const RETIRED_QUERY_REASON = {
  prefix: 'Supporting query ',
  suffix: ' was deleted; review whether this memory still holds without it',
};

// Quick-filter fields shown above the Context Center Articles list. Options are
// fetched from the `page` search-index aggregations by ExploreQuickFilters.
export const ARTICLE_QUICK_FILTER_FIELDS: ExploreQuickFilterField[] = [
  { label: 'label.domain-plural', key: EntityFields.DOMAINS },
  { label: 'label.owner-plural', key: EntityFields.OWNERS },
  { label: 'label.tag', key: EntityFields.TAG },
  { label: 'label.tier', key: EntityFields.TIER },
];

export interface ArticleSortOption {
  id: string;
  label: string;
  // ES search index field (search path). The REST list endpoint only allows
  // sortBy in {name, createdAt, updatedAt}; options without a `restSortBy` are
  // sortable only via ES, so they force the search path even when unfiltered.
  esSortField: string;
  restSortBy?: string;
  sortOrder: 'asc' | 'desc';
}

export const ARTICLE_SORT_OPTIONS: ArticleSortOption[] = [
  {
    id: 'updatedAt',
    label: 'label.recently-updated',
    esSortField: 'updatedAt',
    restSortBy: 'updatedAt',
    sortOrder: 'desc',
  },
  {
    id: 'name',
    label: 'label.alphabetical',
    esSortField: 'displayName.keyword',
    restSortBy: 'displayName',
    sortOrder: 'asc',
  },
  {
    id: 'publicationDate',
    label: 'label.publication-date',
    esSortField: 'page.publicationDate',
    sortOrder: 'desc',
  },
  {
    id: 'popularity',
    label: 'label.popularity',
    esSortField: 'totalVotes',
    sortOrder: 'desc',
  },
];

export const DEFAULT_ARTICLE_SORT_OPTION = ARTICLE_SORT_OPTIONS[0];

export const RECENT_DASHBOARD_ARTICLES_LIMIT = 3;
export const RECENT_DASHBOARD_DOCUMENTS_LIMIT = 3;
export const RECENT_DASHBOARD_MEMORIES_LIMIT = 3;
export const FOLDER_FILES_PAGE_SIZE = 10;
export const FOLDER_PAGE_SIZE = 25;
export const MOST_CITED_MEMORIES_LIMIT = 10;
export const FOLDER_CARD_CHILDREN_LIMIT = 5;

export const PILLAR_TONE_TEXT_CLASS: Record<string, string> = {
  info: 'tw:text-utility-brand-700',
  warning: 'tw:text-utility-warning-700',
  success: 'tw:text-utility-success-700',
};

export const ATTENTION_SEVERITY_BADGE_COLOR = {
  error: 'error',
  warning: 'warning',
  info: 'blue',
} as const;

export const MEMORY_TYPE_OPTIONS = [
  { id: MemoryType.FAQ, labelKey: 'label.faq' },
  { id: MemoryType.Note, labelKey: 'label.note' },
  { id: MemoryType.Preference, labelKey: 'label.preference' },
  { id: MemoryType.Runbook, labelKey: 'label.runbook' },
  { id: MemoryType.UseCase, labelKey: 'label.use-case' },
];

export const VISIBILITY_OPTIONS = [
  {
    id: ShareVisibility.Public,
    labelKey: 'label.visibility-public',
    descriptionKey: 'message.visible-to-everyone-in-workspace',
    badgeColor: 'blue' as const,
    iconName: 'Share07' as const,
  },
  {
    id: ShareVisibility.Shared,
    labelKey: 'label.shared',
    descriptionKey: 'message.visible-to-specific-people',
    badgeColor: 'brand' as const,
    iconName: 'Share07' as const,
  },
  {
    id: ShareVisibility.Entity,
    labelKey: 'label.entity',
    descriptionKey: 'message.visible-to-linked-entities',
    badgeColor: 'orange' as const,
    iconName: 'Database01' as const,
  },
  {
    id: ShareVisibility.Private,
    labelKey: 'label.private',
    descriptionKey: 'message.visible-only-to-you',
    badgeColor: 'gray' as const,
    iconName: 'FileLock02' as const,
  },
];

export const MEMORY_FIELDS =
  'owners,tags,domains,primaryEntity,relatedEntities,derivedEntities,sourceEntity';

export const DEFAULT_MEMORY_STATUSES = [
  ContextMemoryStatus.Approved,
  ContextMemoryStatus.Unprocessed,
];

// Draft holds a memory for a person: one whose supporting query was deleted has no review task.
export const DEFAULT_MEMORY_LIST_STATUSES = [
  ...DEFAULT_MEMORY_STATUSES,
  ContextMemoryStatus.Draft,
];

/** The stages a person approves or rejects a memory from. */
export const MEMORY_STATUSES_AWAITING_DECISION = [
  ContextMemoryStatus.Unprocessed,
  ContextMemoryStatus.Draft,
];

export const MEMORY_STATUS_LABEL_KEYS: Record<string, string> = {
  [ContextMemoryStatus.Unprocessed]: 'label.unprocessed',
  [ContextMemoryStatus.Approved]: 'label.approved',
  [ContextMemoryStatus.Archived]: 'label.archived',
  [ContextMemoryStatus.Draft]: 'label.draft',
  [ContextMemoryStatus.Deprecated]: 'label.deprecated',
  [ContextMemoryStatus.Rejected]: 'label.rejected',
  [ContextMemoryStatus.Superseded]: 'label.superseded',
  [ContextMemoryStatus.Invalidated]: 'label.invalidated',
};

// utility-gray-blue-50 resolves to gray-blue-950 in dark, which reads as a
// black hole on a gray-800 card, so dark swaps to the translucent active fill.
export const PANEL_ICON_BOX_CLASS =
  'tw:rounded-lg tw:leading-0 tw:bg-utility-gray-blue-50 tw:dark:bg-active';
