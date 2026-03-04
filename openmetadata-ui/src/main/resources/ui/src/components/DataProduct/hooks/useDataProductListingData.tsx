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

import { Box, Typography } from '@mui/material';
import React, { useCallback, useMemo } from 'react';
import { TABLE_CARD_PAGE_SIZE } from '../../../constants/constants';
import {
  DATAPRODUCT_DEFAULT_QUICK_FILTERS,
  DATAPRODUCT_FILTERS,
} from '../../../constants/DataProduct.constants';
import { SearchIndex } from '../../../enums/search.enum';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { TagSource } from '../../../generated/type/tagLabel';
import { getEntityName } from '../../../utils/EntityUtils';
import { useListingData } from '../../common/atoms/compositions/useListingData';
import { EntityAvatar } from '../../common/EntityAvatar/EntityAvatar';
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

  const getDomains = useCallback(
    (dataProduct: DataProduct) => dataProduct.domains || [],
    []
  );

  const columns: ColumnConfig<DataProduct>[] = useMemo(
    () => [
      {
        key: 'name',
        labelKey: 'label.data-product',
        render: 'custom',
        customRenderer: 'dataProductName',
      },
      { key: 'owners', labelKey: 'label.owner', render: 'owners' },
      {
        key: 'glossaryTerms',
        labelKey: 'label.glossary-term-plural',
        render: 'tags',
        getValue: getGlossaryTags,
      },
      {
        key: 'domains',
        labelKey: 'label.domain-plural',
        render: 'domains',
        getValue: getDomains,
      },
      {
        key: 'classificationTags',
        labelKey: 'label.tag-plural',
        render: 'tags',
        getValue: getClassificationTags,
      },
      { key: 'experts', labelKey: 'label.expert-plural', render: 'owners' },
    ],
    [getGlossaryTags, getClassificationTags, getDomains]
  );

  const renderers: CellRenderer<DataProduct> = useMemo(
    () => ({
      dataProductName: (entity: DataProduct) => {
        const entityName = getEntityName(entity);
        const showName =
          entity.displayName &&
          entity.name &&
          entity.displayName !== entity.name;

        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <EntityAvatar entity={entity} size={40} />
            <Box>
              <Typography
                sx={{
                  fontWeight: 500,
                  color: 'text.primary',
                  fontSize: '1rem',
                  lineHeight: '24px',
                }}>
                {entityName}
              </Typography>
              {showName && (
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                    lineHeight: '16px',
                  }}>
                  {entity.name}
                </Typography>
              )}
            </Box>
          </Box>
        );
      },
    }),
    []
  );

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
