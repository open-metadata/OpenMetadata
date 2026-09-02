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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ExploreQuickFilterField } from '../components/Explore/ExplorePage.interface';
import { SearchIndex } from '../enums/search.enum';
import {
  applyQuickFilterLabels,
  getOptionsFromAggregationBucket,
  getQuickFilterSourceFields,
  hydrateQuickFilterLabels,
} from '../utils/AdvancedSearchPureUtils';
import { getAggregationOptions } from '../utils/ExploreUtils';

// A label resolved once is kept so the casing survives paging and result-scope
// changes. Bounded because the key space is every filter value the page has seen.
const MAX_REMEMBERED_LABELS = 500;

// A NUL cannot occur in an aggregation key or a filter value, so the two
// halves of the cache key can never be confused for one another.
const CACHE_KEY_SEPARATOR = '\u0000';

interface UseQuickFilterLabelsProps {
  /** Selected filter fields, with values restored from the URL. */
  fields: ExploreQuickFilterField[];
  /** `_source` documents of the rows currently listed. */
  sources: unknown[];
  index: SearchIndex | SearchIndex[];
}

interface ResolvedLabel {
  cacheKey: string;
  label: string;
}

interface PendingLabel extends Pick<ResolvedLabel, 'cacheKey'> {
  field: ExploreQuickFilterField;
  optionKey: string;
  sourceFields: string;
}

const getCacheKey = (fieldKey: string, optionKey: string) =>
  `${fieldKey}${CACHE_KEY_SEPARATOR}${optionKey}`;

const withRememberedLabels = (
  remembered: Map<string, string>,
  resolved: ResolvedLabel[]
): Map<string, string> => {
  const additions = resolved.filter(
    (entry) => remembered.get(entry.cacheKey) !== entry.label
  );
  if (additions.length === 0) {
    return remembered;
  }

  const next = new Map(remembered);
  additions.forEach((entry) => next.set(entry.cacheKey, entry.label));
  // Map iterates in insertion order, so the oldest keys are dropped first.
  while (next.size > MAX_REMEMBERED_LABELS) {
    const oldestKey = next.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    next.delete(oldestKey);
  }

  return next;
};

/**
 * Restores the original casing of selected quick-filter values.
 *
 * The URL carries only the lowercased aggregation key, so chips and checked
 * dropdown options would otherwise read in lowercase after a reload or on a
 * shared link. Casing comes from the rows already listed wherever possible,
 * which costs nothing; a value the rows cannot explain — its only matching row
 * sits on another page, or a sibling value of the same field crowds it out — is
 * resolved with one targeted aggregation per value, which is exact.
 */
export const useQuickFilterLabels = ({
  fields,
  sources,
  index,
}: UseQuickFilterLabelsProps): ExploreQuickFilterField[] => {
  const [rememberedLabels, setRememberedLabels] = useState<Map<string, string>>(
    () => new Map()
  );
  // A value is asked for at most once per page lifetime, so one that resolves to
  // nothing is not re-requested every time the rows change.
  const attemptedKeys = useRef(new Set<string>());
  const isUnmounted = useRef(false);
  useEffect(
    () => () => {
      isUnmounted.current = true;
    },
    []
  );

  const markAttempted = useCallback((cacheKey: string) => {
    if (attemptedKeys.current.size >= MAX_REMEMBERED_LABELS) {
      attemptedKeys.current.clear();
    }
    attemptedKeys.current.add(cacheKey);
  }, []);

  const fieldsFromSources = useMemo(
    () => hydrateQuickFilterLabels(fields, sources),
    [fields, sources]
  );

  // Whatever the current rows explain is worth keeping for later pages.
  useEffect(() => {
    const fromSources = fieldsFromSources.flatMap((field) =>
      (field.value ?? [])
        .filter((option) => option.label !== option.key)
        .map((option) => ({
          cacheKey: getCacheKey(field.key, option.key),
          label: option.label,
        }))
    );

    setRememberedLabels((remembered) =>
      withRememberedLabels(remembered, fromSources)
    );
  }, [fieldsFromSources]);

  const pendingLabels = useMemo(() => {
    const pending: PendingLabel[] = [];

    fieldsFromSources.forEach((field) => {
      const sourceFields = getQuickFilterSourceFields(field);
      if (!sourceFields) {
        return;
      }

      (field.value ?? []).forEach((option) => {
        const cacheKey = getCacheKey(field.key, option.key);
        if (
          option.label === option.key &&
          !rememberedLabels.has(cacheKey) &&
          !attemptedKeys.current.has(cacheKey)
        ) {
          pending.push({
            cacheKey,
            field,
            optionKey: option.key,
            sourceFields,
          });
        }
      });
    });

    return pending;
  }, [fieldsFromSources, rememberedLabels]);

  // Keyed on what is actually pending, so a value that resolves to nothing is
  // not retried in a loop.
  const pendingSignature = useMemo(
    () => pendingLabels.map((pending) => pending.cacheKey).join(','),
    [pendingLabels]
  );

  const resolvePending = useCallback(
    async ({
      cacheKey,
      field,
      optionKey,
      sourceFields,
    }: PendingLabel): Promise<ResolvedLabel | undefined> => {
      const searchKey = field.searchKey ?? field.key;
      try {
        const response = await getAggregationOptions(
          field.searchIndex ?? index,
          searchKey,
          optionKey,
          '',
          false,
          false,
          undefined,
          false,
          '',
          sourceFields
        );
        const buckets =
          response.data.aggregations[`sterms#${searchKey}`]?.buckets ?? [];
        const label = getOptionsFromAggregationBucket(
          buckets,
          sourceFields
        ).find((option) => option.key === optionKey)?.label;

        return label && label !== optionKey ? { cacheKey, label } : undefined;
      } catch {
        // Casing is cosmetic: keep the lowercased key rather than toasting.
        return undefined;
      }
    },
    [index]
  );

  const rememberResolved = useCallback((resolved?: ResolvedLabel) => {
    if (isUnmounted.current || !resolved) {
      return;
    }

    setRememberedLabels((remembered) =>
      withRememberedLabels(remembered, [resolved])
    );
  }, []);

  useEffect(() => {
    if (!pendingSignature) {
      return;
    }

    // Each value resolves independently and writes only its own cache key, so
    // there is nothing for a later request to supersede — a result is merged
    // whenever it lands, however it interleaves with the others.
    pendingLabels.forEach((pending) => {
      markAttempted(pending.cacheKey);
      resolvePending(pending).then(rememberResolved);
    });
  }, [
    pendingSignature,
    pendingLabels,
    markAttempted,
    resolvePending,
    rememberResolved,
  ]);

  return useMemo(
    () =>
      applyQuickFilterLabels(fieldsFromSources, (field, optionKey) =>
        rememberedLabels.get(getCacheKey(field.key, optionKey))
      ),
    [fieldsFromSources, rememberedLabels]
  );
};
