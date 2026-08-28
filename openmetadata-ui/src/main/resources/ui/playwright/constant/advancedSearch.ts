/*
 *  Copyright 2025 Collate.
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

import { AdvancedSearchSuggestionField } from './advancedSearch.interface';

export const ADVANCED_SEARCH_SUGGESTION_FIELDS: AdvancedSearchSuggestionField[] =
  [
    {
      label: 'Database',
      searchIndex: 'database',
      fieldName: 'displayName.keyword',
    },
    {
      label: 'Database Schema',
      searchIndex: 'databaseSchema',
      fieldName: 'displayName.keyword',
    },
    {
      label: 'API Collection',
      searchIndex: 'apiCollection',
      fieldName: 'displayName.keyword',
    },
    {
      label: 'Glossary',
      searchIndex: 'glossary',
      fieldName: 'displayName.keyword',
    },
    {
      label: 'Domains',
      searchIndex: 'domain',
      fieldName: 'displayName.keyword',
    },
    {
      label: 'Data Product',
      searchIndex: 'dataProduct',
      fieldName: 'displayName.keyword',
    },
    {
      label: 'Tags',
      searchIndex: 'tag,glossaryTerm',
      fieldName: 'fullyQualifiedName',
      q: 'name:* NOT classification.name:tier NOT classification.name:certification',
    },
    {
      label: 'Certification',
      searchIndex: 'tag',
      fieldName: 'fullyQualifiedName',
      q: 'name:* AND classification.name:certification',
    },
    {
      label: 'Tier',
      searchIndex: 'tag',
      fieldName: 'fullyQualifiedName',
      q: 'name:* AND classification.name:tier',
    },
  ];
