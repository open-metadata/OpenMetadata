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
import Icon from '@ant-design/icons/lib/components/Icon';
import { Popover, Space, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DataProductIcon } from '../../../assets/svg/ic-data-product.svg';
import { ADD_USER_CONTAINER_HEIGHT } from '../../../constants/constants';
import { EntityReference } from '../../../generated/entity/data/table';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { FocusTrapWithContainer } from '../../common/FocusTrap/FocusTrapWithContainer';
import { SelectableList } from '../../common/SelectableList/SelectableList.component';

export const DataProductListItemRenderer = (props: EntityReference) => {
  return (
    <Space direction="vertical" size={0}>
      <Space>
        <Icon component={DataProductIcon} style={{ fontSize: '16px' }} />
        <Typography.Text>{props.displayName || props.name}</Typography.Text>
      </Space>
      {props.description && (
        <Typography.Text className="text-xs text-grey-muted">
          {props.description}
        </Typography.Text>
      )}
    </Space>
  );
};

interface DataProductsSelectListV1Props {
  selectedDataProducts?: DataProduct[];
  onUpdate: (dataProducts: DataProduct[]) => Promise<void>;
  children: React.ReactNode;
  popoverProps?: {
    placement?: 'bottomLeft' | 'bottomRight';
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  };
  listHeight?: number;
  fetchOptions: (
    searchText: string,
    page: number
  ) => Promise<{
    data: { label: string; value: DataProduct }[];
    paging: { total: number; after?: string };
  }>;
  onCancel: () => void;
}

export const DataProductsSelectListV1 = ({
  selectedDataProducts = [],
  onUpdate,
  onCancel,
  children,
  popoverProps,
  listHeight = ADD_USER_CONTAINER_HEIGHT,
  fetchOptions,
}: DataProductsSelectListV1Props) => {
  const [popupVisible, setPopupVisible] = useState(false);
  const { t } = useTranslation();

  const convertDataProductsToEntityReferences = (
    dataProducts: DataProduct[]
  ): EntityReference[] => {
    return dataProducts.map((dp) => ({
      id: dp.id || '',
      name: dp.name || '',
      displayName: dp.displayName || dp.name,
      type: 'dataProduct',
      fullyQualifiedName: dp.fullyQualifiedName,
      description: dp.description,
    }));
  };

  const convertEntityReferencesToDataProducts = (
    refs: EntityReference[]
  ): DataProduct[] => {
    return refs.map((ref) => ({
      id: ref.id,
      name: ref.name,
      displayName: ref.displayName || ref.name,
      fullyQualifiedName: ref.fullyQualifiedName || ref.id,
      description: ref.description,
      type: 'dataProduct',
    })) as DataProduct[];
  };

  const fetchDataProductOptions = async (
    searchText: string,
    after?: string
  ) => {
    try {
      const afterPage = after ? parseInt(after, 10) : 1;
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
  };

  const handleUpdate = async (updateItems: EntityReference[]) => {
    const updatedDataProducts =
      convertEntityReferencesToDataProducts(updateItems);
    await onUpdate(updatedDataProducts);
    setPopupVisible(false);
  };

  return (
    <Popover
      destroyTooltipOnHide
      content={
        <FocusTrapWithContainer active={popoverProps?.open || popupVisible}>
          <SelectableList
            multiSelect
            customTagRenderer={DataProductListItemRenderer}
            fetchOptions={fetchDataProductOptions}
            height={listHeight}
            searchBarDataTestId="data-product-select-search-bar"
            searchPlaceholder={t('label.search-for-type', {
              type: t('label.data-product'),
            })}
            selectedItems={convertDataProductsToEntityReferences(
              selectedDataProducts
            )}
            onCancel={onCancel}
            onUpdate={handleUpdate}
          />
        </FocusTrapWithContainer>
      }
      open={popupVisible}
      overlayClassName="data-product-select-popover"
      placement="top"
      showArrow={false}
      trigger="click"
      onOpenChange={setPopupVisible}
      {...popoverProps}>
      {children}
    </Popover>
  );
};
