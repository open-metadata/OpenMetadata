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
import { SearchIndex } from '../../../enums/search.enum';
import { TargetEntityType } from '../../../generated/governance/intakeForm';
import { searchQuery } from '../../../rest/searchAPI';
import { mostCommonFieldValue } from '../../../utils/governance/onboarding/OnboardingAssistance.utils';

/** How many siblings are worth looking at: enough to see a convention, few enough to stay cheap. */
const SIBLING_LIMIT = 25;

const SIBLING_INDEX: Record<TargetEntityType, SearchIndex> = {
  [TargetEntityType.DataProduct]: SearchIndex.DATA_PRODUCT,
  [TargetEntityType.Domain]: SearchIndex.DOMAIN,
  [TargetEntityType.GlossaryTerm]: SearchIndex.GLOSSARY_TERM,
  [TargetEntityType.Metric]: SearchIndex.METRIC,
};

export interface SiblingSuggestion {
  label: string;
  value: unknown;
  count: number;
  total: number;
}

/**
 * What the asset's neighbours already do with this field.
 *
 * <p>The suggestion is a convention rather than an answer: it is only offered when at least two
 * siblings in the same domain agree, so a single outlier is never presented as the house style.
 */
export const useSiblingSuggestion = (
  entityType: TargetEntityType,
  fieldPath: string,
  domain?: string,
  enabled = true
) => {
  const [suggestion, setSuggestion] = useState<SiblingSuggestion>();
  const [isLoading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !domain) {
      setSuggestion(undefined);

      return;
    }
    const controller = new AbortController();
    setLoading(true);
    searchQuery({
      query: '*',
      pageNumber: 1,
      pageSize: SIBLING_LIMIT,
      searchIndex: SIBLING_INDEX[entityType],
      fetchSource: true,
      queryFilter: {
        query: {
          bool: {
            must: [{ term: { 'domains.fullyQualifiedName': domain } }],
          },
        },
      },
    })
      .then((response) => {
        if (!controller.signal.aborted) {
          setSuggestion(
            mostCommonFieldValue(
              response.hits.hits.map((hit) => hit._source as unknown),
              fieldPath
            )
          );
        }
      })
      .catch(() => {
        // A missing convention is not an error the producer needs to see - the strip simply
        // does not appear.
        if (!controller.signal.aborted) {
          setSuggestion(undefined);
        }
      })
      .finally(() => !controller.signal.aborted && setLoading(false));

    return () => controller.abort();
  }, [enabled, domain, entityType, fieldPath]);

  return { suggestion, isLoading };
};
