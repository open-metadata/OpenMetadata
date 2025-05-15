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
import classNames from 'classnames';
import { isEmpty, isUndefined } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { ReactComponent as DataProductIcon } from '../../../assets/svg/ic-data-product.svg';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { EntityReference } from '../../../generated/entity/type';
import { fetchDataProductsElasticSearch } from '../../../rest/dataProductAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import ExpandableCard from '../../common/ExpandableCard/ExpandableCard';
import {
  EditIconButton,
  PlusIconButton,
} from '../../common/IconButtons/EditIconButton';
import DataProductsSelectList from '../DataProductsSelectList/DataProductsSelectList';
interface DataProductsContainerProps {
  showHeader?: boolean;
  hasPermission: boolean;
  dataProducts: EntityReference[];
  activeDomain?: EntityReference;
  onSave?: (dataProducts: DataProduct[]) => Promise<void>;
}

const DataProductsContainer = ({
  showHeader = true,
  hasPermission,
  dataProducts,
  activeDomain,
  onSave,
}: DataProductsContainerProps) => {
  const { t } = useTranslation();
  const history = useHistory();
  const [isEditMode, setIsEditMode] = useState(false);

  const handleAddClick = () => {
    setIsEditMode(true);
  };

  const fetchAPI = useCallback(
    (searchValue: string, page = 1) => {
      const searchText = searchValue ?? '';
      const domainFQN = activeDomain?.fullyQualifiedName ?? '';

      return fetchDataProductsElasticSearch(searchText, domainFQN, page);
    },
    [activeDomain]
  );

  const redirectLink = useCallback((fqn: string) => {
    history.push(getEntityDetailsPath(EntityType.DATA_PRODUCT, fqn));
  }, []);

  const handleSave = async (dataProducts: DataProduct[]) => {
    await onSave?.(dataProducts);
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
        mode="multiple"
        placeholder={t('label.data-product-plural')}
        onCancel={handleCancel}
        onSubmit={handleSave}
      />
    );
  }, [handleCancel, handleSave, dataProducts, fetchAPI]);

  const showAddTagButton = useMemo(
    () => hasPermission && !isUndefined(activeDomain) && isEmpty(dataProducts),
    [hasPermission, dataProducts, activeDomain]
  );

  const renderDataProducts = useMemo(() => {
    if (isEmpty(dataProducts) && !hasPermission) {
      return NO_DATA_PLACEHOLDER;
    }

    if (isEmpty(dataProducts) && hasPermission && isUndefined(activeDomain)) {
      return (
        <Typography.Text className="text-sm text-grey-muted">
          {t('message.select-domain-to-add-data-product')}
        </Typography.Text>
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
              <Typography.Paragraph
                className="m-0 tags-label"
                data-testid={`data-product-${product.fullyQualifiedName}`}>
                {getEntityName(product)}
              </Typography.Paragraph>
            </div>
          </div>
        </Tag>
      );
    });
  }, [dataProducts, activeDomain]);

  const header = useMemo(() => {
    return (
      showHeader && (
        <Space align="center" className={classNames('w-full')} size="middle">
          <Typography.Text className={classNames('text-sm font-medium')}>
            {t('label.data-product-plural')}
          </Typography.Text>
          {showAddTagButton && (
            <PlusIconButton
              data-testid="add-data-product"
              size="small"
              title={t('label.add-data-product')}
              onClick={handleAddClick}
            />
          )}
          {hasPermission && !isUndefined(activeDomain) && (
            <Row gutter={12}>
              {!isEmpty(dataProducts) && (
                <Col>
                  <EditIconButton
                    newLook
                    data-testid="edit-button"
                    size="small"
                    title={t('label.edit-entity', {
                      entity: t('label.data-product-plural'),
                    })}
                    onClick={handleAddClick}
                  />
                </Col>
              )}
            </Row>
          )}
        </Space>
      )
    );
  }, [showHeader, dataProducts, hasPermission, showAddTagButton]);

  const cardProps = useMemo(() => {
    return {
      title: header,
    };
  }, [header, showAddTagButton, isEditMode]);

  return (
    <ExpandableCard
      cardProps={cardProps}
      dataTestId="data-products-container"
      isExpandDisabled={isEmpty(dataProducts)}>
      {isEditMode ? (
        autoCompleteFormSelectContainer
      ) : isEmpty(renderDataProducts) ? null : (
        <Row data-testid="data-products-list">
          <Col className="flex flex-wrap gap-2">{renderDataProducts}</Col>
        </Row>
      )}
    </ExpandableCard>
  );
};

export default DataProductsContainer;
