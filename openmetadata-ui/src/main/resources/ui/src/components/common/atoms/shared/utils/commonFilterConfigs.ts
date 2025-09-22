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

import { FilterConfig, FilterField } from '../types';
import { processOwnerOptions } from './entityFilterProcessors';

export const COMMON_FILTER_FIELDS: Record<string, FilterField> = {
  owners: {
    key: 'owners',
    aggregationField: 'owners.displayName.keyword',
    processor: processOwnerOptions,
  },
  experts: {
    key: 'experts',
    aggregationField: 'experts.displayName.keyword',
    processor: processOwnerOptions,
  },
  tags: {
    key: 'tags',
    aggregationField: 'classificationTags',
  },
  glossary: {
    key: 'glossary',
    aggregationField: 'glossaryTags',
  },
  domainTypes: {
    key: 'domainTypes',
    aggregationField: 'domainType',
  },
};

export const DOMAIN_FILTER_CONFIGS: FilterConfig[] = [
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
  {
    key: 'domainType',
    labelKey: 'label.domain-type',
    searchKey: 'domainType',
    optionsKey: 'domainTypes',
    selectedKey: 'domainType',
  },
];

export const DATA_PRODUCT_FILTER_CONFIGS: FilterConfig[] = [
  {
    key: 'owner',
    labelKey: 'label.owner',
    searchKey: 'owner.displayName',
    optionsKey: 'owners',
    selectedKey: 'owner',
  },
  {
    key: 'expert',
    labelKey: 'label.expert',
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
];

export const SUBDOMAIN_FILTER_CONFIGS: FilterConfig[] = [
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
  {
    key: 'domainType',
    labelKey: 'label.domain-type',
    searchKey: 'domainType',
    optionsKey: 'domainTypes',
    selectedKey: 'domainType',
  },
];
