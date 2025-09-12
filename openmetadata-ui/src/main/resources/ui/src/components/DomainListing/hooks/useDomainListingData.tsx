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
import { TABLE_CARD_PAGE_SIZE } from '../../../constants/constants';
import { SearchIndex } from '../../../enums/search.enum';
import { Domain } from '../../../generated/entity/domains/domain';
import { TagSource } from '../../../generated/type/tagLabel';
import { useListingData } from '../../common/atoms/compositions/useListingData';
import {
  CellRenderer,
  ColumnConfig,
  ListingData,
} from '../../common/atoms/shared/types';
import { COMMON_FILTER_FIELDS } from '../../common/atoms/shared/utils/commonFilterConfigs';
import { DomainTypeChip } from '../components/DomainTypeChip';

export const useDomainListingData = (): ListingData<Domain> => {
  const filterKeys = useMemo(
    () => ['owner', 'tags', 'glossary', 'domainType'],
    []
  );

  const queryConfig = useMemo(
    () => ({
      owner: 'owners.displayName.keyword',
      tags: 'tags.tagFQN',
      glossary: 'tags.tagFQN',
      domainType: 'domainType',
    }),
    []
  );
  const filterFields = useMemo(
    () => [
      COMMON_FILTER_FIELDS.owners,
      COMMON_FILTER_FIELDS.tags,
      COMMON_FILTER_FIELDS.glossary,
      COMMON_FILTER_FIELDS.domainTypes,
    ],
    []
  );

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

  const columns: ColumnConfig<Domain>[] = useMemo(
    () => [
      { key: 'name', labelKey: 'label.domain', render: 'entityName' },
      { key: 'owners', labelKey: 'label.owner', render: 'owners' },
      {
        key: 'glossaryTerms',
        labelKey: 'label.glossary-term-plural',
        render: 'tags',
        getValue: getGlossaryTags,
      },
      {
        key: 'domainType',
        labelKey: 'label.domain-type',
        render: 'custom',
        customRenderer: 'domainTypeChip',
      },
      {
        key: 'classificationTags',
        labelKey: 'label.tag-plural',
        render: 'tags',
        getValue: getClassificationTags,
      },
    ],
    [getGlossaryTags, getClassificationTags]
  );

  const renderers: CellRenderer<Domain> = useMemo(
    () => ({
      domainTypeChip: (domain: Domain) => (
        <DomainTypeChip domainType={domain.domainType} />
      ),
    }),
    []
  );

  const listingData = useListingData<Domain>({
    searchIndex: SearchIndex.DOMAIN,
    baseFilter: '!_exists_:parent',
    pageSize: TABLE_CARD_PAGE_SIZE,
    filterKeys,
    filterFields,
    queryConfig,
    columns,
    renderers,
    basePath: '/domain',
  });

  return listingData;
};
