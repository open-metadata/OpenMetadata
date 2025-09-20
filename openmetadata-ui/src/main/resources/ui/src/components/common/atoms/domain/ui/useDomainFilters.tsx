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

interface UseDomainFiltersConfig {
  enabledFilters?: string[];
  customFilterFields?: FilterField[];
  customFilterConfigs?: FilterConfig[];
}

export const useDomainFilters = (config: UseDomainFiltersConfig = {}) => {
  const {
    enabledFilters = ['owner', 'tags', 'glossary'], // Temporarily disabled domainType due to API errors
    customFilterFields = [],
    customFilterConfigs = [],
  } = config;

  const filterKeys = useMemo(() => enabledFilters, []);

  const queryConfig = useMemo(
    () => ({
      owner: 'owners.displayName.keyword',
      tags: 'classificationTags',
      glossary: 'glossaryTags',
      domainType: 'domainType',
    }),
    []
  );

  const filterFields = useMemo(
    () => [
      COMMON_FILTER_FIELDS.owners,
      COMMON_FILTER_FIELDS.tags,
      COMMON_FILTER_FIELDS.glossary,
      // COMMON_FILTER_FIELDS.domainTypes, // Temporarily disabled
    ],
    []
  );

  const filterConfigs = useMemo(
    () => [
      {
        key: 'owner',
        labelKey: 'label.owner',
        searchKey: 'owner.displayName',
        optionsKey: 'owners',
        selectedKey: 'owner',
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
      // domainType temporarily disabled
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
