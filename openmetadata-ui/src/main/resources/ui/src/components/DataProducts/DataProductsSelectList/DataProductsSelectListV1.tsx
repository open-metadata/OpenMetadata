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
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ADD_USER_CONTAINER_HEIGHT } from '../../../constants/constants';
import { EntityReference } from '../../../generated/entity/data/table';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import {
  convertDataProductsToEntityReferences,
  convertEntityReferencesToDataProducts,
  DataProductListItemRenderer,
} from '../../../utils/DataProductUtils';
import { EntitySelectableList } from '../../common/EntitySelectableList/EntitySelectableList.component';
import { EntitySelectableListConfig } from '../../common/EntitySelectableList/EntitySelectableList.interface';
import { DataProductsSelectListV1Props } from './DataProductsSelectListV1.interface';
import './DataProductsSelectListV1.less';

export const DataProductsSelectListV1 = ({
  selectedDataProducts = [],
  onUpdate,
  onCancel,
  children,
  popoverProps,
  listHeight = ADD_USER_CONTAINER_HEIGHT,
  fetchOptions,
}: DataProductsSelectListV1Props) => {
  const { t } = useTranslation();

  const fetchDataProductOptions = useMemo(
    () => async (searchText: string, after?: string) => {
      try {
        const afterPage = after ? Number.parseInt(after, 10) : 1;
        const response = await fetchOptions(searchText, afterPage);
        const dataProducts = response.data || [];

        const entityRefs: EntityReference[] = dataProducts.map((dp) => ({
          id: dp.value.id || dp.value.fullyQualifiedName || '',
          name: dp.value.name || '',
          displayName: dp.value.displayName || dp.value.name,
          type: 'dataProduct',
          fullyQualifiedName: dp.value.fullyQualifiedName || '',
          description: dp.value.description,
        }));

        return {
          data: entityRefs,
          paging: {
            total: response.paging?.total || dataProducts.length,
            after:
              dataProducts.length > 0 &&
              afterPage * 10 < (response.paging?.total || 0)
                ? String(afterPage + 1)
                : undefined,
          },
        };
      } catch (error) {
        return { data: [], paging: { total: 0 } };
      }
    },
    [fetchOptions]
  );

  const config: EntitySelectableListConfig<DataProduct> = useMemo(
    () => ({
      toEntityReference: convertDataProductsToEntityReferences,
      fromEntityReference: convertEntityReferencesToDataProducts,
      fetchOptions: fetchDataProductOptions,
      customTagRenderer: DataProductListItemRenderer,
      searchPlaceholder: t('label.search-for-type', {
        type: t('label.data-product'),
      }),
      searchBarDataTestId: 'data-product-select-search-bar',
      overlayClassName: 'data-product-select-popover',
    }),
    [t, fetchDataProductOptions]
  );

  return (
    <EntitySelectableList
      config={config}
      listHeight={listHeight}
      popoverProps={popoverProps}
      selectedItems={selectedDataProducts}
      onCancel={onCancel}
      onUpdate={onUpdate}>
      {children}
    </EntitySelectableList>
  );
};
