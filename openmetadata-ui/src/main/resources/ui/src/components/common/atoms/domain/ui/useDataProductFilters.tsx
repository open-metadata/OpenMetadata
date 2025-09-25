/*
 *  Copyright 2024 Collate.
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

import { useMemo } from 'react';
import { FilterConfig, FilterField } from '../../shared/types';
import { COMMON_FILTER_FIELDS } from '../../shared/utils/commonFilterConfigs';

interface UseDataProductFiltersConfig {
  enabledFilters?: string[];
  customFilterFields?: FilterField[];
  customFilterConfigs?: FilterConfig[];
}

export const useDataProductFilters = (
  config: UseDataProductFiltersConfig = {}
) => {
  const { enabledFilters = ['owner', 'expert', 'tags', 'glossary'] } = config;

  const filterKeys = useMemo(() => enabledFilters, []);

  const queryConfig = useMemo(
    () => ({
      owner: 'owners.displayName.keyword',
      expert: 'experts.displayName.keyword',
      tags: 'classificationTags',
      glossary: 'glossaryTags',
    }),
    []
  );

  const filterFields = useMemo(
    () => [
      COMMON_FILTER_FIELDS.owners,
      COMMON_FILTER_FIELDS.experts,
      COMMON_FILTER_FIELDS.tags,
      COMMON_FILTER_FIELDS.glossary,
    ],
    []
  );

  const filterConfigs = useMemo(
    () => [
      {
        key: 'owners',
        labelKey: 'label.owner',
        searchKey: 'owner.displayName',
        optionsKey: 'owners',
        selectedKey: 'owner',
      },
      {
        key: 'experts',
        labelKey: 'label.expert-plural',
        searchKey: 'expert.displayName',
        optionsKey: 'experts',
        selectedKey: 'expert',
      },
      {
        key: 'tags',
        labelKey: 'label.tag-plural',
        searchKey: 'tags.tagFQN',
        optionsKey: 'tags',
        selectedKey: 'tags',
      },
      {
        key: 'glossary',
        labelKey: 'label.glossary-term-plural',
        searchKey: 'glossaryTerms',
        optionsKey: 'glossary',
        selectedKey: 'glossary',
      },
    ],
    []
  );

  return {
    filterKeys,
    queryConfig,
    filterFields,
    filterConfigs,
  };
};
