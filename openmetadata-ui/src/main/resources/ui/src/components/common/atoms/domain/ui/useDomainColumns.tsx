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

import { useCallback, useMemo } from 'react';
import { Domain } from '../../../../../generated/entity/domains/domain';
import { TagSource } from '../../../../../generated/type/tagLabel';
import { ColumnConfig } from '../../shared/types';

interface UseDomainColumnsConfig {
  nameLabelKey?: string;
  includeOwners?: boolean;
  includeGlossaryTerms?: boolean;
  includeDomainType?: boolean;
  includeClassificationTags?: boolean;
  customColumns?: ColumnConfig<Domain>[];
}

export const useDomainColumns = (config: UseDomainColumnsConfig = {}) => {
  const {
    nameLabelKey = 'label.domain',
    includeOwners = true,
    includeGlossaryTerms = true,
    includeDomainType = false, // Temporarily disabled due to API errors
    includeClassificationTags = true,
    customColumns = [],
  } = config;

  const getGlossaryTags = useCallback(
    (domain: Domain) =>
      domain.tags?.filter((tag) => tag.source === TagSource.Glossary) || [],
    []
  );

  const getClassificationTags = useCallback(
    (domain: Domain) =>
      domain.tags?.filter((tag) => tag.source === TagSource.Classification) ||
      [],
    []
  );

  const baseColumns = useMemo(() => {
    const columns: ColumnConfig<Domain>[] = [
      { key: 'name', labelKey: nameLabelKey, render: 'entityName' },
    ];

    if (includeOwners) {
      columns.push({
        key: 'owners',
        labelKey: 'label.owner-plural',
        render: 'owners',
      });
    }

    if (includeGlossaryTerms) {
      columns.push({
        key: 'glossaryTerms',
        labelKey: 'label.glossary-term-plural',
        render: 'tags',
        getValue: getGlossaryTags,
      });
    }

    if (includeDomainType) {
      columns.push({
        key: 'domainType',
        labelKey: 'label.domain-type',
        render: 'custom',
        customRenderer: 'domainTypeChip',
      });
    }

    if (includeClassificationTags) {
      columns.push({
        key: 'classificationTags',
        labelKey: 'label.tag-plural',
        render: 'tags',
        getValue: getClassificationTags,
      });
    }

    return columns;
  }, [
    nameLabelKey,
    includeOwners,
    includeGlossaryTerms,
    includeDomainType,
    includeClassificationTags,
    getGlossaryTags,
    getClassificationTags,
  ]);

  const columns = useMemo(() => {
    return [...baseColumns, ...customColumns];
  }, [baseColumns, customColumns]);

  return {
    columns,
    getGlossaryTags,
    getClassificationTags,
  };
};
