/*
 *  Copyright 2023 Collate.
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
import { Typography } from '@openmetadata/ui-core-components';
import { Col, Row, Space, Tag, Typography as AntDTypography } from 'antd';
import { isEmpty } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as DataProductIcon } from '../../../assets/svg/ic-data-product.svg';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { TAG_CONSTANT, TAG_START_WITH } from '../../../constants/Tag.constants';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { EntityReference } from '../../../generated/entity/type';
import { fetchDataProductsElasticSearch } from '../../../rest/dataProductAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getDataProductDetailsPath } from '../../../utils/RouterUtils';
import {
  WidgetEditButton,
  WidgetPlusButton,
} from '../../common/WidgetActionButton/WidgetActionButton';
import WidgetCard from '../../common/WidgetCard/WidgetCard';
import TagsV1 from '../../Tag/TagsV1/TagsV1.component';
import DataProductsSelectList from '../DataProductsSelectList/DataProductsSelectList';
interface DataProductsContainerProps {
  showHeader?: boolean;
  hasPermission: boolean;
  dataProducts: EntityReference[];
  activeDomains?: EntityReference[];
  onSave?: (dataProducts: DataProduct[]) => Promise<void>;
  newLook?: boolean;
  multiple?: boolean;
}

const DataProductsContainer = ({
  showHeader = true,
  hasPermission,
  dataProducts,
  activeDomains,
  onSave,
  newLook = false,
  multiple = true,
}: DataProductsContainerProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isEditMode, setIsEditMode] = useState(false);

  const handleAddClick = () => {
    setIsEditMode(true);
  };

  const fetchAPI = useCallback(
    (searchValue: string, page = 1) => {
      const searchText = searchValue ?? '';
      const domainFQNs =
        activeDomains?.map((domain) => domain.fullyQualifiedName ?? '') ?? [];

      return fetchDataProductsElasticSearch(searchText, domainFQNs, page);
    },
    [activeDomains]
  );

  const redirectLink = useCallback(
    (fqn: string) => {
      navigate(getDataProductDetailsPath(fqn));
    },
    [navigate]
  );

  const handleSave = async (udpatedValues: DataProduct[]) => {
    const finalData = udpatedValues.reduce((acc, item) => {
      if (!item.id) {
        const existingItem = dataProducts.find(
          (dp) => dp.fullyQualifiedName === item.fullyQualifiedName
        );
        if (existingItem) {
          acc.push(existingItem as unknown as DataProduct);
        }
      } else {
        acc.push(item);
      }

      return acc;
    }, [] as DataProduct[]);

    await onSave?.(finalData);
    setIsEditMode(false);
  };

  const handleCancel = () => {
    setIsEditMode(false);
  };

  const autoCompleteFormSelectContainer = useMemo(() => {
    return (
      <DataProductsSelectList
        open
        defaultValue={(dataProducts ?? []).map(
          (item) => item.fullyQualifiedName ?? ''
        )}
        fetchOptions={fetchAPI}
        mode={multiple ? 'multiple' : undefined}
        placeholder={t('label.data-product-plural')}
        onCancel={handleCancel}
        onSubmit={handleSave}
      />
    );
  }, [handleCancel, handleSave, dataProducts, fetchAPI]);

  const showAddTagButton = useMemo(
    () => hasPermission && !isEmpty(activeDomains) && isEmpty(dataProducts),
    [hasPermission, dataProducts, activeDomains]
  );

  const renderDataProducts = useMemo(() => {
    if (isEmpty(dataProducts) && !hasPermission) {
      return NO_DATA_PLACEHOLDER;
    }

    if (isEmpty(dataProducts) && hasPermission && isEmpty(activeDomains)) {
      return (
        <Typography className="tw:text-gray-500" size="text-xs">
          {t('message.select-domain-to-add-data-product')}
        </Typography>
      );
    }

    return dataProducts.map((product) => {
      return (
        <Tag
          className="tag-chip tag-chip-content"
          key={`dp-tags-${product.fullyQualifiedName}`}
          onClick={() => redirectLink(product.fullyQualifiedName ?? '')}>
          <div className="d-flex w-full">
            <div className="d-flex items-center p-x-xs w-full gap-1">
              <DataProductIcon
                className="align-middle"
                height={12}
                width={12}
              />
              <AntDTypography.Paragraph
                className="m-0 tags-label"
                data-testid={`data-product-${product.fullyQualifiedName}`}>
                {getEntityName(product)}
              </AntDTypography.Paragraph>
            </div>
          </div>
        </Tag>
      );
    });
  }, [dataProducts, activeDomains]);

  const headerExtra = useMemo(() => {
    if (!showHeader) {
      return null;
    }

    return (
      <Space align="center" size="middle">
        {hasPermission && isEmpty(dataProducts) && (
          <WidgetPlusButton
            data-testid="add-data-product"
            disabled={isEmpty(activeDomains)}
            title={
              isEmpty(activeDomains)
                ? t('message.select-domain-to-add-data-product')
                : t('label.add-entity', {
                    entity: t('label.data-product-plural'),
                  })
            }
            onClick={isEmpty(activeDomains) ? undefined : handleAddClick}
          />
        )}
        {hasPermission && !isEmpty(activeDomains) && !isEmpty(dataProducts) && (
          <WidgetEditButton
            data-testid="edit-button"
            title={t('label.edit-entity', {
              entity: t('label.data-product-plural'),
            })}
            onClick={handleAddClick}
          />
        )}
      </Space>
    );
  }, [showHeader, dataProducts, hasPermission, activeDomains]);

  const addTagButton = useMemo(
    () =>
      showAddTagButton ? (
        <Col
          className="m-t-xss"
          data-testid="add-data-product"
          onClick={handleAddClick}>
          <TagsV1 startWith={TAG_START_WITH.PLUS} tag={TAG_CONSTANT} />
        </Col>
      ) : null,
    [showAddTagButton]
  );

  const renderer = useMemo(() => {
    if (isEditMode) {
      return autoCompleteFormSelectContainer;
    }

    if (newLook && isEmpty(renderDataProducts)) {
      return null;
    }

    return (
      <Row data-testid="data-products-list">
        <Col className="flex flex-wrap gap-2">
          {!newLook && addTagButton}
          {renderDataProducts}
        </Col>
      </Row>
    );
  }, [
    newLook,
    isEditMode,
    addTagButton,
    renderDataProducts,
    autoCompleteFormSelectContainer,
  ]);

  if (newLook) {
    return (
      <WidgetCard
        dataTestId="data-products-container"
        forceExpand={isEditMode}
        headerExtra={headerExtra}
        isExpandDisabled={isEmpty(dataProducts) && !isEditMode}
        title={t('label.data-product-plural')}>
        {renderer}
      </WidgetCard>
    );
  }

  return (
    <div className="w-full" data-testid="data-products-container">
      {showHeader && (
        <Space align="center" size="middle">
          <AntDTypography.Text className="text-sm font-medium">
            {t('label.data-product-plural')}
          </AntDTypography.Text>
          {headerExtra}
        </Space>
      )}
      {renderer}
    </div>
  );
};

export default DataProductsContainer;
