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
import { Box, Typography, useTheme } from '@mui/material';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as DataProductIcon } from '../../../assets/svg/ic-data-product.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { EntityReference } from '../../../generated/entity/type';
import { useEditableSection } from '../../../hooks/useEditableSection';
import { fetchDataProductsElasticSearch } from '../../../rest/dataProductAPI';
import { updateEntityField } from '../../../utils/EntityUpdateUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { DataProductsSelectListV1 } from '../../DataProducts/DataProductsSelectList/DataProductsSelectListV1';
import { EditIconButton } from '../IconButtons/EditIconButton';
import Loader from '../Loader/Loader';
import { DataProductsSectionProps } from './DataProductsSection.interface';

const DataProductsSectionV1: React.FC<DataProductsSectionProps> = ({
  dataProducts = [],
  activeDomains = [],
  showEditButton = true,
  hasPermission = false,
  entityId,
  entityType,
  onDataProductsUpdate,
  maxVisibleDataProducts = 3,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [editingDataProducts, setEditingDataProducts] = useState<DataProduct[]>(
    []
  );
  const [showAllDataProducts, setShowAllDataProducts] = useState(false);
  const [displayActiveDomains, setDisplayActiveDomains] =
    useState<EntityReference[]>(activeDomains);

  const {
    isEditing,
    isLoading,
    popoverOpen,
    displayData: displayDataProducts,
    setDisplayData: setDisplayDataProducts,
    setIsLoading,
    setPopoverOpen,
    startEditing,
    cancelEditing,
    completeEditing,
  } = useEditableSection<EntityReference[]>(dataProducts);

  useEffect(() => {
    setDisplayActiveDomains((prev) => {
      const prevIds = prev
        .map((item) => item.id)
        .sort()
        .join(',');
      const newIds = activeDomains
        .map((item) => item.id)
        .sort()
        .join(',');

      if (prevIds !== newIds) {
        return activeDomains;
      }

      return prev;
    });
  }, [activeDomains]);

  const handleEditClick = () => {
    setEditingDataProducts(
      displayDataProducts.map((dp) => dp as unknown as DataProduct)
    );
    startEditing();
  };

  const fetchAPI = useCallback(
    async (searchValue: string, page = 1) => {
      const searchText = searchValue ?? '';
      const domainFQNs =
        displayActiveDomains?.map(
          (domain) => domain.fullyQualifiedName ?? ''
        ) ?? [];

      return fetchDataProductsElasticSearch(searchText, domainFQNs, page);
    },
    [displayActiveDomains]
  );

  const handleSaveWithDataProducts = useCallback(
    async (dataProductsToSave: DataProduct[]) => {
      setIsLoading(true);

      const updatedDataProducts: EntityReference[] = dataProductsToSave.map(
        (dp) => ({
          id: dp.id,
          fullyQualifiedName: dp.fullyQualifiedName,
          name: dp.name,
          displayName: dp.displayName,
          type: 'dataProduct',
        })
      );

      const result = await updateEntityField({
        entityId,
        entityType,
        fieldName: 'dataProducts',
        currentValue: displayDataProducts,
        newValue: updatedDataProducts,
        entityLabel: t('label.data-product-plural'),
        onSuccess: (dataProds) => {
          setDisplayDataProducts(dataProds);
          if (onDataProductsUpdate) {
            onDataProductsUpdate(dataProds);
          }
        },
        t,
      });

      if (result.success) {
        completeEditing();
      } else {
        setIsLoading(false);
      }
    },
    [
      entityId,
      entityType,
      displayDataProducts,
      onDataProductsUpdate,
      t,
      setDisplayDataProducts,
      setIsLoading,
      completeEditing,
    ]
  );

  const handlePopoverOpenChange = (open: boolean) => {
    setPopoverOpen(open);

    if (!open) {
      const dpList: DataProduct[] = displayDataProducts.map((dp) => ({
        id: dp.id,
        name: dp.name || '',
        displayName: dp.displayName || dp.name,
        fullyQualifiedName: dp.fullyQualifiedName || '',
        description: dp.description,
        type: 'dataProduct',
      })) as DataProduct[];

      setEditingDataProducts(dpList);
      cancelEditing();
    }
  };

  const editingState = useMemo(
    () => (
      <DataProductsSelectListV1
        fetchOptions={fetchAPI}
        popoverProps={{
          open: popoverOpen,
          onOpenChange: handlePopoverOpenChange,
        }}
        selectedDataProducts={editingDataProducts}
        onCancel={() => {
          setPopoverOpen(false);
          cancelEditing();
        }}
        onUpdate={handleSaveWithDataProducts}>
        <Box
          sx={{
            width: '1px',
            height: '1px',
            opacity: 0,
            pointerEvents: 'none',
          }}
        />
      </DataProductsSelectListV1>
    ),
    [
      fetchAPI,
      popoverOpen,
      handlePopoverOpenChange,
      editingDataProducts,
      handleSaveWithDataProducts,
      cancelEditing,
    ]
  );

  const emptyContent = useMemo(() => {
    if (isLoading) {
      return <Loader size="small" />;
    }

    if (!displayActiveDomains || displayActiveDomains.length === 0) {
      return (
        <Box>
          <Typography
            sx={{
              color: theme.palette.allShades.gray[500],
              fontSize: '12px',
            }}>
            {t('message.select-domain-to-add-data-product')}
          </Typography>
          {isEditing && editingState}
        </Box>
      );
    }

    return (
      <Box>
        <Box
          component="span"
          sx={{
            color: theme.palette.allShades.gray[500],
            fontSize: '12px',
          }}>
          {t('label.no-entity-assigned', {
            entity: t('label.data-product-plural'),
          })}
        </Box>
        {isEditing && editingState}
      </Box>
    );
  }, [isLoading, isEditing, editingState, displayActiveDomains, t]);

  const dataProductsDisplay = useMemo(
    () => (
      <Box>
        <Box
          data-testid="data-products-list"
          sx={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {(showAllDataProducts
            ? displayDataProducts
            : displayDataProducts.slice(0, maxVisibleDataProducts)
          ).map((dataProduct) => (
            <Box
              data-testid="data-product-item"
              key={dataProduct.id || dataProduct.fullyQualifiedName}
              sx={{
                display: 'flex',
                alignItems: 'center',
                height: '26px',
                border: `1px solid #dbe0e7`,
                borderRadius: '6px',
                backgroundColor: theme.palette.common.white,
                minWidth: 0,
                transition: 'all 0.2s ease',
                overflow: 'hidden',
              }}>
              <Box
                sx={{
                  height: '100%',
                  borderLeft: `6px solid ${theme.palette.primary.main}`,
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  minWidth: 0,
                  paddding: '3px 0',
                }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    minWidth: 0,
                    gap: '4px',
                    padding: '0px 8px',
                    '& .data-product-icon': {
                      width: '14px',
                      height: '14px',
                      flexShrink: 0,
                      '& svg': {
                        width: '14px',
                        height: '14px',
                      },
                    },
                  }}>
                  <DataProductIcon className="data-product-icon" />
                  <Box
                    component="span"
                    sx={{
                      fontSize: '12px',
                      color: theme.palette.allShades.gray[700],
                      fontWeight: 400,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                    {getEntityName(dataProduct)}
                  </Box>
                </Box>
              </Box>
            </Box>
          ))}
          {displayDataProducts.length > maxVisibleDataProducts && (
            <Box
              component="button"
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                padding: 0,
                height: 'auto',
                width: '100%',
                backgroundColor: 'transparent',
                border: 'none',
                color: theme.palette.primary.main,
                fontSize: '12px',
                fontWeight: 400,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': {
                  textDecoration: 'underline',
                },
                '&:focus': {
                  outline: 'none',
                },
              }}
              type="button"
              onClick={() => setShowAllDataProducts(!showAllDataProducts)}>
              {showAllDataProducts
                ? t('label.less')
                : `+${displayDataProducts.length - maxVisibleDataProducts} ${t(
                    'label.more-lowercase'
                  )}`}
            </Box>
          )}
        </Box>
      </Box>
    ),
    [showAllDataProducts, displayDataProducts, maxVisibleDataProducts, t]
  );

  const dataProductsContent = useMemo(() => {
    if (isLoading) {
      return <Loader size="small" />;
    }

    return (
      <Box>
        {dataProductsDisplay}
        {isEditing && editingState}
      </Box>
    );
  }, [isLoading, isEditing, editingState, dataProductsDisplay]);

  const canShowEditButton =
    showEditButton &&
    hasPermission &&
    !isLoading &&
    displayActiveDomains?.length > 0;

  if (!displayDataProducts?.length) {
    return (
      <Box data-testid="data-products-section">
        <Box
          sx={{
            paddingLeft: '14px',
            paddingRight: '14px',
            paddingBottom: '12px',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
          }}>
          <Typography
            sx={{
              fontSize: '13px',
              fontWeight: 600,
              color: (theme) => theme.palette.allShades.gray[900],
            }}>
            {t('label.data-product-plural')}
          </Typography>
          {canShowEditButton && (
            <EditIconButton
              newLook
              data-testid="edit-data-products"
              disabled={false}
              icon={<EditIcon color={DE_ACTIVE_COLOR} width="12px" />}
              size="small"
              title={t('label.edit-entity', {
                entity: t('label.data-product-plural'),
              })}
              onClick={handleEditClick}
            />
          )}
        </Box>
        <Box
          sx={{
            paddingX: '14px',
            paddingBottom: '16px',
          }}>
          {emptyContent}
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <Box
        data-testid="data-products-section"
        sx={{
          paddingX: '14px',
          paddingBottom: '12px',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
        }}>
        <Typography
          sx={{
            fontSize: '13px',
            fontWeight: 600,
            color: (theme) => theme.palette.allShades.gray[900],
          }}>
          {t('label.data-product-plural')}
        </Typography>
        {canShowEditButton && (
          <EditIconButton
            newLook
            data-testid="edit-data-products"
            disabled={false}
            icon={<EditIcon color={DE_ACTIVE_COLOR} width="12px" />}
            size="small"
            title={t('label.edit-entity', {
              entity: t('label.data-product-plural'),
            })}
            onClick={handleEditClick}
          />
        )}
      </Box>
      <Box
        sx={{
          paddingX: '14px',
          paddingBottom: '16px',
        }}>
        {dataProductsContent}
      </Box>
    </Box>
  );
};

export default DataProductsSectionV1;
