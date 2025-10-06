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
import {
  DATAPRODUCT_DEFAULT_QUICK_FILTERS,
  DATAPRODUCT_FILTERS,
} from '../../../constants/DataProduct.constants';
import { SearchIndex } from '../../../enums/search.enum';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { TagSource } from '../../../generated/type/tagLabel';
import { useListingData } from '../../common/atoms/compositions/useListingData';
import {
  CellRenderer,
  ColumnConfig,
  ListingData,
} from '../../common/atoms/shared/types';

export const useDataProductListingData = (): ListingData<DataProduct> => {
  const filterKeys = useMemo(() => DATAPRODUCT_DEFAULT_QUICK_FILTERS, []);
  const filterConfigs = useMemo(() => DATAPRODUCT_FILTERS, []);

  const getGlossaryTags = useCallback(
    (dataProduct: DataProduct) =>
      dataProduct.tags?.filter((tag) => tag.source === TagSource.Glossary) ||
      [],
    []
  );

  const getClassificationTags = useCallback(
    (dataProduct: DataProduct) =>
      dataProduct.tags?.filter(
        (tag) => tag.source === TagSource.Classification
      ) || [],
    []
  );

  const columns: ColumnConfig<DataProduct>[] = useMemo(
    () => [
      { key: 'name', labelKey: 'label.data-product', render: 'entityName' },
      { key: 'owners', labelKey: 'label.owner', render: 'owners' },
      {
        key: 'glossaryTerms',
        labelKey: 'label.glossary-term-plural',
        render: 'tags',
        getValue: getGlossaryTags,
      },
      {
        key: 'classificationTags',
        labelKey: 'label.tag-plural',
        render: 'tags',
        getValue: getClassificationTags,
      },
      { key: 'experts', labelKey: 'label.expert-plural', render: 'owners' },
    ],
    [getGlossaryTags, getClassificationTags]
  );

  const renderers: CellRenderer<DataProduct> = useMemo(() => ({}), []);

  const listingData = useListingData<DataProduct>({
    searchIndex: SearchIndex.DATA_PRODUCT,
    baseFilter: '', // No parent filter for data products
    pageSize: TABLE_CARD_PAGE_SIZE,
    filterKeys,
    filterConfigs,
    columns,
    renderers,
    basePath: '/dataProduct',
  });

  return listingData;
};
