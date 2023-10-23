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
import { Col, Row, Space, Tag, Typography } from 'antd';
import { isEmpty } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../assets/svg/edit-new.svg';
import { ReactComponent as DataProductIcon } from '../../assets/svg/ic-data-product.svg';
import DataProductSelectForm from '../../components/DataProductSelectForm/DataProductsSelectForm';
import TagsV1 from '../../components/Tag/TagsV1/TagsV1.component';
import { DE_ACTIVE_COLOR } from '../../constants/constants';
import { TAG_CONSTANT, TAG_START_WITH } from '../../constants/Tag.constants';
import { DataProduct } from '../../generated/entity/domains/dataProduct';
import { EntityReference } from '../../generated/entity/type';
import { fetchDataProductsElasticSearch } from '../../rest/dataProductAPI';
import { getEntityName } from '../../utils/EntityUtils';

interface DataProductsContainerProps {
  showHeader?: boolean;
  hasPermission: boolean;
  dataProducts: EntityReference[];
  activeDomain?: EntityReference;
  onSave: (dataProducts: DataProduct[]) => Promise<void>;
}

const DataProductsContainer = ({
  showHeader = true,
  hasPermission,
  dataProducts,
  activeDomain,
  onSave,
}: DataProductsContainerProps) => {
  const { t } = useTranslation();
  const [isEditMode, setIsEditMode] = useState(false);

  const handleAddClick = () => {
    setIsEditMode(true);
  };

  const fetchAPI = useCallback(
    (searchValue: string, page: number) => {
      let searchText = searchValue;
      const domainText = activeDomain
        ? `domain.fullyQualifiedName:"${activeDomain.name}"`
        : '';

      if (searchText) {
        searchText += ` AND ${domainText}`;
      } else {
        searchText = domainText;
      }

      return fetchDataProductsElasticSearch(searchText, page);
    },
    [activeDomain]
  );

  const handleSave = async (dataProducts: DataProduct[]) => {
    await onSave(dataProducts);
    setIsEditMode(false);
  };

  const handleCancel = () => {
    setIsEditMode(false);
  };

  const autoCompleteFormSelectContainer = useMemo(() => {
    return (
      <DataProductSelectForm
        defaultValue={(dataProducts ?? []).map(
          (item) => item.fullyQualifiedName ?? ''
        )}
        fetchApi={fetchAPI}
        placeholder={t('label.data-product-plural')}
        onCancel={handleCancel}
        onSubmit={handleSave}
      />
    );
  }, [handleCancel, handleSave, dataProducts, fetchAPI]);

  const showAddTagButton = useMemo(
    () => hasPermission && isEmpty(dataProducts),
    [hasPermission, dataProducts]
  );

  const renderDataProducts = useMemo(() => {
    if (isEmpty(dataProducts)) {
      return null;
    }

    return dataProducts.map((product) => {
      return (
        <Tag
          className="tag-chip tag-chip-content"
          key={`dp-tags-${product.fullyQualifiedName}`}>
          <div className="d-flex w-full">
            <div className="d-flex items-center p-x-xs w-full gap-1">
              <DataProductIcon
                className="align-middle"
                height={12}
                width={12}
              />
              <Typography.Paragraph
                ellipsis
                className="m-0 tags-label"
                data-testid={`data-product-${product.fullyQualifiedName}`}>
                {getEntityName(product)}
              </Typography.Paragraph>
            </div>
          </div>
        </Tag>
      );
    });
  }, [dataProducts]);

  const header = useMemo(() => {
    return (
      showHeader && (
        <Space align="center" className="m-b-xss w-full" size="middle">
          <Typography.Text className="right-panel-label">
            {t('label.data-product-plural')}
          </Typography.Text>
          {hasPermission && (
            <Row gutter={12}>
              {!isEmpty(dataProducts) && (
                <Col>
                  <EditIcon
                    className="cursor-pointer"
                    color={DE_ACTIVE_COLOR}
                    data-testid="edit-button"
                    width="14px"
                    onClick={handleAddClick}
                  />
                </Col>
              )}
            </Row>
          )}
        </Space>
      )
    );
  }, [showHeader, dataProducts, hasPermission]);

  const addTagButton = useMemo(
    () =>
      showAddTagButton ? (
        <Col className="m-t-xss" onClick={handleAddClick}>
          <TagsV1 startWith={TAG_START_WITH.PLUS} tag={TAG_CONSTANT} />
        </Col>
      ) : null,
    [showAddTagButton]
  );

  return (
    <div className="w-full" data-testid="data-products-container">
      {header}
      {!isEditMode && (
        <Row data-testid="data-products-list">
          <Col>
            {addTagButton}
            {renderDataProducts}
          </Col>
        </Row>
      )}
      {isEditMode && autoCompleteFormSelectContainer}
    </div>
  );
};

export default DataProductsContainer;
